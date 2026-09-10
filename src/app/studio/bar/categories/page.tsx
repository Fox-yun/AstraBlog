import CategoryManager from "@/components/bar/category-manager";
import { getOwnerCategories } from "@/lib/bar/queries.server";
export default async function CategoriesPage() { return <CategoryManager categories={await getOwnerCategories()} />; }
