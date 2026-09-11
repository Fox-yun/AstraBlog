"use server";

import { withTransaction } from "@/db";
import { barIngredientCategories, barIngredients, barRecipes, barRecipeIngredients } from "@/db/schema/bar";
import { requireOwner } from "@/lib/authorization";
import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { categoryInputSchema, idSchema, ingredientInputSchema, recipeContentSchema, recipeIngredientSchema, recipeInputSchema, versionSchema } from "@/lib/bar/validation";
import { BAR_BACKUP_VERSION, BAR_IMPORT_MAX_BYTES, BarBackupError, parseBarBackup, type BarImportResult } from "@/lib/bar/backup";
import { isSystemIngredient } from "@/lib/bar/constants";
import type { ActionResult, Ingredient, IngredientCategory } from "@/lib/bar/types";
import type { NeonTransaction } from "drizzle-orm/neon-serverless";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type * as schema from "@/db/schema";

type BarTransaction = NeonTransaction<typeof schema, ExtractTablesWithRelations<typeof schema>>;
class BarError extends Error {}
const conflict = () => new BarError("内容已被其他页面更新或状态已改变。请保留当前输入，重新打开最新版本后再保存。");
function failed(error: unknown): { success: false; error: string } {
  if (error instanceof BarError || error instanceof BarBackupError) return { success: false, error: error.message };
  if (error instanceof z.ZodError) return { success: false, error: error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("；") };
  // Do not expose SQL parameters (including private notes) in errors or logs.
  const cause = error && typeof error === "object" && "cause" in error ? error.cause : error;
  const code = cause && typeof cause === "object" && "code" in cause ? cause.code : undefined;
  if (code === "23503") return { success: false, error: "材料或类型标签已被引用或已不存在，请先处理引用后重试。" };
  if (code === "23505") return { success: false, error: "材料标识或类型标签名称已存在，请使用其他名称。" };
  return { success: false, error: "操作失败，输入已保留，请稍后重试。" };
}
function invalidateBar() {
  revalidatePath("/bar");
  revalidatePath("/studio/bar", "layout");
  revalidatePath("/sitemap.xml");
}

export async function saveBarRecipe(raw: unknown): Promise<ActionResult<{ id: string; revision: number }>> {
  const { user } = await requireOwner();
  let saved: { id: string; revision: number };
  try {
    const { id, revision, ingredients, ...recipe } = recipeInputSchema.parse(raw);
    saved = await withTransaction(async (tx: BarTransaction) => {
      const ids = [...new Set(ingredients.map((line) => line.ingredientId))];
      if (ids.length) {
        const found = await tx.select({ id: barIngredients.id }).from(barIngredients).where(inArray(barIngredients.id, ids)).for("key share");
        if (found.length !== ids.length) throw new BarError("有材料已不存在，请重新选择材料。");
      }
      let record: { id: string; revision: number };
      if (id) {
        const [updated] = await tx.update(barRecipes).set({ ...recipe, updatedBy: user.id, updatedAt: new Date(),
          revision: sql`${barRecipes.revision} + 1`,
          publishedAt: recipe.status === "published" ? sql`coalesce(${barRecipes.publishedAt}, now())` : null,
        }).where(and(eq(barRecipes.id, id), eq(barRecipes.revision, revision!), ne(barRecipes.status, "archived"),
          recipe.status === "draft" ? eq(barRecipes.status, "draft") : undefined,
        )).returning({ id: barRecipes.id, revision: barRecipes.revision });
        if (!updated) throw conflict();
        record = updated;
        await tx.delete(barRecipeIngredients).where(eq(barRecipeIngredients.recipeId, id));
      } else {
        [record] = await tx.insert(barRecipes).values({ ...recipe, createdBy: user.id, updatedBy: user.id,
          publishedAt: recipe.status === "published" ? new Date() : null,
        }).returning({ id: barRecipes.id, revision: barRecipes.revision });
      }
      if (ingredients.length) await tx.insert(barRecipeIngredients).values(ingredients.map((line, sortOrder) => ({ ...line, recipeId: record.id, sortOrder })));
      return record;
    });
  } catch (error) { return failed(error); }
  invalidateBar();
  return { success: true, data: saved };
}

