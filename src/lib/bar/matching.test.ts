import { describe, expect, it } from "vitest";
import { filterCatalog, getMissingIngredientIds, matchesSearch } from "./matching";
import { testCatalog, testIngredients, testId, testLine, testRecipe } from "./fixtures.test-support";
import { emptyPreferences } from "./storage";
const dictionary = new Map(testIngredients.map((item) => [item.id, item]));
describe("bar matching", () => {
  it("always has ice and water, while soda and tonic are ordinary ingredients", () => {
    const selected = new Set([testId(1)]);
    expect(getMissingIngredientIds(testRecipe(), selected, dictionary)).toEqual([]);
    expect(getMissingIngredientIds(testRecipe({ ingredients: [testLine(1), testLine(3), testLine(4), testLine(5)] }), selected, dictionary)).toEqual([testId(3), testId(4)]);
    expect(getMissingIngredientIds(testRecipe(), new Set(), dictionary)).toEqual([testId(1)]);
  });
  it("deduplicates required ingredients and ignores optional garnish", () => {
    expect(getMissingIngredientIds(testRecipe({ ingredients: [testLine(3), testLine(3), testLine(2, true)] }), new Set(), dictionary)).toEqual([testId(3)]);
  });
  it("uses ids even when display names change", () => {
    const renamed = new Map(dictionary); renamed.set(testId(3), { ...testIngredients[2], name: "普通饮用水" });
    expect(getMissingIngredientIds(testRecipe({ ingredients: [testLine(3)] }), new Set(), renamed)).toEqual([testId(3)]);
  });
  it("normalizes width, case and whitespace; every token must match across fields", () => {
    expect(matchesSearch(testRecipe(), "  ＧＩＮ 杜松子酒  ", dictionary)).toBe(true);
    expect(matchesSearch(testRecipe(), "试饮 WATER", dictionary)).toBe(true);
    expect(matchesSearch(testRecipe(), "GIN 朗姆", dictionary)).toBe(false);
  });
  it("intersects search, ingredient mode and favorites without modifying selection", () => {
    const preferences = { ...emptyPreferences(), selectedIngredientIds: [testId(1)], favoriteRecipeIds: [testId(21)], filterMode: "one-missing" as const };
    expect(filterCatalog(testCatalog(), preferences, "气泡水", true).map((r) => r.recipe.id)).toEqual([testId(21)]);
    expect(filterCatalog(testCatalog(), { ...preferences, filterMode: "complete" }, "气泡水", true)).toEqual([]);
    expect(preferences.selectedIngredientIds).toEqual([testId(1)]);
  });
  it("sorts complete first and uses stable name/id tie breakers", () => {
    const results = filterCatalog(testCatalog(), { ...emptyPreferences(), selectedIngredientIds: [testId(1)], filterMode: "one-missing" }, "", false);
    expect(results[0].recipe.id).toBe(testId(20));
    expect(results.map((r) => r.missing.length)).toEqual([0, 1, 1, 1]);
  });
});
