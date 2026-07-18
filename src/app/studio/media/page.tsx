import { desc, ne } from "drizzle-orm";
import { dbQuery } from "@/db";
import { media } from "@/db/schema/media";
import MediaManager from "@/components/studio/MediaManager";

export const revalidate = 0;

export default async function StudioMediaPage() {
  const records = await dbQuery.query.media.findMany({
    where: ne(media.status, "deleted"),
    orderBy: [desc(media.createdAt)],
    limit: 100,
  });
  const publicBase = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "") || "";

  const items = records.map((record) => ({
    id: record.id,
    filename: record.originalFilename,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    altText: record.altText,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    publicUrl: publicBase ? `${publicBase}/${record.objectKey}` : null,
    objectKey: record.objectKey,
  }));

  return (
    <div className="space-y-6 w-full">
      <header className="border-b border-border-base pb-3">
        <h2 className="text-sm font-serif font-light tracking-widest uppercase">MEDIA LIBRARY</h2>
        <p className="text-[10px] font-mono text-text-muted mt-0.5">
          UPLOAD IMAGES AND COPY PORTABLE MARKDOWN REFERENCES
        </p>
      </header>
      <MediaManager items={items} />
    </div>
  );
}
