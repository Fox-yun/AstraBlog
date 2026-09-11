// Optional PostgreSQL integration suite. See docs/bar.md for the isolated runtime setup.
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { drizzle, type PgRemoteDatabase } from "drizzle-orm/pg-proxy";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { testId, testRecipeInput } from "./fixtures.test-support";

type RawDb = {
  exec: (sql: string) => Promise<unknown>;
  query: (sql: string, params?: unknown[], options?: { rowMode: "array" }) => Promise<{ rows: unknown[][] }>;
  transaction: <T>(fn: (tx: RawDb) => Promise<T>) => Promise<T>;
  close: () => Promise<void>;
};
const state = vi.hoisted(() => ({ db: null as PgRemoteDatabase<typeof schema> | null,
  session: vi.fn(), transaction: vi.fn(), revalidate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: state.session } } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: state.revalidate }));
vi.mock("@/lib/user-profile", () => ({ ensureUserProfile: async () => ({ status: "active" }) }));
vi.mock("@/db", () => ({
  dbQuery: new Proxy({}, { get: (_, key) => {
    const value = Reflect.get(state.db!, key);
    return typeof value === "function" ? value.bind(state.db) : value;
  } }),
  withTransaction: state.transaction,
}));
import { saveBarRecipe, changeBarRecipeStatus, duplicateBarRecipe, saveBarIngredient, deleteBarIngredient, exportBarData, importBarData, saveBarCategory, deleteBarCategory } from "@/actions/bar";
import { parseBarBackup, type BarBackup } from "./backup";
import { recipeContentSchema } from "./validation";
import { getOwnerCategories, getOwnerIngredients, getOwnerRecipe, getOwnerRecipes, getPublicBarCatalog } from "./queries.server";

