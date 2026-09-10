"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { saveBarCategory, deleteBarCategory } from "@/actions/bar";
import type { IngredientCategory } from "@/lib/bar/types";
import { categoryInputSchema } from "@/lib/bar/validation";
import { BarModal } from "./modal";

function CategoryForm({ category, onSaved }: { category?: IngredientCategory; onSaved: () => void }) {
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<{ name: string; sortOrder: number }>({ defaultValues: { name: category?.name ?? "", sortOrder: category?.sortOrder ?? 0 } });
  return <form className="bar-stack" noValidate onSubmit={handleSubmit(async (values) => {
    setError("");
    const parsed = categoryInputSchema.safeParse(values);
    if (!parsed.success) { setError(parsed.error.issues.map((issue) => issue.message).join("；")); return; }
    try {
      const result = await saveBarCategory({ ...parsed.data, ...(category ? { id: category.id } : {}) });
      if (!result.success) setError(result.error); else onSaved();
    } catch { setError("保存失败，请检查登录状态后重试。"); }
  })}>
    <fieldset disabled={isSubmitting} className="bar-stack"><label>标签名称<input {...register("name")} maxLength={80} placeholder="例如：金酒、朗姆、威士忌" /></label><label>展示顺序<input type="number" {...register("sortOrder", { valueAsNumber: true })} /></label></fieldset>
    {error && <p role="alert" className="bar-error">{error}</p>}<button type="submit" className="bar-primary" disabled={isSubmitting}>{isSubmitting ? "保存中……" : "保存标签"}</button>
  </form>;
}
export default function CategoryManager({ categories }: { categories: IngredientCategory[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<IngredientCategory | "new" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <div className="bar-stack">
    <div className="bar-row bar-between"><h1>材料类型标签</h1><button type="button" onClick={() => setEditing("new")}>新增标签</button></div>
    <p className="bar-muted">使用金酒、朗姆、威士忌等具体类型组织材料。标签可以改名和调整顺序；删除前请先把其中的材料移至其他类型。</p>
    {error && <p role="alert" className="bar-error">{error}</p>}
    <ul>{categories.map((category) => <li key={category.id} className="bar-card bar-row bar-between"><div>{category.name}<span className="bar-muted"> · 顺序 {category.sortOrder}</span></div><div className="bar-row"><button type="button" disabled={pending} onClick={() => setEditing(category)}>编辑标签</button><button type="button" disabled={pending} onClick={async () => {
      if (!window.confirm(`删除“${category.name}”标签？其中仍有材料时无法删除。`)) return;
      setPending(true); setError("");
      try { const result = await deleteBarCategory(category.id); if (!result.success) setError(result.error); else router.refresh(); }
      catch { setError("删除失败，请检查登录状态后重试。"); } finally { setPending(false); }
    }}>删除标签</button></div></li>)}</ul>
    {!categories.length && <p className="bar-muted">暂无类型标签，请新增。</p>}
    {editing && <BarModal titleId="category-form-title" onClose={() => setEditing(null)}><h2 id="category-form-title">{editing === "new" ? "新增类型标签" : "编辑类型标签"}</h2><CategoryForm category={editing === "new" ? undefined : editing} onSaved={() => { setEditing(null); router.refresh(); }} /></BarModal>}
  </div>;
}
