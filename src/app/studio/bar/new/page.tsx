import RecipeEditor from "@/components/bar/recipe-editor";
import { getOwnerIngredients, getOwnerCategories } from "@/lib/bar/queries.server";
export default async function NewRecipePage() {
  const [ingredients, categories] = await Promise.all([getOwnerIngredients(), getOwnerCategories()]);
  return <RecipeEditor ingredients={ingredients} categories={categories} />;
}
