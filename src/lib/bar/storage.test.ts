import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyPreferences, parsePreferences, readPreferences, writePreferences } from "./storage";
import { testCatalog, testId } from "./fixtures.test-support";
afterEach(() => vi.unstubAllGlobals());
describe("bar preferences", () => {
  it("starts with all recipes and filters unknown, duplicate and system ids", () => {
    expect(parsePreferences(null, testCatalog())).toEqual({ preferences: emptyPreferences(), restored: false });
    const result = parsePreferences(JSON.stringify({ selectedIngredientIds: [testId(1), testId(1), testId(5), testId(6), "unknown", 7], favoriteRecipeIds: [testId(20), "draft"], filterMode: "one-missing", ice: false }), testCatalog());
    expect(result.preferences).toEqual({ selectedIngredientIds: [testId(1)], favoriteRecipeIds: [testId(20)], filterMode: "one-missing" });
  });
  it("handles corrupt or inaccessible storage without blocking interaction", () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => "invalid-json" } });
    expect(readPreferences(testCatalog()).warning).not.toBe("");
    vi.stubGlobal("window", { get localStorage() { throw new Error("blocked"); } });
    expect(readPreferences(testCatalog()).preferences).toEqual(emptyPreferences());
    expect(writePreferences(emptyPreferences())).toBe(false);
  });
  it("writes only the three preference fields", () => {
    const setItem = vi.fn(); vi.stubGlobal("window", { localStorage: { setItem } });
    expect(writePreferences(emptyPreferences())).toBe(true);
    expect(JSON.parse(setItem.mock.calls[0][1])).toEqual(emptyPreferences());
  });
});
