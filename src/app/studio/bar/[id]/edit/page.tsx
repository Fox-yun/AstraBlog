import { notFound } from "next/navigation";
import RecipeEditor from "@/components/bar/recipe-editor";
import { getOwnerRecipe, getOwnerIngredients, getOwnerCategories } from "@/lib/bar/queries.server";
export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [recipe, ingredients, categories] = await Promise.all([getOwnerRecipe(id), getOwnerIngredients(), getOwnerCategories()]);
  if (!recipe) notFound();
  return <RecipeEditor key={recipe.id} recipe={recipe} ingredients={ingredients} categories={categories} />;
}
