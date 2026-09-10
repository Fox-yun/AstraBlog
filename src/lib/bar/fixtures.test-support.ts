import type { BarCatalog, Ingredient, PublicRecipe } from "./types";
import type { RecipeInput } from "./validation";
export const testId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const testCategories = [{ id: testId(100), name: "金酒", sortOrder: 1 }, { id: testId(101), name: "朗姆", sortOrder: 2 }, { id: testId(102), name: "汽水", sortOrder: 3 }];
export const testIngredients: Ingredient[] = [
  { id: testId(1), code: "gin", name: "伦敦干金酒", nameEn: "London dry gin", aliases: ["杜松子酒"], categoryId: testId(100), sortOrder: 1 },
  { id: testId(2), code: "white_rum", name: "白朗姆", nameEn: "White rum", aliases: [], categoryId: testId(101), sortOrder: 2 },
  { id: testId(3), code: "soda_water", name: "苏打水", nameEn: "Soda water", aliases: ["气泡水"], categoryId: testId(102), sortOrder: 3 },
  { id: testId(4), code: "tonic_water", name: "汤力水", nameEn: "Tonic water", aliases: [], categoryId: testId(102), sortOrder: 4 },
  { id: testId(5), code: "ice", name: "冰", nameEn: "Ice", aliases: [], categoryId: testId(102), sortOrder: 5 },
  { id: testId(6), code: "water", name: "普通饮用水", nameEn: "Water", aliases: [], categoryId: testId(102), sortOrder: 6 },
];
export const testLine = (id: number, isOptional = false) => ({ ingredientId: testId(id), amount: 20, unit: "ml", amountText: "", isOptional, note: "", sortOrder: 0 });
export const testRecipe = (overrides: Partial<PublicRecipe> = {}): PublicRecipe => ({
  id: testId(20), name: "金酒水", nameEn: "Gin water", aliases: ["试饮"], description: "测试用配方", flavorTags: ["清爽"],
  method: "搅拌", glass: "短杯", iceNote: "加入方冰", steps: ["混合材料，搅拌。"], publicNotes: "公开说明", sourceName: "", sourceUrl: "",
  ingredients: [testLine(1), testLine(6), testLine(5)], ...overrides,
});
export const testCatalog = (): BarCatalog => ({ categories: testCategories, ingredients: testIngredients, recipes: [
  testRecipe(), testRecipe({ id: testId(21), name: "金酒苏打", nameEn: "Gin soda", ingredients: [testLine(1), testLine(3), testLine(5)] }),
  testRecipe({ id: testId(22), name: "金汤力", nameEn: "Gin tonic", ingredients: [testLine(1), testLine(4), testLine(5)] }),
  testRecipe({ id: testId(23), name: "朗姆水", nameEn: "Rum water", ingredients: [testLine(2), testLine(6)] }),
] });
export const testRecipeInput = (overrides: Partial<RecipeInput> = {}): RecipeInput => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Creation input intentionally omits the fixture record id.
  const { id: _id, ...recipe } = testRecipe();
  return { ...recipe, privateNotes: "private-only-sentinel", status: "draft", ...overrides };
};