export async function changeBarRecipeStatus(raw: unknown): Promise<ActionResult<{ id: string; revision: number }>> {
  const { user } = await requireOwner();
  let saved: { id: string; revision: number };
  try {
    const input = versionSchema.extend({ status: z.enum(["draft", "archived"]) }).parse(raw);
    saved = await withTransaction(async (tx: BarTransaction) => {
      const [record] = await tx.update(barRecipes).set({ status: input.status, updatedBy: user.id,
        updatedAt: new Date(), publishedAt: null, revision: sql`${barRecipes.revision} + 1`,
      }).where(and(eq(barRecipes.id, input.id), eq(barRecipes.revision, input.revision),
        input.status === "draft" ? eq(barRecipes.status, "archived") : ne(barRecipes.status, "archived"),
      )).returning({ id: barRecipes.id, revision: barRecipes.revision });
      if (!record) throw conflict();
      return record;
    });
  } catch (error) { return failed(error); }
  invalidateBar();
  return { success: true, data: saved };
}

export async function duplicateBarRecipe(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const { user } = await requireOwner();
  let saved: { id: string };
  try {
    const input = versionSchema.parse(raw);
    saved = await withTransaction(async (tx: BarTransaction) => {
      // Lock the parent so its ingredient rows cannot be replaced during copying.
      const [original] = await tx.select().from(barRecipes).where(and(eq(barRecipes.id, input.id), eq(barRecipes.revision, input.revision))).for("update");
      if (!original) throw conflict();
      const lines = await tx.select().from(barRecipeIngredients).where(eq(barRecipeIngredients.recipeId, input.id));
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- New rows must receive fresh generated identity and timestamps.
      const { id: _id, createdAt: _created, updatedAt: _updated, ...values } = original;
      const [record] = await tx.insert(barRecipes).values({ ...values, name: `${original.name.slice(0, 154)}（副本）`,
        status: "draft", revision: 1, publishedAt: null, createdBy: user.id, updatedBy: user.id,
      }).returning({ id: barRecipes.id });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Ingredient rows also receive fresh generated identities.
      if (lines.length) await tx.insert(barRecipeIngredients).values(lines.map(({ id: _lineId, ...line }) => ({ ...line, recipeId: record.id })));
      return record;
    });
  } catch (error) { return failed(error); }
  invalidateBar();
  return { success: true, data: saved };
}

export async function saveBarIngredient(raw: unknown): Promise<ActionResult<Ingredient>> {
  await requireOwner();
  let saved: Ingredient;
  try {
    const { id, ...values } = ingredientInputSchema.extend({ id: idSchema.optional() }).parse(raw);
    saved = await withTransaction(async (tx: BarTransaction) => {
      if (id) {
        // The code is immutable for every material, including ice and water.
        const [record] = await tx.update(barIngredients).set({ name: values.name, nameEn: values.nameEn,
          aliases: values.aliases, categoryId: values.categoryId, sortOrder: values.sortOrder, updatedAt: new Date(),
        }).where(and(eq(barIngredients.id, id), eq(barIngredients.code, values.code))).returning();
        if (!record) throw new BarError("材料不存在，或尝试修改固定标识。");
        return record;
      }
      if (isSystemIngredient(values.code)) throw new BarError("冰和饮用水由系统初始化，请运行数据库迁移。");
      const [record] = await tx.insert(barIngredients).values(values).returning();
      return record;
    });
  } catch (error) { return failed(error); }
  invalidateBar();
  return { success: true, data: saved };
}

