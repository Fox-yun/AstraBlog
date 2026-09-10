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
import { saveBarRecipe, changeBarRecipeStatus, duplicateBarRecipe, saveBarIngredient, deleteBarIngredient, exportBarData, saveBarCategory, deleteBarCategory } from "@/actions/bar";
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
      () => saveBarIngredient({}), () => deleteBarIngredient(testId(1)), () => exportBarData(),
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
  it("migration preflight refuses to hide an existing custom /bar page", async () => {
    await raw.exec("INSERT INTO posts (type, slug) VALUES ('page', 'BAR')");
    await expect(raw.exec(sqlFile.split("--> statement-breakpoint")[0])).rejects.toThrow("BAR_ROUTE_CONFLICT");
  });
});
