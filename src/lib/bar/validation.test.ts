import { describe, expect, it } from "vitest";
import { categoryInputSchema, ingredientInputSchema, recipeInputSchema } from "./validation";
import { testId, testLine, testRecipeInput } from "./fixtures.test-support";
describe("bar validation", () => {
  it("permits incomplete drafts but enforces publishing requirements", () => {
    const empty = testRecipeInput({ name: "", ingredients: [], steps: [] });
    expect(recipeInputSchema.safeParse(empty).success).toBe(true);
    expect(recipeInputSchema.safeParse({ ...empty, status: "published" }).success).toBe(false);
    expect(recipeInputSchema.safeParse(testRecipeInput({ status: "published" })).success).toBe(true);
    expect(recipeInputSchema.safeParse(testRecipeInput({ status: "published", ingredients: [testLine(1, true)] })).success).toBe(false);
  });
  it("validates all filled draft fields, amounts, ids and conflicting expressions", () => {
    for (const amount of [-1, 0, Infinity, NaN, 0.00001, 1000001]) {
      expect(recipeInputSchema.safeParse(testRecipeInput({ ingredients: [{ ...testLine(1), amount }] })).success).toBe(false);
    }
    expect(recipeInputSchema.safeParse(testRecipeInput({ ingredients: [{ ...testLine(1), amountText: "适量" }] })).success).toBe(false);
    expect(recipeInputSchema.safeParse(testRecipeInput({ ingredients: [{ ...testLine(1), ingredientId: "invalid" }] })).success).toBe(false);
    expect(recipeInputSchema.safeParse(testRecipeInput({ ingredients: [{ ...testLine(1), amount: null, unit: "", amountText: "补满" }], status: "published" })).success).toBe(true);
  });
  it("requires a version for updates and strips spoofed identity fields", () => {
    expect(recipeInputSchema.safeParse(testRecipeInput({ id: testId(20) })).success).toBe(false);
    expect(recipeInputSchema.parse({ ...testRecipeInput(), createdBy: "attacker" })).not.toHaveProperty("createdBy");
  });
  it("rejects unsafe source links and accepts http(s)", () => {
    for (const sourceUrl of ["javascript:alert(1)", "data:text/html,test", "//example.com", "https://user:pass@example.com"]) {
      expect(recipeInputSchema.safeParse(testRecipeInput({ sourceUrl })).success).toBe(false);
    }
    expect(recipeInputSchema.safeParse(testRecipeInput({ sourceUrl: "https://example.com/recipe" })).success).toBe(true);
  });
  it("validates mutable category labels and ingredient category references", () => {
    expect(categoryInputSchema.parse({ name: " 威士忌 ", sortOrder: 30 }).name).toBe("威士忌");
    expect(categoryInputSchema.safeParse({ name: " ", sortOrder: 1 }).success).toBe(false);
    expect(ingredientInputSchema.safeParse({ code: "gin", name: "金酒", nameEn: "Gin", aliases: [], categoryId: "spirit", sortOrder: 1 }).success).toBe(false);
  });
});
