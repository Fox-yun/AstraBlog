import { NextResponse } from "next/server";
import { withTransaction } from "@/db";
import { posts } from "@/db/schema/posts";
import { auditLogs } from "@/db/schema/audit";
import { and, eq, lte } from "drizzle-orm";
import { revalidateTag } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // Verify request authorization headers to protect endpoints
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json(
        { error: "SERVICE_UNAVAILABLE: CRON_SECRET is not configured" },
        { status: 503 },
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "UNAUTHORIZED: Invalid cron secret" }, { status: 401 });
    }

    const now = new Date();
    const publishedIds: string[] = [];
    const publishedSlugs: { id: string; slug: string; type: string }[] = [];

    // Run lock check and updates within withTransaction callback
    await withTransaction(async (tx) => {
      // 1. Fetch eligible scheduled posts utilizing FOR UPDATE SKIP LOCKED row locking (capped to batch size of 50)
      const scheduledList = await tx
        .select({
          id: posts.id,
          title: posts.title,
          slug: posts.slug,
          type: posts.type,
          revision: posts.revision,
        })
        .from(posts)
        .where(
          and(
            eq(posts.status, "scheduled"),
            lte(posts.scheduledAt, now)
          )
        )
        .limit(50)
        .for("update", { skipLocked: true });

      if (scheduledList.length === 0) {
        return;
      }

      // 2. Perform publishing updates and audit log records
      for (const item of scheduledList) {
        await tx
          .update(posts)
          .set({
            status: "published",
            publishedAt: now,
            scheduledAt: null,
            updatedAt: now,
            revision: item.revision + 1,
          })
          .where(eq(posts.id, item.id));

        await tx.insert(auditLogs).values({
          actorId: null,
          action: "post_publish_cron",
          resourceType: "post",
          resourceId: item.id,
          metadata: {
            slug: item.slug,
            type: item.type,
            title: item.title,
          },
        });

        publishedIds.push(item.id);
        publishedSlugs.push({ id: item.id, slug: item.slug, type: item.type });
      }
    });

    // 3. Clear Next.js cache tags outside transaction bounds
    for (const post of publishedSlugs) {
      try {
        revalidateTag(`post:${post.id}`, "max");
        revalidateTag(`post-slug:${post.slug}`, "max");
        revalidateTag("posts", "max");
        if (post.type === "note") {
          revalidateTag("notes", "max");
        } else if (post.type === "chat") {
          revalidateTag("chat", "max");
        } else if (post.type === "page") {
          revalidateTag("pages", "max");
        }
      } catch (cacheErr) {
        console.error(`Cache revalidation failed during cron for post ${post.id}:`, cacheErr);
      }
    }

    return NextResponse.json({
      success: true,
      processedCount: publishedIds.length,
      publishedIds,
    });
  } catch (error: any) {
    console.error("Cron publishing process failed:", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR: " + error.message }, { status: 500 });
  }
}
