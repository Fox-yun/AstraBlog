"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { changeBarRecipeStatus, duplicateBarRecipe, exportBarData, importBarData } from "@/actions/bar";
import { BAR_IMPORT_MAX_BYTES, BarBackupError, parseBarBackup } from "@/lib/bar/backup";
import { STATUS_LABELS } from "@/lib/bar/constants";
import { normalizeSearch } from "@/lib/bar/matching";
import type { OwnerRecipe } from "@/lib/bar/types";

type Item = Pick<OwnerRecipe, "id" | "name" | "nameEn" | "status" | "revision" | "updatedAt">;
export default function RecipeManager({ recipes }: { recipes: Item[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ categories: number; ingredients: number; recipes: number; lines: number; names: string[] } | null>(null);
  const [notice, setNotice] = useState("");
  const [importError, setImportError] = useState("");
  const run = async (task: () => Promise<void>, onError = setError) => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError(""); onError("");
    try { await task(); } catch { onError("操作失败，请检查登录状态后重试。"); }
    finally { busy.current = false; setPending(false); }
  };
  const visible = recipes.filter((recipe) => (status === "all" || recipe.status === status) && normalizeSearch(`${recipe.name} ${recipe.nameEn}`).includes(normalizeSearch(query)));
  return <div className="bar-stack">
    <div className="bar-row bar-between"><h1>酒谱管理</h1><Link href="/studio/bar/new">新建酒谱</Link></div>
    <div className="bar-fields"><label>搜索酒名<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} /></label><label>状态<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">全部状态</option>{Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
    {error && <p className="bar-error" role="alert">{error}</p>}
    <ul>{visible.map((recipe) => <li key={recipe.id} className="bar-card bar-stack"><div className="bar-row bar-between"><Link href={`/studio/bar/${recipe.id}/edit`}>{recipe.name || "未命名酒谱"}</Link><span className="bar-muted">{STATUS_LABELS[recipe.status]} · 修订 {recipe.revision}</span></div><p className="bar-muted">{recipe.nameEn}</p><div className="bar-row">
      <button disabled={pending} onClick={() => run(async () => { const result = await duplicateBarRecipe({ id: recipe.id, revision: recipe.revision }); if (!result.success) setError(result.error); else router.push(`/studio/bar/${result.data.id}/edit`); })}>复制为草稿</button>
      <button disabled={pending} onClick={() => {
        const nextStatus = recipe.status === "archived" ? "draft" : "archived";
        if (nextStatus === "archived" && !window.confirm(`将“${recipe.name || "未命名酒谱"}”归档？已发布内容会从公开酒单移除。`)) return;
        void run(async () => { const result = await changeBarRecipeStatus({ id: recipe.id, revision: recipe.revision, status: nextStatus }); if (!result.success) setError(result.error); else router.refresh(); });
      }}>{recipe.status === "archived" ? "恢复为草稿" : recipe.status === "published" ? "下架" : "归档"}</button>
    </div></li>)}</ul>
    {!visible.length && <p className="bar-muted">暂无酒谱，可以新建一份草稿。</p>}
    <section className="bar-panel bar-stack"><h2>备份导出</h2><p className="bar-muted">完整 JSON 包含所有类型标签、材料、酒谱和私人备注，可使用下方批量导入。浏览器收藏与材料选择不包含在此文件中。</p>
      <button disabled={pending} onClick={() => {
        if (!window.confirm("导出包含私人备注的完整酒单备份到当前设备？")) return;
        void run(async () => { const result = await exportBarData(); if (!result.success) { setError(result.error); return; }
          const url = URL.createObjectURL(new Blob([result.data], { type: "application/json;charset=utf-8" }));
          const anchor = document.createElement("a"); anchor.href = url; anchor.download = `astrablog-bar-${new Date().toISOString().slice(0, 10)}.json`;
          document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
      }}>导出完整 JSON（含私人备注）</button>
    </section>
    <section className="bar-panel bar-stack" aria-busy={pending}>
      <h2>JSON 批量导入</h2>
      <p className="bar-muted">选择完整导出格式的 JSON 文件，最大 5 MiB、每批最多 1,000 份酒谱。文件校验通过后会显示内容概览。</p>
      <p className="bar-muted">新酒谱统一导入为草稿；相同 ID 的已有酒谱跳过。已有类型标签和材料会复用，内容保持不变。任一条失败时整批不保存。</p>
      <label>选择酒单 JSON 文件<input ref={fileInput} type="file" accept=".json,application/json" disabled={pending} onChange={(event) => {
        const file = event.target.files?.[0];
        void run(async () => {
          setImportFile(null); setPreview(null); setNotice("");
          if (!file) return;
          try {
            if (file.size > BAR_IMPORT_MAX_BYTES) throw new BarBackupError("JSON 文件不能超过 5 MiB，请拆分后导入。");
            const data = parseBarBackup(await file.text());
            setImportFile(file);
            setPreview({ categories: data.categories.length, ingredients: data.ingredients.length,
              recipes: data.recipes.length, lines: data.recipeIngredients.length,
              names: data.recipes.slice(0, 5).map((recipe) => recipe.name || "未命名酒谱"),
            });
          } catch (error) {
            setImportError(error instanceof BarBackupError ? error.message : "无法读取文件，请重新选择。");
          }
        }, setImportError);
      }} /></label>
      {importError && <p className="bar-error" role="alert">{importError}</p>}
      {preview && <div className="bar-stack" role="status">
        <p>文件校验通过：{preview.categories} 个类型标签、{preview.ingredients} 种材料、{preview.recipes} 份酒谱、{preview.lines} 项配料。</p>
        {preview.names.length > 0 && <p className="bar-muted">酒谱预览：{preview.names.join("、")}{preview.recipes > 5 ? "……" : ""}</p>}
      </div>}
      <button className="bar-primary" disabled={pending || !importFile} onClick={() => {
        if (!importFile) return;
        void run(async () => {
          setNotice("");
          const form = new FormData(); form.set("file", importFile);
          const result = await importBarData(form);
          if (!result.success) { setImportError(result.error); return; }
          const counts = result.data;
          setNotice(`导入完成：新增 ${counts.recipesAdded} 份草稿，跳过 ${counts.recipesSkipped} 份已有酒谱；新增 ${counts.categoriesAdded} 个类型标签、${counts.ingredientsAdded} 种材料。`);
          setImportFile(null); setPreview(null);
          if (fileInput.current) fileInput.current.value = "";
          router.refresh();
        }, setImportError);
      }}>{pending ? "处理中……" : "确认导入为草稿"}</button>
      {notice && <p role="status">{notice}</p>}
    </section>
  </div>;
}
