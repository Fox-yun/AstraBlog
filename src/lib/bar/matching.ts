import { isSystemIngredient } from "./constants";
import type { BarCatalog, BarPreferences, Ingredient, PublicRecipe } from "./types";

export const normalizeSearch = (value: string) => value.normalize("NFKC").trim().toLowerCase();
export function getMissingIngredientIds(recipe: PublicRecipe, selected: ReadonlySet<string>, ingredients: ReadonlyMap<string, Ingredient>) {
  return [...new Set(recipe.ingredients.filter((row) => !row.isOptional).map((row) => row.ingredientId))]
    .filter((id) => !selected.has(id) && !isSystemIngredient(ingredients.get(id)?.code ?? ""));
}
export function matchesSearch(recipe: PublicRecipe, query: string, ingredients: ReadonlyMap<string, Ingredient>) {
  const fields = [recipe.name, recipe.nameEn, ...recipe.aliases,
    ...recipe.ingredients.flatMap((row) => {
      const ingredient = ingredients.get(row.ingredientId);
      return ingredient ? [ingredient.name, ingredient.nameEn, ...ingredient.aliases] : [];
    }),
  ].map(normalizeSearch);
  return normalizeSearch(query).split(/\s+/).filter(Boolean).every((word) => fields.some((field) => field.includes(word)));
}
export function filterCatalog(catalog: BarCatalog, preferences: BarPreferences, query: string, favoritesOnly: boolean) {
  const dictionary = new Map(catalog.ingredients.map((item) => [item.id, item]));
  const selected = new Set(preferences.selectedIngredientIds);
  const favorites = new Set(preferences.favoriteRecipeIds);
  return catalog.recipes.map((recipe) => ({ recipe, missing: getMissingIngredientIds(recipe, selected, dictionary) }))
    .filter(({ recipe, missing }) => (preferences.filterMode === "all" || missing.length <= (preferences.filterMode === "complete" ? 0 : 1))
      && (!favoritesOnly || favorites.has(recipe.id)) && matchesSearch(recipe, query, dictionary))
    .sort((a, b) => a.missing.length - b.missing.length || a.recipe.name.localeCompare(b.recipe.name, "zh-CN") || a.recipe.id.localeCompare(b.recipe.id));
}
