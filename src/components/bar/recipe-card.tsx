"use client";
import { isSystemIngredient } from "@/lib/bar/constants";
import type { Ingredient, PublicRecipe } from "@/lib/bar/types";

export default function RecipeCard({ recipe, missing, dictionary, favorite, onFavorite, onOpen }: {
  recipe: PublicRecipe; missing: string[]; dictionary: Map<string, Ingredient>; favorite: boolean; onFavorite: () => void; onOpen: () => void;
}) {
  const main = [...new Set(recipe.ingredients.filter((row) => !row.isOptional).map((row) => row.ingredientId))]
    .map((id) => dictionary.get(id)).filter((i) => i && !isSystemIngredient(i.code)).map((i) => i!.name);
  return <article className="bar-card bar-stack">
    <div className="bar-row bar-between"><button type="button" className="bar-card-title" aria-label={`查看 ${recipe.name}`} onClick={onOpen}><strong>{recipe.name}</strong><span>{recipe.nameEn}</span></button>
      <button type="button" aria-label={`收藏 ${recipe.name}`} aria-pressed={favorite} onClick={onFavorite}>{favorite ? "★ 已收藏" : "☆ 收藏"}</button></div>
    <p className="bar-muted">{main.join(" / ")}</p>
    <div className="bar-row bar-between"><p className="bar-tags">{recipe.flavorTags.join(" · ")}</p><p className="bar-muted">{missing.length ? `缺少：${missing.map((id) => dictionary.get(id)?.name || "未知材料").join("、")}` : "材料齐全"}</p></div>
  </article>;
}
