import { db } from "@/db";
import { tags } from "@/db/schema/taxonomy";
import { asc } from "drizzle-orm";
import TaxonomyManager from "@/components/studio/TaxonomyManager";

export const revalidate = 0; // Dynamic route

export default async function StudioTagsPage() {
  const allTags = await db.query.tags.findMany({
    orderBy: [asc(tags.name)],
  });

  return <TaxonomyManager type="tag" initialItems={allTags} />;
}