export async function deleteBarIngredient(raw: unknown): Promise<ActionResult<{ id: string }>> {
  await requireOwner();
  let saved: { id: string };
  try {
    const id = idSchema.parse(raw);
    saved = await withTransaction(async (tx: BarTransaction) => {
      const [record] = await tx.delete(barIngredients).where(and(eq(barIngredients.id, id),
        ne(barIngredients.code, "ice"), ne(barIngredients.code, "water"),
      )).returning({ id: barIngredients.id });
      if (!record) throw new BarError("不能删除系统材料，或材料已不存在。");
      return record;
    });
  } catch (error) { return failed(error); }
  invalidateBar();
  return { success: true, data: saved };
}

export async function exportBarData(): Promise<ActionResult<string>> {
  await requireOwner();
  try {
    const data = await withTransaction(async (tx: BarTransaction) => {
      await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY`);
      const categories = await tx.select().from(barIngredientCategories).orderBy(barIngredientCategories.id);
      const ingredients = await tx.select().from(barIngredients).orderBy(barIngredients.id);
      const recipes = await tx.select().from(barRecipes).orderBy(barRecipes.id);
      const recipeIngredients = await tx.select().from(barRecipeIngredients).orderBy(barRecipeIngredients.recipeId, barRecipeIngredients.sortOrder);
      return { formatVersion: BAR_BACKUP_VERSION, exportedAt: new Date().toISOString(), categories, ingredients, recipes, recipeIngredients };
    });
    return { success: true, data: JSON.stringify(data, null, 2) };
  } catch (error) { return failed(error); }
}

export async function importBarData(raw: unknown): Promise<ActionResult<BarImportResult>> {
  const { user } = await requireOwner();
  let saved: BarImportResult;
  try {
    if (!(raw instanceof FormData)) throw new BarBackupError("请选择需要导入的 JSON 文件。");
    const file = raw.get("file");
    if (!(file instanceof File) || file.size === 0) throw new BarBackupError("请选择非空的 JSON 文件。");
    if (file.size > BAR_IMPORT_MAX_BYTES) throw new BarBackupError("JSON 文件不能超过 5 MiB，请拆分后导入。");
    const data = parseBarBackup(await file.text());
    saved = await withTransaction(async (tx: BarTransaction) => {
      const counts: BarImportResult = { categoriesAdded: 0, ingredientsAdded: 0, recipesAdded: 0, recipesSkipped: 0 };
      const batches = <T,>(rows: T[]) => {
        const groups: T[][] = [];
        for (let index = 0; index < rows.length; index += 250) groups.push(rows.slice(index, index + 250));
        return groups;
      };
      const categoryIds = new Map<string, string>();
      const ingredientIds = new Map<string, string>();
      for (const batch of batches(data.categories)) {
        const inserted = await tx.insert(barIngredientCategories).values(batch.map((row) => ({ id: row.id, ...categoryInputSchema.parse(row) })))
          .onConflictDoNothing().returning({ id: barIngredientCategories.id });
        counts.categoriesAdded += inserted.length;
      }
      if (data.categories.length) {
        const existing = await tx.select().from(barIngredientCategories).where(or(
          inArray(barIngredientCategories.id, data.categories.map((row) => row.id)),
          inArray(barIngredientCategories.name, data.categories.map((row) => row.name)),
        ));
        const byId = new Map(existing.map((row) => [row.id, row]));
        const byName = new Map(existing.map((row) => [row.name, row]));
        for (const row of data.categories) {
          const sameId = byId.get(row.id), sameName = byName.get(row.name);
          if (sameId && sameName && sameId.id !== sameName.id) throw new BarBackupError("类型标签的 ID 与名称指向不同记录，请修正文件后重试。");
          const target = sameId ?? sameName;
          if (!target) throw new BarBackupError("类型标签已改变，请重试导入。");
          categoryIds.set(row.id, target.id);
        }
      }
      // Existing dictionary entries remain unchanged. Codes map foreign IDs to local materials.
      for (const batch of batches(data.ingredients.filter((row) => !isSystemIngredient(row.code)))) {
        const inserted = await tx.insert(barIngredients).values(batch.map((row) => ({ id: row.id,
          ...ingredientInputSchema.parse(row), categoryId: categoryIds.get(row.categoryId)!,
        }))).onConflictDoNothing().returning({ id: barIngredients.id });
        counts.ingredientsAdded += inserted.length;
      }
      if (data.ingredients.length) {
        const existing = await tx.select().from(barIngredients).where(or(
          inArray(barIngredients.id, data.ingredients.map((row) => row.id)),
          inArray(barIngredients.code, data.ingredients.map((row) => row.code)),
        ));
        const byId = new Map(existing.map((row) => [row.id, row]));
        const byCode = new Map(existing.map((row) => [row.code, row]));
        for (const row of data.ingredients) {
          const sameId = byId.get(row.id);
          if (sameId && sameId.code !== row.code) throw new BarBackupError("材料 ID 已用于其他固定标识，请修正文件后重试。");
          const target = sameId ?? byCode.get(row.code);
          if (!target) throw new BarBackupError("材料不存在；冰和饮用水需要先运行数据库迁移。");
          ingredientIds.set(row.id, target.id);
        }
      }
      const addedRecipes = new Set<string>();
      for (const batch of batches(data.recipes)) {
        const inserted = await tx.insert(barRecipes).values(batch.map((row) => ({
          ...recipeContentSchema.parse(row), id: row.id, status: "draft" as const,
          revision: 1, publishedAt: null, createdBy: user.id, updatedBy: user.id,
        }))).onConflictDoNothing().returning({ id: barRecipes.id });
        for (const row of inserted) addedRecipes.add(row.id);
      }
      for (const batch of batches(data.recipeIngredients.filter((row) => addedRecipes.has(row.recipeId)))) {
        await tx.insert(barRecipeIngredients).values(batch.map((row) => ({
          ...recipeIngredientSchema.parse(row), recipeId: row.recipeId,
          ingredientId: ingredientIds.get(row.ingredientId)!, sortOrder: row.sortOrder,
        })));
      }
      counts.recipesAdded = addedRecipes.size;
      counts.recipesSkipped = data.recipes.length - addedRecipes.size;
      return counts;
    });
  } catch (error) { return failed(error); }
  invalidateBar();
  return { success: true, data: saved };
}

export async function saveBarCategory(raw: unknown): Promise<ActionResult<IngredientCategory>> {
  await requireOwner();
  let saved: IngredientCategory;
  try {
    const { id, ...values } = categoryInputSchema.extend({ id: idSchema.optional() }).parse(raw);
    saved = await withTransaction(async (tx: BarTransaction) => {
      if (id) {
        const [record] = await tx.update(barIngredientCategories).set({ ...values, updatedAt: new Date() })
          .where(eq(barIngredientCategories.id, id)).returning();
        if (!record) throw new BarError("类型标签已不存在，请刷新后重试。");
        return record;
      }
      const [record] = await tx.insert(barIngredientCategories).values(values).returning();
      return record;
    });
  } catch (error) { return failed(error); }
  invalidateBar();
  return { success: true, data: saved };
}

export async function deleteBarCategory(raw: unknown): Promise<ActionResult<{ id: string }>> {
  await requireOwner();
  let saved: { id: string };
  try {
    const id = idSchema.parse(raw);
    saved = await withTransaction(async (tx: BarTransaction) => {
      const [record] = await tx.delete(barIngredientCategories).where(eq(barIngredientCategories.id, id)).returning({ id: barIngredientCategories.id });
      if (!record) throw new BarError("类型标签已不存在。");
      return record;
    });
  } catch (error) { return failed(error); }
  invalidateBar();
  return { success: true, data: saved };
}
