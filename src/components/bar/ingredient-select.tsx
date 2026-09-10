"use client";
import { useId, useState } from "react";
import type { Ingredient } from "@/lib/bar/types";
import { normalizeSearch } from "@/lib/bar/matching";

export default function IngredientSelect({ ingredients, value, onChange, onCreate }: {
  ingredients: Ingredient[]; value: string; onChange: (id: string) => void; onCreate: () => void;
}) {
  const [query, setQuery] = useState("");
  const id = useId();
  const visible = ingredients.filter((item) => item.id === value || normalizeSearch([item.name, item.nameEn, ...item.aliases].join(" ")).includes(normalizeSearch(query)));
  return <div className="bar-stack bar-wide">
    <div className="bar-fields"><label htmlFor={`${id}-search`}>搜索字典<input id={`${id}-search`} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="名称或别名" /></label>
      <label>材料<select value={value} onChange={(e) => onChange(e.target.value)}><option value="">请选择材料</option>{visible.map((item) => <option key={item.id} value={item.id}>{item.name}{item.nameEn ? ` / ${item.nameEn}` : ""}</option>)}</select></label></div>
    <button type="button" onClick={onCreate}>找不到？新增材料</button>
  </div>;
}
