"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { changeBarRecipeStatus, duplicateBarRecipe, exportBarData } from "@/actions/bar";
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
  const run = async (task: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError("");
    try { await task(); } catch { setError("操作失败，请检查登录状态后重试。"); }
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
    <section className="bar-panel bar-stack"><h2>备份导出</h2><p className="bar-muted">完整 JSON 包含所有酒谱、材料和私人备注，请妥善保管。浏览器收藏与材料选择不包含在此文件中。</p>
      <button disabled={pending} onClick={() => {
        if (!window.confirm("导出包含私人备注的完整酒单备份到当前设备？")) return;
        void run(async () => { const result = await exportBarData(); if (!result.success) { setError(result.error); return; }
          const url = URL.createObjectURL(new Blob([result.data], { type: "application/json;charset=utf-8" }));
          const anchor = document.createElement("a"); anchor.href = url; anchor.download = `astrablog-bar-${new Date().toISOString().slice(0, 10)}.json`;
          document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
      }}>导出完整 JSON（含私人备注）</button>
    </section>
  </div>;
}