const modulePath = process.env.BAR_TEST_PGLITE_MODULE;
describe.skipIf(!modulePath)("bar PostgreSQL integration", () => {
  let raw: RawDb;
  let categoryId: string;
  const sqlFile = readFileSync("drizzle/0001_bar_catalog.sql", "utf8");
  const database = (client: RawDb) => drizzle(async (query, params) => {
    const result = await client.query(query, params, { rowMode: "array" });
    return { rows: result.rows };
  }, { schema });
  beforeAll(async () => {
    const pgliteModule = await import(/* @vite-ignore */ pathToFileURL(modulePath!).href);
    raw = new pgliteModule.PGlite() as RawDb;
    await raw.exec('CREATE TABLE "user" (id text PRIMARY KEY); CREATE TABLE posts (id uuid DEFAULT gen_random_uuid(), type text, slug text);');
    await raw.exec(sqlFile);
    await raw.exec("INSERT INTO \"user\" (id) VALUES ('owner')");
    state.db = database(raw);
    state.transaction.mockImplementation((fn) => raw.transaction((tx) => fn(database(tx))));
    categoryId = (await state.db.select().from(schema.barIngredientCategories).where(eq(schema.barIngredientCategories.name, "金酒")))[0].id;
    vi.stubEnv("DATABASE_URL", "postgresql://isolated-test-only");
  }, 30000);
  afterAll(async () => { await raw?.close(); vi.unstubAllEnvs(); });
  beforeEach(async () => {
    state.session.mockResolvedValue({ session: { id: "session" }, user: { id: "owner", emailVerified: true, role: "owner", banned: false } });
    state.revalidate.mockClear();
    await raw.exec("DELETE FROM bar_recipes; DELETE FROM bar_ingredients WHERE code NOT IN ('ice', 'water'); DELETE FROM posts;");
    await state.db!.insert(schema.barIngredients).values({ id: testId(1), code: "gin", name: "金酒", categoryId });
  });
  const valid = () => testRecipeInput({ status: "published", ingredients: [{ ingredientId: testId(1), amount: 30, unit: "ml", amountText: "", isOptional: false, note: "" }] });
  const example = () => parseBarBackup(readFileSync("docs/examples/bar-import.v1.json", "utf8"));
  const upload = (data: BarBackup | string) => {
    const form = new FormData();
    form.set("file", new File([typeof data === "string" ? data : JSON.stringify(data)], "bar.json", { type: "application/json" }));
    return form;
  };
  it("seeds editable concrete types and immutable system materials", async () => {
    const names = (await getOwnerCategories()).map((category) => category.name);
    expect(names).toEqual(expect.arrayContaining(["金酒", "朗姆", "威士忌"]));
    expect(names).not.toContain("基酒");
    const ice = (await getOwnerIngredients()).find((i) => i.code === "ice")!;
    expect((await deleteBarIngredient(ice.id)).success).toBe(false);
    expect((await saveBarIngredient({ ...ice, code: "new_ice" })).success).toBe(false);
    await expect(raw.exec("DELETE FROM bar_ingredients WHERE code = 'ice'")).rejects.toThrow();
    await expect(raw.exec("UPDATE bar_ingredients SET code = 'new_ice' WHERE code = 'ice'")).rejects.toThrow();
    // Re-running only the seed statements must not create duplicates.
    for (const statement of sqlFile.split("--> statement-breakpoint").filter((s) => s.includes("INSERT INTO bar_"))) await raw.exec(statement);
    expect((await getOwnerIngredients()).filter((i) => ["ice", "water"].includes(i.code))).toHaveLength(2);
  });
  it("protects all action and private read entry points against guests, members and admins", async () => {
    const operations = [() => saveBarRecipe({}), () => changeBarRecipeStatus({}), () => duplicateBarRecipe({}),
      () => saveBarIngredient({}), () => deleteBarIngredient(testId(1)), () => exportBarData(), () => importBarData(upload(example())),
      () => saveBarCategory({}), () => deleteBarCategory(testId(1)),
      () => getOwnerCategories(), () => getOwnerIngredients(), () => getOwnerRecipe(testId(20)), () => getOwnerRecipes()];
    for (const role of [null, "member", "admin"]) {
      state.session.mockResolvedValue(role ? { session: {}, user: { id: "other", emailVerified: true, role } } : null);
      for (const operation of operations) await expect(operation()).rejects.toThrow(/UNAUTHORIZED|FORBIDDEN/);
    }
  });
  it("publishes a public whitelist without draft-only ingredients, labels or private metadata", async () => {
    const hiddenType = await saveBarCategory({ name: "私人测试类型", sortOrder: 1000 });
    if (!hiddenType.success) throw new Error(hiddenType.error);
    const hidden = await saveBarIngredient({ code: "private_material", name: "私有材料哨兵", nameEn: "", aliases: [], categoryId: hiddenType.data.id, sortOrder: 0 });
    if (!hidden.success) throw new Error(hidden.error);
    await saveBarRecipe({ ...valid(), name: "private-draft-sentinel", status: "draft", ingredients: [{ ...valid().ingredients[0], ingredientId: hidden.data.id }] });
    const published = await saveBarRecipe({ ...valid(), createdBy: "forged" });
    expect(published.success).toBe(true);
    const catalog = await getPublicBarCatalog();
    expect(catalog.recipes).toHaveLength(1);
    const json = JSON.stringify(catalog);
    for (const hiddenValue of ["private-only-sentinel", "private-draft-sentinel", "私有材料哨兵", "私人测试类型", "privateNotes", "createdBy", "revision", "publishedAt", "updatedAt"]) expect(json).not.toContain(hiddenValue);
    if (published.success) expect((await getOwnerRecipe(published.data.id))?.createdBy).toBe("owner");
  });
  it("atomically rejects stale updates and rolls back a failed ingredient insert", async () => {
    const saved = await saveBarRecipe(valid()); if (!saved.success) throw new Error(saved.error);
    const changed = await saveBarRecipe({ ...valid(), ...saved.data, name: "最新版本" }); expect(changed.success).toBe(true);
    const stale = await saveBarRecipe({ ...valid(), ...saved.data, name: "旧版本覆盖" });
    expect(stale.success).toBe(false);
    if (!stale.success) expect(stale.error).toContain("其他页面更新");
    const current = await getOwnerRecipe(saved.data.id);
    expect(current?.name).toBe("最新版本"); expect(current?.revision).toBe(2);
    // Force a failure after the parent update and old ingredient deletion have executed.
    await raw.exec("CREATE FUNCTION bar_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced insert failure'; END $$; CREATE TRIGGER bar_test_failure BEFORE INSERT ON bar_recipe_ingredients FOR EACH ROW EXECUTE FUNCTION bar_test_fail();");
    const failed = await saveBarRecipe({ ...valid(), id: saved.data.id, revision: 2, name: "不应保存" });
    expect(failed.success).toBe(false);
    await raw.exec("DROP TRIGGER bar_test_failure ON bar_recipe_ingredients; DROP FUNCTION bar_test_fail();");
    const after = await getOwnerRecipe(saved.data.id);
    expect(after?.name).toBe("最新版本"); expect(after?.revision).toBe(2); expect(after?.ingredients).toHaveLength(1);
  });
  it("archives, restores to draft, duplicates independently and exports private backup", async () => {
    const result = await saveBarRecipe(valid()); if (!result.success) throw new Error(result.error);
    const copied = await duplicateBarRecipe(result.data); expect(copied.success).toBe(true);
    if (copied.success) { const copy = await getOwnerRecipe(copied.data.id); expect(copy?.status).toBe("draft"); expect(copy?.ingredients).toHaveLength(1); expect(copy?.id).not.toBe(result.data.id); }
    const archived = await changeBarRecipeStatus({ ...result.data, status: "archived" }); expect(archived.success).toBe(true);
    expect((await getPublicBarCatalog()).recipes).toEqual([]);
    if (archived.success) expect((await changeBarRecipeStatus({ ...archived.data, status: "draft" })).success).toBe(true);
    expect((await getPublicBarCatalog()).recipes).toEqual([]);
    const backup = await exportBarData(); expect(backup.success).toBe(true);
    if (backup.success) { const data = JSON.parse(backup.data); expect(data.formatVersion).toBe(1); expect(data.categories.length).toBeGreaterThan(0); expect(data.recipes[0].privateNotes).toBe("private-only-sentinel"); }
  });
  it("allows exactly one of two simultaneous submissions of the same revision", async () => {
    const saved = await saveBarRecipe(valid()); if (!saved.success) throw new Error(saved.error);
    const results = await Promise.all([
      saveBarRecipe({ ...valid(), ...saved.data, name: "页面一" }),
      saveBarRecipe({ ...valid(), ...saved.data, name: "页面二" }),
    ]);
    expect(results.filter((result) => result.success)).toHaveLength(1);
    const current = await getOwnerRecipe(saved.data.id);
    expect(current?.revision).toBe(2);
    expect(["页面一", "页面二"]).toContain(current?.name);
  });
  it("manages custom type labels and refuses deletion while referenced", async () => {
    const type = await saveBarCategory({ name: "测试类型", sortOrder: 999 }); if (!type.success) throw new Error(type.error);
    expect((await saveBarCategory({ ...type.data, name: "自制浸泡酒" })).success).toBe(true);
    const material = await saveBarIngredient({ code: "infusion", name: "浸泡酒", nameEn: "", aliases: [], categoryId: type.data.id, sortOrder: 0 });
    if (!material.success) throw new Error(material.error);
    expect((await deleteBarCategory(type.data.id)).success).toBe(false);
    await saveBarRecipe({ ...valid(), ingredients: [{ ...valid().ingredients[0], ingredientId: material.data.id }] });
    expect((await deleteBarIngredient(material.data.id)).success).toBe(false);
    expect((await getPublicBarCatalog()).categories.map((c) => c.name)).toContain("自制浸泡酒");
    await raw.exec("DELETE FROM bar_recipes");
    expect((await deleteBarIngredient(material.data.id)).success).toBe(true);
    expect((await deleteBarCategory(type.data.id)).success).toBe(true);
  });
  it("round-trips a real export as drafts with private notes, ordered quantities and current ownership", async () => {
    const published = await saveBarRecipe({ ...valid(), ingredients: [
      { ...valid().ingredients[0], amount: 12.3456, note: "first" },
      { ...valid().ingredients[0], amount: null, unit: "", amountText: "少许", isOptional: true, note: "second" },
    ] });
    expect(published.success).toBe(true);
    await saveBarRecipe({ ...valid(), status: "draft", name: "", ingredients: [], steps: [] });
    const archived = await saveBarRecipe({ ...valid(), name: "已归档" });
    if (!archived.success) throw new Error(archived.error);
    await changeBarRecipeStatus({ ...archived.data, status: "archived" });
    const backup = await exportBarData(); if (!backup.success) throw new Error(backup.error);
    const original = parseBarBackup(backup.data);
    await raw.exec("DELETE FROM bar_recipes; DELETE FROM bar_ingredients WHERE code NOT IN ('ice', 'water');");
    const data = structuredClone(original);
    data.recipes.forEach((row) => { row.createdBy = "foreign-owner"; row.updatedBy = "forged-owner"; row.revision = 99; });
    const imported = await importBarData(upload(data));
    expect(imported).toEqual({ success: true, data: { categoriesAdded: 0, ingredientsAdded: 1, recipesAdded: 3, recipesSkipped: 0 } });
    for (const source of original.recipes) {
      const restored = await getOwnerRecipe(source.id);
      expect(restored).toMatchObject({ id: source.id, status: "draft", revision: 1, publishedAt: null, createdBy: "owner", updatedBy: "owner" });
      expect(recipeContentSchema.parse(restored)).toEqual(recipeContentSchema.parse(source));
      const expected = original.recipeIngredients.filter((line) => line.recipeId === source.id).map(({ ingredientId, amount, unit, amountText, isOptional, note, sortOrder }) => ({ ingredientId, amount, unit, amountText, isOptional, note, sortOrder }));
      expect(restored?.ingredients.map(({ ingredientId, amount, unit, amountText, isOptional, note, sortOrder }) => ({ ingredientId, amount, unit, amountText, isOptional, note, sortOrder }))).toEqual(expected);
    }
    expect((await getPublicBarCatalog()).recipes).toEqual([]);
    const exportedAgain = await exportBarData(); if (!exportedAgain.success) throw new Error(exportedAgain.error);
    expect(parseBarBackup(exportedAgain.data).recipes).toHaveLength(3);
  });
  it("reuses foreign dictionary IDs by name/code and skips repeated recipes without overwriting edits", async () => {
    const data = example();
    const ice = (await getOwnerIngredients()).find((row) => row.code === "ice")!;
    data.ingredients.push({ ...data.ingredients[0], id: testId(810), code: "ice", name: "外部冰" });
    data.recipeIngredients.push({ ...data.recipeIngredients[0], id: testId(811), ingredientId: testId(810), amount: null, unit: "", amountText: "一块", sortOrder: 1 });
    expect(await importBarData(upload(data))).toEqual({ success: true, data: { categoriesAdded: 0, ingredientsAdded: 0, recipesAdded: 1, recipesSkipped: 0 } });
    const recipe = await getOwnerRecipe(data.recipes[0].id);
    expect(recipe?.ingredients.map((line) => line.ingredientId)).toEqual([testId(1), ice.id]);
    expect((await getOwnerIngredients()).find((row) => row.id === ice.id)?.name).toBe(ice.name);
    const updated = await saveBarRecipe({ ...valid(), id: data.recipes[0].id, revision: 1, name: "保留本地编辑", privateNotes: "local-only" });
    expect(updated.success).toBe(true);
    expect(await importBarData(upload(data))).toEqual({ success: true, data: { categoriesAdded: 0, ingredientsAdded: 0, recipesAdded: 0, recipesSkipped: 1 } });
    expect(await getOwnerRecipe(data.recipes[0].id)).toMatchObject({ name: "保留本地编辑", privateNotes: "local-only", status: "published", revision: 2 });
  });
  it("rolls back every imported table after a late SQL failure, then allows retry", async () => {
    const data = example(); data.categories[0].name = "导入回滚类型"; data.ingredients[0].code = "rollback_import_gin";
    await raw.exec("CREATE FUNCTION bar_import_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced import failure'; END $$; CREATE TRIGGER bar_import_failure BEFORE INSERT ON bar_recipe_ingredients FOR EACH ROW EXECUTE FUNCTION bar_import_fail();");
    try { expect((await importBarData(upload(data))).success).toBe(false); }
    finally { await raw.exec("DROP TRIGGER bar_import_failure ON bar_recipe_ingredients; DROP FUNCTION bar_import_fail();"); }
    expect((await getOwnerCategories()).some((row) => row.name === "导入回滚类型")).toBe(false);
    expect((await getOwnerIngredients()).some((row) => row.code === "rollback_import_gin")).toBe(false);
    expect(await getOwnerRecipe(data.recipes[0].id)).toBeNull();
    expect(await importBarData(upload(data))).toEqual({ success: true, data: { categoriesAdded: 1, ingredientsAdded: 1, recipesAdded: 1, recipesSkipped: 0 } });
    await raw.exec("DELETE FROM bar_recipes; DELETE FROM bar_ingredients WHERE code = 'rollback_import_gin'; DELETE FROM bar_ingredient_categories WHERE name = '导入回滚类型';");
  });
  it("rejects malformed references and material identity collisions without changing data", async () => {
    const data = example(); data.recipeIngredients[0].ingredientId = testId(999);
    state.transaction.mockClear();
    expect((await importBarData(upload(data))).success).toBe(false);
    expect(state.transaction).not.toHaveBeenCalled();
    const collision = example(); collision.ingredients[0].id = testId(1); collision.ingredients[0].code = "different_code";
    collision.recipeIngredients[0].ingredientId = testId(1);
    const result = await importBarData(upload(collision));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("材料 ID");
    expect(await getOwnerRecipes()).toHaveLength(0);
    expect((await getOwnerIngredients()).find((row) => row.id === testId(1))?.code).toBe("gin");
  });
  it("rejects missing and oversized uploads on the server before starting a transaction", async () => {
    state.transaction.mockClear();
    expect((await importBarData({})).success).toBe(false);
    expect((await importBarData(new FormData())).success).toBe(false);
    const form = new FormData();
    form.set("file", new File([new Uint8Array(5 * 1024 * 1024 + 1)], "oversized.json"));
    const result = await importBarData(form);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("5 MiB");
    expect(state.transaction).not.toHaveBeenCalled();
  });
  it("handles simultaneous re-imports without duplicate recipe or ingredient rows", async () => {
    const data = example();
    const results = await Promise.all([importBarData(upload(data)), importBarData(upload(data))]);
    expect(results.every((result) => result.success)).toBe(true);
    expect(results.flatMap((result) => result.success ? [result.data.recipesAdded] : []).sort()).toEqual([0, 1]);
    expect((await getOwnerRecipe(data.recipes[0].id))?.ingredients).toHaveLength(1);
  });
  it("migration preflight refuses to hide an existing custom /bar page", async () => {
    await raw.exec("INSERT INTO posts (type, slug) VALUES ('page', 'BAR')");
    await expect(raw.exec(sqlFile.split("--> statement-breakpoint")[0])).rejects.toThrow("BAR_ROUTE_CONFLICT");
  });
});
