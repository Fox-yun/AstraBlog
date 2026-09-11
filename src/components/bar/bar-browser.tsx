"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { FILTER_LABELS, FILTER_MODES } from "@/lib/bar/constants";
import { filterCatalog } from "@/lib/bar/matching";
import { emptyPreferences, readPreferences, writePreferences } from "@/lib/bar/storage";
import type { BarCatalog, BarPreferences, PublicRecipe } from "@/lib/bar/types";
import IngredientPicker from "./ingredient-picker";
import RecipeCard from "./recipe-card";
import RecipeDetail from "./recipe-detail";

export default function BarBrowser({ catalog }: { catalog: BarCatalog }) {
  const [preferences, setPreferences] = useState<BarPreferences>(emptyPreferences);
  const [ready, setReady] = useState(false);
  const [warning, setWarning] = useState("");
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [detail, setDetail] = useState<PublicRecipe | null>(null);
  const modeChosen = useRef(false);
  const initialCatalog = useRef(catalog);
  useEffect(() => {
    const stored = readPreferences(initialCatalog.current);
    setPreferences(stored.preferences); modeChosen.current = stored.restored;
    setWarning(stored.warning); setReady(true);
  }, []);
  // Only interactions persist, after hydration; initial defaults never overwrite storage.
  function update(next: BarPreferences) {
    if (!ready) return;
    setPreferences(next);
    if (!writePreferences(next)) setWarning("浏览器无法保存偏好，当前搜索和筛选仍可正常使用。");
  }
  function toggleIngredient(id: string) {
    const selected = preferences.selectedIngredientIds.includes(id)
      ? preferences.selectedIngredientIds.filter((value) => value !== id) : [...preferences.selectedIngredientIds, id];
    const mode = !modeChosen.current && selected.length ? "complete" : preferences.filterMode;
    if (selected.length) modeChosen.current = true;
    update({ ...preferences, selectedIngredientIds: selected, filterMode: mode });
  }
  const results = useMemo(() => filterCatalog(catalog, preferences, query, favoritesOnly), [catalog, preferences, query, favoritesOnly]);
  const dictionary = useMemo(() => new Map(catalog.ingredients.map((item) => [item.id, item])), [catalog.ingredients]);
  return <div className="bar-surface bar-stack">
    <header className="bar-row bar-between"><h1>BAR</h1><span className="bar-muted font-mono">{catalog.recipes.length} RECIPES</span></header>
    <label>搜索酒谱<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索酒名、英文名、材料……" /></label>
    {warning && <p role="status" className="bar-muted">{warning}</p>}
    <IngredientPicker ingredients={catalog.ingredients} categories={catalog.categories} selectedIds={preferences.selectedIngredientIds} onToggle={toggleIngredient} onClear={() => update({ ...preferences, selectedIngredientIds: [] })} disabled={!ready} />
    <div className="bar-row bar-between"><div className="bar-row" aria-label="材料视图">{FILTER_MODES.map((mode) => <button type="button" key={mode} disabled={!ready} aria-pressed={preferences.filterMode === mode} onClick={() => { modeChosen.current = true; update({ ...preferences, filterMode: mode }); }}>{FILTER_LABELS[mode]}</button>)}</div>
      <label><input type="checkbox" checked={favoritesOnly} onChange={(e) => setFavoritesOnly(e.target.checked)} />仅收藏</label></div>
    <p role="status" className="bar-muted">共 {results.length} 款</p>
    <div>{results.map(({ recipe, missing }) => <RecipeCard key={recipe.id} recipe={recipe} missing={missing} dictionary={dictionary} favorite={preferences.favoriteRecipeIds.includes(recipe.id)} onOpen={() => setDetail(recipe)} onFavorite={() => update({ ...preferences, favoriteRecipeIds: preferences.favoriteRecipeIds.includes(recipe.id) ? preferences.favoriteRecipeIds.filter((id) => id !== recipe.id) : [...preferences.favoriteRecipeIds, recipe.id] })} />)}</div>
    {!results.length && <div className="bar-panel bar-stack"><h2>{catalog.recipes.length ? "没有符合条件的酒谱" : "酒单还未开张"}</h2>
      <p className="bar-muted">{catalog.recipes.length ? `当前条件：${FILTER_LABELS[preferences.filterMode]}${query ? `，搜索“${query}”` : ""}${favoritesOnly ? "，仅收藏" : ""}。` : "酒谱发布后会显示在这里。"}</p>
      {catalog.recipes.length > 0 && <button type="button" onClick={() => { modeChosen.current = true; setFavoritesOnly(false); update({ ...preferences, filterMode: "all" }); }}>在全部酒谱中搜索</button>}
    </div>}
    {detail && <RecipeDetail recipe={detail} ingredients={catalog.ingredients} onClose={() => setDetail(null)} />}
  </div>;
}
