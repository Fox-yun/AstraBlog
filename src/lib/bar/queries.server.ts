import "server-only";
import { dbQuery } from "@/db";
import { barIngredientCategories, barIngredients, barRecipes, barRecipeIngredients } from "@/db/schema/bar";
import { requireOwner } from "@/lib/authorization";
import { asc, desc, eq } from "drizzle-orm";
import { idSchema } from "./validation";
import type { BarCatalog, Ingredient, IngredientCategory, PublicRecipe } from "./types";
import { isSystemIngredient } from "./constants";

// Explicit SQL projection: private fields never leave the database in this query.
export const publicRecipeColumns = {
  id: barRecipes.id, name: barRecipes.name, nameEn: barRecipes.nameEn, aliases: barRecipes.aliases,
  description: barRecipes.description, flavorTags: barRecipes.flavorTags, method: barRecipes.method,
  glass: barRecipes.glass, iceNote: barRecipes.iceNote, steps: barRecipes.steps,
  publicNotes: barRecipes.publicNotes, sourceName: barRecipes.sourceName, sourceUrl: barRecipes.sourceUrl,
};
export const publicIngredientColumns = {
  id: barIngredients.id, code: barIngredients.code, name: barIngredients.name,
  nameEn: barIngredients.nameEn, aliases: barIngredients.aliases,
  categoryId: barIngredients.categoryId, sortOrder: barIngredients.sortOrder,
};
export const publicLineColumns = {
  ingredientId: barRecipeIngredients.ingredientId, amount: barRecipeIngredients.amount,
  unit: barRecipeIngredients.unit, amountText: barRecipeIngredients.amountText,
  isOptional: barRecipeIngredients.isOptional, note: barRecipeIngredients.note, sortOrder: barRecipeIngredients.sortOrder,
};

export async function getPublicBarCatalog(): Promise<BarCatalog> {
  if (!process.env.DATABASE_URL) return { recipes: [], ingredients: [], categories: [] };
  // One statement gives a consistent snapshot, including publication status and dictionary visibility.
  const rows = await dbQuery.select({ recipe: publicRecipeColumns, line: publicLineColumns, ingredient: publicIngredientColumns,
    category: { id: barIngredientCategories.id, name: barIngredientCategories.name, sortOrder: barIngredientCategories.sortOrder },
  })
    .from(barRecipes)
    .leftJoin(barRecipeIngredients, eq(barRecipeIngredients.recipeId, barRecipes.id))
    .leftJoin(barIngredients, eq(barIngredients.id, barRecipeIngredients.ingredientId))
    .leftJoin(barIngredientCategories, eq(barIngredientCategories.id, barIngredients.categoryId))
    .where(eq(barRecipes.status, "published"))
    .orderBy(asc(barRecipes.name), asc(barRecipeIngredients.sortOrder));
  const recipes = new Map<string, PublicRecipe>();
  const ingredients = new Map<string, Ingredient>();
  const categories = new Map<string, IngredientCategory>();
  for (const row of rows) {
    if (!recipes.has(row.recipe.id)) recipes.set(row.recipe.id, { ...row.recipe, ingredients: [] });
    if (row.line && row.ingredient) {
      recipes.get(row.recipe.id)!.ingredients.push(row.line);
      ingredients.set(row.ingredient.id, row.ingredient);
      if (row.category && !isSystemIngredient(row.ingredient.code)) categories.set(row.category.id, row.category);
    }
  }
  return {
    recipes: [...recipes.values()],
    ingredients: [...ingredients.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "zh-CN") || a.id.localeCompare(b.id)),
    categories: [...categories.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "zh-CN") || a.id.localeCompare(b.id)),
  };
}

export async function getOwnerCategories() {
  await requireOwner();
  return dbQuery.select().from(barIngredientCategories).orderBy(asc(barIngredientCategories.sortOrder), asc(barIngredientCategories.name));
}

export async function getOwnerIngredients() {
  await requireOwner();
  return dbQuery.select().from(barIngredients).orderBy(asc(barIngredients.sortOrder), asc(barIngredients.name));
}
export async function getOwnerRecipes() {
  await requireOwner();
  return dbQuery.select({ id: barRecipes.id, name: barRecipes.name, nameEn: barRecipes.nameEn,
    status: barRecipes.status, revision: barRecipes.revision, updatedAt: barRecipes.updatedAt })
    .from(barRecipes).orderBy(desc(barRecipes.updatedAt));
}
export async function getOwnerRecipe(id: string) {
  await requireOwner();
  if (!idSchema.safeParse(id).success) return null;
  return await dbQuery.query.barRecipes.findFirst({ where: eq(barRecipes.id, id),
    with: { ingredients: { orderBy: [asc(barRecipeIngredients.sortOrder)] } },
  }) ?? null;
}
