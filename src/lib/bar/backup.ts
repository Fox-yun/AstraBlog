import { z } from "zod";
import { categoryInputSchema, idSchema, ingredientInputSchema, recipeContentSchema, recipeIngredientSchema, recipeInputSchema } from "./validation";

export const BAR_BACKUP_VERSION = 1;
export const BAR_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const BAR_IMPORT_LIMITS = { categories: 1000, ingredients: 5000, recipes: 1000, recipeIngredients: 80000 } as const;

const timestamps = {
  createdAt: z.iso.datetime({ offset: true }).optional(),
  updatedAt: z.iso.datetime({ offset: true }).optional(),
};
const backupIdSchema = idSchema.transform((id) => id.toLowerCase());
const categorySchema = categoryInputSchema.extend({ id: backupIdSchema, ...timestamps }).strict();
const ingredientSchema = ingredientInputSchema.extend({ id: backupIdSchema, categoryId: backupIdSchema, ...timestamps }).strict();
const recipeSchema = recipeContentSchema.extend({
  id: backupIdSchema, status: z.enum(["draft", "published", "archived"]),
  revision: z.number().int().positive().max(2147483647).optional(),
  createdBy: z.string().max(200).optional(), updatedBy: z.string().max(200).optional(),
  ...timestamps, publishedAt: z.iso.datetime({ offset: true }).nullable().optional(),
}).strict();
const lineSchema = z.strictObject({
  ...recipeIngredientSchema.shape, id: backupIdSchema, recipeId: backupIdSchema, ingredientId: backupIdSchema,
  sortOrder: z.number().int().min(0).max(100000),
});

export const barBackupSchema = z.strictObject({
  formatVersion: z.literal(BAR_BACKUP_VERSION),
  exportedAt: z.iso.datetime({ offset: true }),
  categories: z.array(categorySchema).max(BAR_IMPORT_LIMITS.categories),
  ingredients: z.array(ingredientSchema).max(BAR_IMPORT_LIMITS.ingredients),
  recipes: z.array(recipeSchema).max(BAR_IMPORT_LIMITS.recipes),
  recipeIngredients: z.array(lineSchema).max(BAR_IMPORT_LIMITS.recipeIngredients),
}).superRefine((data, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
  const unique = (rows: Record<string, unknown>[], key: string, field: string) => {
    const seen = new Set<unknown>();
    rows.forEach((row, index) => {
      if (seen.has(row[key])) issue([field, index, key], "文件内存在重复值");
      seen.add(row[key]);
    });
  };
  for (const field of ["categories", "ingredients", "recipes", "recipeIngredients"] as const) unique(data[field], "id", field);
  unique(data.categories, "name", "categories");
  unique(data.ingredients, "code", "ingredients");
  const categoryIds = new Set(data.categories.map((row) => row.id));
  const ingredientIds = new Set(data.ingredients.map((row) => row.id));
  const recipeIds = new Set(data.recipes.map((row) => row.id));
  const lines = new Map<string, typeof data.recipeIngredients>();
  data.ingredients.forEach((row, index) => {
    if (!categoryIds.has(row.categoryId)) issue(["ingredients", index, "categoryId"], "引用的类型标签不在文件中");
  });
  data.recipeIngredients.forEach((row, index) => {
    if (!ingredientIds.has(row.ingredientId)) issue(["recipeIngredients", index, "ingredientId"], "引用的材料不在文件中");
    if (!recipeIds.has(row.recipeId)) issue(["recipeIngredients", index, "recipeId"], "引用的酒谱不在文件中");
    const parsed = recipeIngredientSchema.safeParse(row);
    if (!parsed.success) for (const error of parsed.error.issues) issue(["recipeIngredients", index, ...error.path as (string | number)[]], error.message);
    const group = lines.get(row.recipeId) ?? [];
    group.push(row); lines.set(row.recipeId, group);
  });
  data.recipes.forEach((row, index) => {
    const ingredients = lines.get(row.id) ?? [];
    const parsed = recipeInputSchema.safeParse({ ...row, id: undefined, revision: undefined,
      status: row.status === "published" ? "published" : "draft", ingredients });
    if (!parsed.success) for (const error of parsed.error.issues) issue(["recipes", index, ...error.path as (string | number)[]], error.message);
    unique(ingredients, "sortOrder", `recipeIngredients (${row.id})`);
  });
});

export type BarBackup = z.infer<typeof barBackupSchema>;
export type BarImportResult = { categoriesAdded: number; ingredientsAdded: number; recipesAdded: number; recipesSkipped: number };

export class BarBackupError extends Error {}
export function parseBarBackup(text: string): BarBackup {
  if (new TextEncoder().encode(text).byteLength > BAR_IMPORT_MAX_BYTES) throw new BarBackupError("JSON 文件不能超过 5 MiB，请拆分后导入。");
  let value: unknown;
  try { value = JSON.parse(text.replace(/^\uFEFF/, "")); }
  catch { throw new BarBackupError("文件不是有效的 JSON，请检查语法后重试。"); }
  if (!value || typeof value !== "object" || !("formatVersion" in value) || value.formatVersion !== BAR_BACKUP_VERSION) {
    throw new BarBackupError("仅支持 formatVersion: 1 的酒单 JSON，请使用完整导出格式。");
  }
  const result = barBackupSchema.safeParse(value);
  if (!result.success) {
    const details = result.error.issues.slice(0, 5).map((error) => `${error.path.join(".")}: ${error.message}`).join("；");
    throw new BarBackupError(`文件校验失败：${details}${result.error.issues.length > 5 ? "；其余错误请修正后重试。" : ""}`);
  }
  return result.data;
}
