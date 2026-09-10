"use client";
import type { Ingredient, PublicRecipe } from "@/lib/bar/types";
import { isSafeSourceUrl } from "@/lib/bar/urls";
import { BarModal } from "./modal";

export function RecipeContent({ recipe, ingredients }: { recipe: PublicRecipe; ingredients: Ingredient[] }) {
  const dictionary = new Map(ingredients.map((item) => [item.id, item]));
  return <>
    <header><h2 id="bar-recipe-title">{recipe.name || "未命名酒谱"}</h2><p className="bar-muted">{recipe.nameEn}</p></header>
    <section className="bar-stack"><h3>原料与用量</h3>
      <ul className="bar-recipe-lines">{recipe.ingredients.map((line, i) => <li key={i}>
        <div>{dictionary.get(line.ingredientId)?.name || "请选择材料"}{line.isOptional && <span className="bar-muted"> · 可选</span>}
          {line.note && <p className="bar-muted">{line.note}</p>}</div>
        <span className="bar-amount">{line.amountText || (line.amount !== null ? `${line.amount} ${line.unit}` : "待补充")}</span>
      </li>)}</ul>
    </section>
    <section className="bar-stack"><h3>制作步骤</h3><ol className="bar-steps">{recipe.steps.map((step, i) => <li key={i}>{step || "待补充"}</li>)}</ol></section>
    <dl className="bar-fields bar-panel">{[["杯型", recipe.glass], ["用冰", recipe.iceNote], ["制作方式", recipe.method]].map(([label, value]) => <div key={label}><dt className="bar-muted">{label}</dt><dd>{value || "未填写"}</dd></div>)}</dl>
    {(recipe.description || recipe.publicNotes) && <section className="bar-stack"><h3>说明</h3><p className="whitespace-pre-wrap">{recipe.description}</p><p className="whitespace-pre-wrap">{recipe.publicNotes}</p></section>}
    {(recipe.sourceName || recipe.sourceUrl) && <p className="bar-muted">来源：{recipe.sourceUrl && isSafeSourceUrl(recipe.sourceUrl)
      ? <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">{recipe.sourceName || recipe.sourceUrl}</a> : recipe.sourceName}</p>}
  </>;
}
export default function RecipeDetail({ recipe, ingredients, onClose }: { recipe: PublicRecipe; ingredients: Ingredient[]; onClose: () => void }) {
  return <BarModal titleId="bar-recipe-title" onClose={onClose}><RecipeContent recipe={recipe} ingredients={ingredients} /></BarModal>;
}
