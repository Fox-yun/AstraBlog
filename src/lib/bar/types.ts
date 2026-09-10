import type { barIngredientCategories, barIngredients, barRecipes, barRecipeIngredients } from "@/db/schema/bar";
import type { FILTER_MODES } from "./constants";

export type IngredientCategory = Pick<typeof barIngredientCategories.$inferSelect, "id" | "name" | "sortOrder">;
export type Ingredient = Pick<typeof barIngredients.$inferSelect, "id" | "code" | "name" | "nameEn" | "aliases" | "categoryId" | "sortOrder">;
export type RecipeIngredient = Pick<typeof barRecipeIngredients.$inferSelect, "ingredientId" | "amount" | "unit" | "amountText" | "isOptional" | "note" | "sortOrder">;
export type PublicRecipe = Pick<typeof barRecipes.$inferSelect,
  "id" | "name" | "nameEn" | "aliases" | "description" | "flavorTags" | "method" | "glass" | "iceNote" | "steps" | "publicNotes" | "sourceName" | "sourceUrl"
> & { ingredients: RecipeIngredient[] };
export type OwnerRecipe = typeof barRecipes.$inferSelect & { ingredients: RecipeIngredient[] };
export type BarCatalog = { recipes: PublicRecipe[]; ingredients: Ingredient[]; categories: IngredientCategory[] };
export type FilterMode = (typeof FILTER_MODES)[number];
export type BarPreferences = { selectedIngredientIds: string[]; favoriteRecipeIds: string[]; filterMode: FilterMode };
export type ActionResult<T> = { success: true; data: T } | { success: false; error: string };
