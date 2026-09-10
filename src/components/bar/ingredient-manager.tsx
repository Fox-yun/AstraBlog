"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteBarIngredient } from "@/actions/bar";
import { isSystemIngredient } from "@/lib/bar/constants";
import { normalizeSearch } from "@/lib/bar/matching";
import type { Ingredient, IngredientCategory } from "@/lib/bar/types";
import IngredientForm from "./ingredient-form";
import { BarModal } from "./modal";

export default function IngredientManager({ ingredients, categories }: { ingredients: Ingredient[]; categories: IngredientCategory[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Ingredient | "new" | null>(null);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const visible = ingredients.filter((item) => normalizeSearch([item.name, item.nameEn, item.code, ...item.aliases].join(" ")).includes(normalizeSearch(query)));
  return <div className="bar-stack">
    <div className="bar-row bar-between"><h1>材料字典</h1><button type="button" onClick={() => setEditing("new")}>新增材料</button></div>
    <p className="bar-muted">冰和普通饮用水为系统材料。已被酒谱引用的材料需要先处理引用才能删除。</p>
    <label>搜索材料<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
    {error && <p role="alert" className="bar-error">{error}</p>}
    <ul>{visible.map((item) => <li key={item.id} className="bar-card bar-row bar-between"><div>{item.name} <span className="bar-muted">{item.nameEn} · {categories.find((category) => category.id === item.categoryId)?.name}{isSystemIngredient(item.code) ? " · 系统材料" : ""}</span><p className="bar-muted font-mono">{item.code}</p></div>
      <div className="bar-row"><button type="button" disabled={pending} onClick={() => setEditing(item)}>编辑</button>{!isSystemIngredient(item.code) && <button type="button" disabled={pending} onClick={async () => {
        if (!window.confirm(`删除材料“${item.name}”？已被引用的材料不能删除。`)) return;
        setPending(true); setError("");
        try { const result = await deleteBarIngredient(item.id); if (!result.success) setError(result.error); else router.refresh(); }
        catch { setError("删除失败，请检查登录状态后重试。"); } finally { setPending(false); }
      }}>删除</button>}</div></li>)}</ul>
    {!visible.length && <p className="bar-muted">没有匹配的材料。</p>}
    {editing && <BarModal titleId="ingredient-form-title" onClose={() => setEditing(null)}><h2 id="ingredient-form-title">{editing === "new" ? "新增材料" : "编辑材料"}</h2><IngredientForm ingredient={editing === "new" ? undefined : editing} categories={categories} onSaved={() => { setEditing(null); router.refresh(); }} onCancel={() => setEditing(null)} /></BarModal>}
  </div>;
}
