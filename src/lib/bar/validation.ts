import { z } from "zod";
import { isSafeSourceUrl } from "./urls";

const text = (max: number) => z.string().trim().max(max);
const words = (max: number, length: number) => z.array(text(length).min(1)).max(max);
export const idSchema = z.uuid();
export const versionSchema = z.object({ id: idSchema, revision: z.number().int().positive().max(2147483646) });
export const ingredientInputSchema = z.object({
  code: text(80).regex(/^[a-z][a-z0-9_]*$/, "标识只能使用小写英文、数字和下划线"),
  name: text(120).min(1, "请输入材料名称"), nameEn: text(160),
  aliases: words(30, 120), categoryId: idSchema,
  sortOrder: z.number().int().min(-100000).max(100000),
});
export const categoryInputSchema = z.object({
  name: text(80).min(1, "请输入材料类型标签名称"),
  sortOrder: z.number().int().min(-100000).max(100000),
});
export const recipeIngredientSchema = z.object({
  ingredientId: idSchema,
  amount: z.number().positive().max(1000000).multipleOf(0.0001).nullable(),
  unit: text(30), amountText: text(120), isOptional: z.boolean(), note: text(500),
}).superRefine((row, ctx) => {
  if (row.amountText && (row.amount !== null || row.unit)) {
    ctx.addIssue({ code: "custom", path: ["amountText"], message: "数值与单位、文字用量只能选择一种表达" });
  }
});
export const recipeContentSchema = z.object({
  name: text(160), nameEn: text(160), aliases: words(30, 160),
  description: text(500), flavorTags: words(20, 40), method: text(120), glass: text(120),
  iceNote: text(500), steps: z.array(text(2000)).max(60),
  publicNotes: text(10000), privateNotes: text(10000), sourceName: text(200),
  sourceUrl: text(2000).refine(isSafeSourceUrl, "来源链接只允许无账号密码的 http 或 https 地址"),
});
export const recipeInputSchema = recipeContentSchema.extend({
  id: idSchema.optional(), revision: z.number().int().positive().max(2147483646).optional(),
  status: z.enum(["draft", "published"]), ingredients: z.array(recipeIngredientSchema).max(80),
}).superRefine((recipe, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
  if (Boolean(recipe.id) !== Boolean(recipe.revision)) issue(["revision"], "更新时必须提供修订号");
  if (recipe.status !== "published") return;
  if (!recipe.name) issue(["name"], "发布前请填写中文酒名");
  if (!recipe.ingredients.some((row) => !row.isOptional)) issue(["ingredients"], "发布前至少填写一种必需材料");
  if (!recipe.steps.length || recipe.steps.some((step) => !step)) issue(["steps"], "发布前请填写完整的制作步骤");
  recipe.ingredients.forEach((row, i) => {
    if (!row.amountText && !(row.amount !== null && row.unit)) issue(["ingredients", i, "amount"], `第 ${i + 1} 项配料需要数值与单位，或文字用量`);
  });
});
export type RecipeInput = z.infer<typeof recipeInputSchema>;
export type IngredientInput = z.infer<typeof ingredientInputSchema>;
