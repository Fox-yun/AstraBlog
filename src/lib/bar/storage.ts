import { FILTER_MODES, isSystemIngredient } from "./constants";
import type { BarCatalog, BarPreferences } from "./types";
export const PREFERENCES_KEY = "astrablog:bar:preferences:v1";
export const emptyPreferences = (): BarPreferences => ({ selectedIngredientIds: [], favoriteRecipeIds: [], filterMode: "all" });
export function parsePreferences(raw: string | null, catalog: BarCatalog): { preferences: BarPreferences; restored: boolean } {
  if (!raw) return { preferences: emptyPreferences(), restored: false };
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== "object") throw new Error("Invalid preferences");
  const value = data as Record<string, unknown>;
  if (!Array.isArray(value.selectedIngredientIds) || !Array.isArray(value.favoriteRecipeIds)
    || !FILTER_MODES.some((mode) => mode === value.filterMode)) throw new Error("Invalid preferences");
  const knownIngredients = new Set(catalog.ingredients.filter((i) => !isSystemIngredient(i.code)).map((i) => i.id));
  const knownRecipes = new Set(catalog.recipes.map((r) => r.id));
  const cleanIds = (ids: unknown[], known: Set<string>) => [...new Set(ids.filter((id): id is string => typeof id === "string" && known.has(id)))];
  return { preferences: {
    selectedIngredientIds: cleanIds(value.selectedIngredientIds, knownIngredients),
    favoriteRecipeIds: cleanIds(value.favoriteRecipeIds, knownRecipes), filterMode: value.filterMode as BarPreferences["filterMode"],
  }, restored: true };
}
export function readPreferences(catalog: BarCatalog) {
  try { return { ...parsePreferences(window.localStorage.getItem(PREFERENCES_KEY), catalog), warning: "" }; }
  catch { return { preferences: emptyPreferences(), restored: false, warning: "无法恢复本地偏好，可继续筛选；本次设置可能无法保存。" }; }
}
export function writePreferences(preferences: BarPreferences) {
  try { window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)); return true; }
  catch { return false; }
}
