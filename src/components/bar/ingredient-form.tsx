"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { saveBarIngredient } from "@/actions/bar";
import { ingredientInputSchema, type IngredientInput } from "@/lib/bar/validation";
import type { Ingredient, IngredientCategory } from "@/lib/bar/types";

type Fields = Omit<IngredientInput, "aliases"> & { aliasesText: string };
export const splitWords = (text: string) => text.split(/[,，\n]/).map((word) => word.trim()).filter(Boolean);
export default function IngredientForm({ ingredient, categories, onSaved, onCancel }: { ingredient?: Ingredient; categories: IngredientCategory[]; onSaved: (value: Ingredient) => void; onCancel: () => void }) {
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<Fields>({ defaultValues: {
    code: ingredient?.code ?? "", name: ingredient?.name ?? "", nameEn: ingredient?.nameEn ?? "",
    aliasesText: ingredient?.aliases.join("，") ?? "", categoryId: ingredient?.categoryId ?? categories[0]?.id ?? "", sortOrder: ingredient?.sortOrder ?? 0,
  } });
  return <form className="bar-stack" noValidate onSubmit={handleSubmit(async (values) => {
    setError("");
    const parsed = ingredientInputSchema.safeParse({ ...values, aliases: splitWords(values.aliasesText) });
    if (!parsed.success) { setError(parsed.error.issues.map((i) => i.message).join("；")); return; }
    try {
      const result = await saveBarIngredient({ ...parsed.data, ...(ingredient ? { id: ingredient.id } : {}) });
      if (!result.success) { setError(result.error); return; }
      onSaved(result.data);
    } catch { setError("保存失败，请检查登录状态后重试。输入已保留。"); }
  })}>
    <fieldset disabled={isSubmitting} className="bar-fields">
      <label>名称<input {...register("name")} maxLength={120} /></label>
      <label>英文名<input {...register("nameEn")} maxLength={160} /></label>
      <label>固定标识<input {...register("code")} readOnly={Boolean(ingredient)} placeholder="例如 soda_water" /><span className="bar-muted">创建后不能修改。</span></label>
      <label>材料类型标签<select {...register("categoryId")}><option value="">请选择类型</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
      <label>别名（逗号分隔）<input {...register("aliasesText")} /></label>
      <label>展示顺序<input type="number" {...register("sortOrder", { valueAsNumber: true })} /></label>
    </fieldset>
    {error && <p className="bar-error" role="alert">{error}</p>}
    <div className="bar-row"><button type="submit" className="bar-primary" disabled={isSubmitting}>{isSubmitting ? "保存中……" : "保存材料"}</button><button type="button" disabled={isSubmitting} onClick={onCancel}>取消</button></div>
  </form>;
}
