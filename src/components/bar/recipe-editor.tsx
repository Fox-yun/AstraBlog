"use client";
import { useRef, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveBarRecipe } from "@/actions/bar";
import { recipeInputSchema, type RecipeInput } from "@/lib/bar/validation";
import { STATUS_LABELS } from "@/lib/bar/constants";
import type { Ingredient, IngredientCategory, OwnerRecipe, PublicRecipe } from "@/lib/bar/types";
import IngredientForm, { splitWords } from "./ingredient-form";
import IngredientSelect from "./ingredient-select";
import { BarModal } from "./modal";
import { RecipeContent } from "./recipe-detail";
import { useUnsavedChanges } from "./use-unsaved-changes";

type Fields = Omit<RecipeInput, "id" | "revision" | "status" | "aliases" | "flavorTags" | "steps"> & {
  aliasesText: string; flavorTagsText: string; steps: { text: string }[];
};
const newLine = () => ({ ingredientId: "", amount: null, unit: "", amountText: "", isOptional: false, note: "" });
function initialFields(recipe?: OwnerRecipe): Fields {
  return { name: recipe?.name ?? "", nameEn: recipe?.nameEn ?? "", aliasesText: recipe?.aliases.join("，") ?? "",
    flavorTagsText: recipe?.flavorTags.join("，") ?? "", description: recipe?.description ?? "",
    method: recipe?.method ?? "", glass: recipe?.glass ?? "", iceNote: recipe?.iceNote ?? "",
    publicNotes: recipe?.publicNotes ?? "", privateNotes: recipe?.privateNotes ?? "",
    sourceName: recipe?.sourceName ?? "", sourceUrl: recipe?.sourceUrl ?? "",
    ingredients: recipe?.ingredients.map(({ ingredientId, amount, unit, amountText, isOptional, note }) => ({ ingredientId, amount, unit, amountText, isOptional, note })) ?? [],
    steps: recipe?.steps.map((text) => ({ text })) ?? [],
  };
}
function recipeValues(values: Fields) {
  const { aliasesText, flavorTagsText, steps, ...rest } = values;
  return { ...rest, aliases: splitWords(aliasesText), flavorTags: splitWords(flavorTagsText), steps: steps.map((step) => step.text) };
}
function OrderButtons({ index, length, move, remove, noun }: { index: number; length: number; move: (from: number, to: number) => void; remove: (index: number) => void; noun: string }) {
  return <div className="bar-row"><button type="button" disabled={index === 0} aria-label={`${noun} ${index + 1} 上移`} onClick={() => move(index, index - 1)}>上移</button><button type="button" disabled={index === length - 1} aria-label={`${noun} ${index + 1} 下移`} onClick={() => move(index, index + 1)}>下移</button><button type="button" aria-label={`删除${noun} ${index + 1}`} onClick={() => remove(index)}>删除</button></div>;
}
export default function RecipeEditor({ recipe, ingredients: initialIngredients, categories }: { recipe?: OwnerRecipe; ingredients: Ingredient[]; categories: IngredientCategory[] }) {
  const router = useRouter();
  const [identity, setIdentity] = useState(recipe ? { id: recipe.id, revision: recipe.revision } : undefined);
  const [status, setStatus] = useState<OwnerRecipe["status"]>(recipe?.status ?? "draft");
  const [ingredients, setIngredients] = useState(initialIngredients);
  const [newIngredientRow, setNewIngredientRow] = useState<number | null>(null);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const saving = useRef(false);
  const { register, control, handleSubmit, setValue, reset, formState: { isDirty, isSubmitting } } = useForm<Fields>({ defaultValues: initialFields(recipe) });
  const lines = useFieldArray({ control, name: "ingredients" });
  const steps = useFieldArray({ control, name: "steps" });
  const values = useWatch({ control }) as Fields;
  useUnsavedChanges(isDirty);
  const readonly = status === "archived";
  const save = (target: "draft" | "published") => handleSubmit(async (form) => {
    if (saving.current) return;
    setError(""); setMessage("");
    const input = { ...recipeValues(form), ...identity, status: target };
    const parsed = recipeInputSchema.safeParse(input);
    if (!parsed.success) { setError(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n")); return; }
    saving.current = true;
    try {
      const result = await saveBarRecipe(parsed.data);
      if (!result.success) { setError(result.error); return; }
      setIdentity(result.data); setStatus(target); reset(form);
      setMessage(target === "published" ? "线上配方已更新。" : "草稿已保存。");
      if (!identity) router.replace(`/studio/bar/${result.data.id}/edit`);
    } catch { setError("保存失败，请检查登录状态后重试。当前输入已保留。"); }
    finally { saving.current = false; }
  });
  const previewRecipe: PublicRecipe = { ...recipeValues(values), id: identity?.id ?? "preview",
    ingredients: values.ingredients.map((line, sortOrder) => ({ ...line, sortOrder })),
  };
  return <div className="bar-stack">
    <div className="bar-row bar-between"><h1>{identity ? "编辑酒谱" : "新建酒谱"}</h1><Link href="/studio/bar">返回酒谱列表</Link></div>
    <p className="bar-muted">{STATUS_LABELS[status]}{identity ? ` · 修订 ${identity.revision}` : ""}{isDirty ? " · 有未保存的修改" : ""}</p>
    {status === "published" && <p className="bar-muted">保存会直接更新公开配方。试验新比例时，请先在列表中复制为草稿。</p>}
    {readonly && <p className="bar-muted">此酒谱已归档。请在列表中恢复为草稿后编辑。</p>}
    <form className="bar-stack" noValidate onSubmit={(event) => { void save(status === "published" ? "published" : "draft")(event); }}>
      <fieldset disabled={isSubmitting || readonly} className="bar-stack">
        <section className="bar-panel bar-stack"><h2>基础信息</h2><div className="bar-fields">
          <label>中文酒名<input {...register("name")} maxLength={160} /></label><label>英文酒名<input {...register("nameEn")} maxLength={160} /></label>
          <label>酒名别名（逗号分隔）<input {...register("aliasesText")} /></label><label>口味标签（逗号分隔）<input {...register("flavorTagsText")} /></label>
          <label className="bar-wide">简短描述<textarea {...register("description")} maxLength={500} /></label>
        </div></section>
        <section className="bar-panel bar-stack"><h2>配料明细</h2><p className="bar-muted">用量填写“数值 + 单位”或“文字用量”中的一种。可选装饰不参与缺料判断。</p>
          {lines.fields.map((field, index) => <div className="bar-panel bar-stack" key={field.id}>
            <div className="bar-row bar-between"><h3>配料 {index + 1}</h3><OrderButtons index={index} length={lines.fields.length} move={lines.move} remove={lines.remove} noun="配料" /></div>
            <IngredientSelect ingredients={ingredients} value={values.ingredients[index]?.ingredientId ?? ""} onChange={(id) => setValue(`ingredients.${index}.ingredientId`, id, { shouldDirty: true })} onCreate={() => setNewIngredientRow(index)} />
            <div className="bar-fields"><label>数值用量<input type="number" min="0.0001" step="0.0001" {...register(`ingredients.${index}.amount`, { setValueAs: (value) => value === "" || value === null ? null : Number(value) })} /></label><label>单位<input {...register(`ingredients.${index}.unit`)} placeholder="ml、g、dash、滴、片……" maxLength={30} /></label>
              <label>文字用量<input {...register(`ingredients.${index}.amountText`)} placeholder="适量、补满……" maxLength={120} /></label><label><input type="checkbox" {...register(`ingredients.${index}.isOptional`)} />可选材料</label>
              <label className="bar-wide">单项备注<input {...register(`ingredients.${index}.note`)} maxLength={500} /></label></div>
          </div>)}
          <button type="button" disabled={lines.fields.length >= 80} onClick={() => lines.append(newLine())}>增加配料</button>
        </section>
        <section className="bar-panel bar-stack"><h2>制作信息</h2><div className="bar-fields"><label>制作方式<input {...register("method")} placeholder="摇和、搅拌、直调……" maxLength={120} /></label><label>杯型<input {...register("glass")} maxLength={120} /></label><label className="bar-wide">用冰说明<textarea {...register("iceNote")} maxLength={500} placeholder="冰型、用冰时机等制作要求" /></label></div>
          {steps.fields.map((field, index) => <div key={field.id} className="bar-stack bar-panel"><div className="bar-row bar-between"><h3>步骤 {index + 1}</h3><OrderButtons index={index} length={steps.fields.length} move={steps.move} remove={steps.remove} noun="步骤" /></div><label>步骤内容<textarea {...register(`steps.${index}.text`)} maxLength={2000} /></label></div>)}
          <button type="button" disabled={steps.fields.length >= 60} onClick={() => steps.append({ text: "" })}>增加步骤</button>
        </section>
        <section className="bar-panel bar-stack"><h2>补充信息</h2><div className="bar-fields"><label className="bar-wide">公开说明<textarea {...register("publicNotes")} maxLength={10000} /></label><label>来源名称<input {...register("sourceName")} maxLength={200} /></label><label>来源链接<input type="url" {...register("sourceUrl")} maxLength={2000} placeholder="https://" /></label><label className="bar-wide">私人备注（仅 Owner 可见）<textarea {...register("privateNotes")} maxLength={10000} /></label></div></section>
      </fieldset>
      {error && <p className="bar-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
      <div className="bar-panel bar-row">
        {!readonly && <button className="bar-primary" type="submit" disabled={isSubmitting}>{isSubmitting ? "保存中……" : status === "published" ? "更新线上配方" : "保存草稿"}</button>}
        {status === "draft" && <button type="button" disabled={isSubmitting} onClick={(event) => { void save("published")(event); }}>发布</button>}
        <button type="button" disabled={isSubmitting} onClick={() => setPreview(true)}>预览当前输入</button>
      </div>
    </form>
    {newIngredientRow !== null && <BarModal titleId="new-ingredient-title" onClose={() => setNewIngredientRow(null)}><h2 id="new-ingredient-title">新增材料</h2><IngredientForm categories={categories} onSaved={(ingredient) => {
      setIngredients((current) => [...current, ingredient]); setValue(`ingredients.${newIngredientRow}.ingredientId`, ingredient.id, { shouldDirty: true }); setNewIngredientRow(null);
    }} onCancel={() => setNewIngredientRow(null)} /></BarModal>}
    {preview && <BarModal titleId="bar-recipe-title" onClose={() => setPreview(false)}><RecipeContent recipe={previewRecipe} ingredients={ingredients} /><section className="bar-panel bar-stack"><h3>私人备注 · 仅后台预览</h3><p className="whitespace-pre-wrap">{values.privateNotes || "未填写"}</p></section></BarModal>}
  </div>;
}
