import { db } from "@/db";
import { categories } from "@/db/schema/taxonomy";
import { asc } from "drizzle-orm";
import TaxonomyManager from "@/components/studio/TaxonomyManager";

export const revalidate = 0; // Dynamic route

export default async function StudioCategoriesPage() {
  const allCategories = await db.query.categories.findMany({
    orderBy: [asc(categories.name)],
  });

  return <TaxonomyManager type="category" initialItems={allCategories} />;
}
