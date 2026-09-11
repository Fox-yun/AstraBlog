import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { BAR_IMPORT_MAX_BYTES, parseBarBackup, type BarBackup } from "./backup";
import { testId } from "./fixtures.test-support";

const example = () => JSON.parse(readFileSync("docs/examples/bar-import.v1.json", "utf8")) as BarBackup;
describe("bar backup validation", () => {
  it("accepts the documented export-shaped example, BOM and optional audit metadata", () => {
    const data = example();
    delete data.recipes[0].createdBy; delete data.recipes[0].revision; delete data.categories[0].updatedAt;
    expect(parseBarBackup(`\uFEFF${JSON.stringify(data)}`)).toEqual(data);
  });
  it("rejects invalid JSON, unknown versions and oversized UTF-8 files", () => {
    expect(() => parseBarBackup("{")).toThrow("有效的 JSON");
    expect(() => parseBarBackup(JSON.stringify({ ...example(), formatVersion: 2 }))).toThrow("formatVersion: 1");
    expect(() => parseBarBackup("中".repeat(Math.ceil(BAR_IMPORT_MAX_BYTES / 3)))).toThrow("5 MiB");
  });
  it.each(["categories", "ingredients", "recipes", "recipeIngredients"] as const)("rejects duplicate %s IDs", (field) => {
    const data = example();
    const rows = data[field] as Array<{ id: string }>;
    rows.push({ ...rows[0] });
    expect(() => parseBarBackup(JSON.stringify(data))).toThrow("重复值");
  });
  it("normalizes UUID casing before checking references and duplicates", () => {
    const data = example();
    const id = "abcdefab-abcd-4abc-8abc-abcdefabcdef";
    data.categories[0].id = id.toUpperCase(); data.ingredients[0].categoryId = id;
    expect(parseBarBackup(JSON.stringify(data)).categories[0].id).toBe(id);
    data.categories.push({ ...data.categories[0], id, name: "另一个标签" });
    expect(() => parseBarBackup(JSON.stringify(data))).toThrow("重复值");
  });
  it.each(["category", "ingredient", "recipe"])("requires self-contained %s references", (field) => {
    const data = example();
    if (field === "category") data.ingredients[0].categoryId = testId(800);
    if (field === "ingredient") data.recipeIngredients[0].ingredientId = testId(801);
    if (field === "recipe") data.recipeIngredients[0].recipeId = testId(802);
    expect(() => parseBarBackup(JSON.stringify(data))).toThrow("不在文件中");
  });
  it("rejects unsafe URLs, invalid quantities, duplicate positions and incomplete published recipes", () => {
    const data = example();
    data.recipes[0].sourceUrl = "javascript:alert(1)";
    expect(() => parseBarBackup(JSON.stringify(data))).toThrow("sourceUrl");
    data.recipes[0].sourceUrl = "";
    data.recipeIngredients[0].amountText = "少许";
    expect(() => parseBarBackup(JSON.stringify(data))).toThrow("只能选择一种");
    data.recipeIngredients[0].amountText = "";
    data.recipeIngredients.push({ ...data.recipeIngredients[0], id: testId(803) });
    expect(() => parseBarBackup(JSON.stringify(data))).toThrow("重复值");
    data.recipeIngredients.pop(); data.recipes[0].status = "published";
    expect(() => parseBarBackup(JSON.stringify(data))).toThrow("制作步骤");
    data.recipes[0].status = "archived";
    expect(parseBarBackup(JSON.stringify(data)).recipes[0].status).toBe("archived");
  });
});
