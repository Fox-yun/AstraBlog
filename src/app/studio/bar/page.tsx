import RecipeManager from "@/components/bar/recipe-manager";
import { getOwnerRecipes } from "@/lib/bar/queries.server";
export default async function RecipesPage() {
  return <RecipeManager recipes={await getOwnerRecipes()} />;
}
