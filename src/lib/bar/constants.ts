export const SYSTEM_INGREDIENT_CODES = ["ice", "water"] as const;
export const isSystemIngredient = (code: string) =>
  SYSTEM_INGREDIENT_CODES.some((value) => value === code);

export const FILTER_MODES = ["complete", "one-missing", "all"] as const;
export const FILTER_LABELS = { complete: "材料齐全", "one-missing": "最多缺一种", all: "全部酒谱" };
export const STATUS_LABELS = { draft: "草稿", published: "已发布", archived: "已归档" };
