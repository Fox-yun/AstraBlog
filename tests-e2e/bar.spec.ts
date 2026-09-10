import { test, expect, type Page } from "@playwright/test";
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { PREFERENCES_KEY } from "../src/lib/bar/storage";
import { testId } from "../src/lib/bar/fixtures.test-support";

let publicBundle: string;
let editorBundle: string;
test.beforeAll(async () => {
  const compile = async (source: string) => (await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: "tsx" },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' },
    plugins: [{ name: "isolated-editor-actions", setup(builder) {
      builder.onResolve({ filter: /^(@\/actions\/bar|next\/navigation|next\/link)$/ }, (args) => ({ path: args.path, namespace: "bar-test" }));
      builder.onLoad({ filter: /.*/, namespace: "bar-test" }, (args) => {
        if (args.path === "next/navigation") return { contents: 'export const useRouter = () => ({replace() {}, refresh() {}, push() {}});', loader: "js" };
        if (args.path === "next/link") return { contents: 'export default function Link() { return null; }', loader: "js" };
        return { contents: `export async function saveBarRecipe(input) { window.__lastSaved = input; return input.name === '冲突测试' ? {success:false,error:'内容已被其他页面更新。'} : {success:true,data:{id:'${testId(20)}',revision:(input.revision || 0)+1}}; }
          export async function saveBarIngredient(input) {return {success:true,data:{...input,id:'${testId(90)}'}};}`, loader: "js" };
      });
    } }],
  })).outputFiles[0].text;
  publicBundle = await compile(`import {createRoot} from 'react-dom/client'; import BarBrowser from './src/components/bar/bar-browser'; import {testCatalog} from './src/lib/bar/fixtures.test-support'; createRoot(document.getElementById('root')).render(<BarBrowser catalog={testCatalog()}/>);`);
  editorBundle = await compile(`import {createRoot} from 'react-dom/client'; import RecipeEditor from './src/components/bar/recipe-editor'; import {testIngredients,testCategories} from './src/lib/bar/fixtures.test-support'; createRoot(document.getElementById('root')).render(<RecipeEditor ingredients={testIngredients} categories={testCategories}/>);`);
});

async function openFixture(page: Page, editor = false) {
  const css = readFileSync("src/components/bar/bar.css", "utf8");
  await page.route("**/__bar-fixture", (route) => route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="zh"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root {--color-bg-void:#09090b;--color-bg-surface:#18181b;--color-text-primary:#fafafa;--color-text-muted:#a1a1aa;--color-border-base:#27272a;--color-accent-amber:#d4af37;}*{box-sizing:border-box}body{background:#09090b;color:#fafafa;font-family:system-ui;margin:0;padding:20px}button,input,textarea,select{font:inherit;background:#18181b;color:#fafafa;padding:8px;border:1px solid #27272a}ul{list-style:none;padding:0}#root{max-width:850px;margin:auto}${css}</style></head><body><div id="root"></div><script>${(editor ? editorBundle : publicBundle).replaceAll("</script", "<\\/script")}</script></body></html>` }));
  await page.goto("http://localhost:3000/__bar-fixture");
}

test("concrete material labels preserve cross-category selections, ice/water rules and local-only interactions", async ({ page }) => {
  await openFixture(page);
  await expect(page.getByRole("button", { name: "全部酒谱", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "冰", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "普通饮用水", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "基酒", exact: true })).toHaveCount(0);
  const requests: string[] = []; page.on("request", (request) => requests.push(request.url()));
  await page.getByRole("button", { name: "伦敦干金酒", exact: true }).click();
  await expect(page.getByRole("button", { name: "材料齐全", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "查看 金酒水", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "朗姆", exact: true }).click();
  await page.getByRole("button", { name: "白朗姆", exact: true }).click();
  await expect(page.getByText("已选 2 种", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "查看 金酒水", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "最多缺一种", exact: true }).click();
  await page.getByRole("searchbox").fill("ＧＩＮ 气泡水");
  await expect(page.getByRole("button", { name: "查看 金酒苏打", exact: true })).toBeVisible();
  await expect(page.getByText("缺少：苏打水", { exact: true })).toBeVisible();
  const trigger = page.getByRole("button", { name: "查看 金酒苏打", exact: true });
  await trigger.click(); await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).toHaveCount(0); await expect(trigger).toBeFocused();
  await page.getByRole("button", { name: "收藏 金酒苏打", exact: true }).click();
  await page.getByRole("button", { name: "清空材料", exact: true }).click();
  await expect(page.getByRole("searchbox")).toHaveValue("ＧＩＮ 气泡水");
  await expect(page.getByRole("button", { name: "最多缺一种", exact: true })).toHaveAttribute("aria-pressed", "true");
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), PREFERENCES_KEY);
  expect(stored.favoriteRecipeIds).toEqual([testId(21)]); expect(stored.selectedIngredientIds).toEqual([]);
  expect(requests).toEqual([]);
});

