"use client";
import { useState } from "react";
import { isSystemIngredient } from "@/lib/bar/constants";
import type { Ingredient, IngredientCategory } from "@/lib/bar/types";

export default function IngredientPicker({ ingredients, categories, selectedIds, onToggle, onClear, disabled }: {
  ingredients: Ingredient[]; categories: IngredientCategory[]; selectedIds: string[]; onToggle: (id: string) => void; onClear: () => void; disabled: boolean;
}) {
  const [category, setCategory] = useState(categories[0]?.id ?? "");
  const activeCategory = categories.some((item) => item.id === category) ? category : categories[0]?.id;
  const [collapsed, setCollapsed] = useState(false);
  const ordinary = ingredients.filter((item) => !isSystemIngredient(item.code));
  const selected = new Set(selectedIds);
  return <section className="bar-panel bar-stack" aria-label="我的材料">
    <div className="bar-row bar-between"><h2>我的材料</h2><span className="bar-muted">已选 {selected.size} 种</span></div>
    <p className="bar-muted"></p>
    {collapsed ? <p className="bar-muted">{ordinary.filter((i) => selected.has(i.id)).map((i) => i.name).slice(0, 6).join("、") || "尚未选择材料"}{selected.size > 6 ? "……" : ""}</p> : <>
      <div className="bar-row" aria-label="材料类型标签">{categories.map((item) => <button type="button" key={item.id} aria-pressed={activeCategory === item.id} onClick={() => setCategory(item.id)}>{item.name}</button>)}</div>
      <div className="bar-row" aria-label="材料标签">{ordinary.filter((item) => item.categoryId === activeCategory).map((item) => <button type="button" key={item.id} disabled={disabled} aria-pressed={selected.has(item.id)} onClick={() => onToggle(item.id)}>{selected.has(item.id) && <span aria-hidden="true">✓ </span>}{item.name}</button>)}
        {!ordinary.some((item) => item.categoryId === activeCategory) && <p className="bar-muted">暂无已发布酒谱使用的材料。</p>}
      </div>
    </>}
    <div className="bar-row bar-between"><button type="button" aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>{collapsed ? "展开材料" : "收起材料"}</button><button type="button" disabled={disabled || !selected.size} onClick={onClear}>清空材料</button></div>
  </section>;
}
