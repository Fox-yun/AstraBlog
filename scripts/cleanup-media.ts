import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { dbQuery, withTransaction } from "../src/db";
import { media, mediaReferences } from "../src/db/schema/media";
import { s3Client, R2_BUCKET } from "../src/lib/r2";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { and, eq, lt } from "drizzle-orm";

async function main() {
  console.log("🧹 Starting Cloudflare R2 media cleanup task...");

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days

  // ==========================================
  // 1. Clean up Pending uploads older than 24h
  // ==========================================
  console.log("⏳ Checking for expired pending uploads...");
  const expiredPending = await dbQuery.query.media.findMany({
    where: and(eq(media.status, "pending"), lt(media.createdAt, twentyFourHoursAgo)),
  });

  console.log(`Found ${expiredPending.length} expired pending uploads.`);
  for (const item of expiredPending) {
    try {
      console.log(`Deleting pending R2 object: ${item.objectKey}`);
      const deleteCmd = new DeleteObjectCommand({
        Bucket: R2_BUCKET,
        Key: item.objectKey,
      });
      await s3Client.send(deleteCmd);
    } catch (s3Err: any) {
      console.warn(`S3 Delete warn for pending object ${item.objectKey}: ${s3Err.message}`);
    }

    // Hard delete pending media from database inside transaction
    await withTransaction(async (tx) => {
      await tx.delete(media).where(eq(media.id, item.id));
    });
    console.log(`Removed pending database record ID: ${item.id}`);
  }

  // ==========================================
  // 2. Clean up Orphaned uploads older than 7 days
  // ==========================================
  console.log("⏳ Checking for expired orphaned uploads...");
  const expiredOrphaned = await dbQuery.query.media.findMany({
    where: and(eq(media.status, "orphaned"), lt(media.updatedAt, sevenDaysAgo)),
  });

  console.log(`Found ${expiredOrphaned.length} expired orphaned uploads.`);
  let activePurgedCount = 0;

  for (const item of expiredOrphaned) {
    // Check if there are any media references pointing to this media ID
    const hasReference = await dbQuery.query.mediaReferences.findFirst({
      where: eq(mediaReferences.mediaId, item.id),
    });

    if (hasReference) {
      console.log(`Skipping orphaned media ID ${item.id} - referenced by resource: ${hasReference.resourceType}/${hasReference.resourceId}`);
      continue;
    }

    // No active references exist: delete from R2 and mark as deleted in DB
    try {
      console.log(`Purging orphaned R2 object: ${item.objectKey}`);
      const deleteCmd = new DeleteObjectCommand({
        Bucket: R2_BUCKET,
        Key: item.objectKey,
      });
      await s3Client.send(deleteCmd);
    } catch (s3Err: any) {
      console.warn(`S3 Delete error for orphaned object ${item.objectKey}: ${s3Err.message}`);
    }

    // Soft-delete: update status to 'deleted'
    await withTransaction(async (tx) => {
      await tx
        .update(media)
        .set({
          status: "deleted",
          updatedAt: new Date(),
        })
        .where(eq(media.id, item.id));
    });

    activePurgedCount++;
    console.log(`Set database status to 'deleted' for media ID: ${item.id}`);
  }

  console.log(`✅ Cleanup completed. Purged pending: ${expiredPending.length}, Purged orphaned: ${activePurgedCount}.`);
}

main()
  .catch((err) => {
    console.error("❌ Media cleanup script failed:", err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
