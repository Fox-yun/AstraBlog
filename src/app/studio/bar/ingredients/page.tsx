import IngredientManager from "@/components/bar/ingredient-manager";
import { getOwnerIngredients, getOwnerCategories } from "@/lib/bar/queries.server";
export default async function IngredientsPage() {
  const [ingredients, categories] = await Promise.all([getOwnerIngredients(), getOwnerCategories()]);
  return <IngredientManager ingredients={ingredients} categories={categories} />;
}