test("restores preferences and preserves explicit all mode while selecting ingredients", async ({ page }) => {
  await page.addInitScript(({ key, gin, recipe }) => localStorage.setItem(key, JSON.stringify({ selectedIngredientIds: [gin, "unknown"], favoriteRecipeIds: [recipe], filterMode: "all" })), { key: PREFERENCES_KEY, gin: testId(1), recipe: testId(20) });
  await openFixture(page);
  await expect(page.getByText("已选 1 种", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "朗姆", exact: true }).click(); await page.getByRole("button", { name: "白朗姆", exact: true }).click();
  await expect(page.getByRole("button", { name: "全部酒谱", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("checkbox", { name: "仅收藏" }).check(); await expect(page.getByRole("article")).toHaveCount(1);
});

test("blocked storage and mobile details remain usable without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }));
  await openFixture(page); await expect(page.getByText(/无法恢复本地偏好/)).toBeVisible();
  await page.getByRole("button", { name: "伦敦干金酒", exact: true }).click();
  await page.getByRole("button", { name: "查看 金酒水", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole("heading", { name: "原料与用量" })).toBeVisible();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(page.getByRole("button", { name: "查看 金酒水", exact: true })).toBeFocused();
});

test("editor adds dictionary entries, sorts rows, preserves failed input, then saves and publishes", async ({ page }) => {
  await openFixture(page, true);
  await page.getByRole("textbox", { name: "中文酒名", exact: true }).fill("冲突测试");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.evaluate(() => window.history.back());
  await expect(page.getByRole("textbox", { name: "中文酒名", exact: true })).toHaveValue("冲突测试");
  await page.getByRole("button", { name: "增加配料", exact: true }).click();
  await page.getByRole("button", { name: "找不到？新增材料", exact: true }).click();
  const modal = page.getByRole("dialog");
  await modal.getByRole("textbox", { name: "名称", exact: true }).fill("测试金酒");
  await modal.getByRole("textbox", { name: /固定标识/ }).fill("test_gin");
  await modal.getByRole("combobox", { name: "材料类型标签", exact: true }).selectOption(testId(100));
  await modal.getByRole("button", { name: "保存材料", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "材料", exact: true })).toHaveValue(testId(90));
  await page.getByRole("spinbutton", { name: "数值用量", exact: true }).fill("30");
  await page.getByRole("textbox", { name: "单位", exact: true }).fill("ml");
  await page.getByRole("button", { name: "增加步骤", exact: true }).click();
  await page.getByRole("textbox", { name: "步骤内容", exact: true }).fill("先加入金酒");
  await page.getByRole("button", { name: "增加步骤", exact: true }).click();
  await page.getByRole("textbox", { name: "步骤内容", exact: true }).nth(1).fill("再搅拌");
  await page.getByRole("button", { name: "步骤 2 上移", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "步骤内容", exact: true }).first()).toHaveValue("再搅拌");
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("内容已被其他页面更新");
  await expect(page.getByRole("textbox", { name: "中文酒名", exact: true })).toHaveValue("冲突测试");
  await page.getByRole("textbox", { name: "中文酒名", exact: true }).fill("测试酒谱");
  await page.getByRole("textbox", { name: "私人备注（仅 Owner 可见）", exact: true }).fill("后台可见");
  await page.getByRole("button", { name: "预览当前输入", exact: true }).click();
  await expect(modal.getByText("后台可见", { exact: true })).toBeVisible(); await modal.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await expect(page.getByRole("button", { name: "更新线上配方", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("线上配方已更新");
});

test("real public route responds and unauthenticated Studio redirects to login", async ({ page }) => {
  const response = await page.goto("/bar"); expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "BAR / 我的酒谱" })).toBeVisible();
  await page.goto("/studio/bar/categories"); await expect(page).toHaveURL(/\/auth\/login/);
});
