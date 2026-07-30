import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/authorization";
import { dbQuery, withTransaction } from "@/db";
import { media } from "@/db/schema/media";
import { auditLogs } from "@/db/schema/audit";
import { isR2Configured, R2_PUBLIC_BASE_URL, s3Client, R2_BUCKET } from "@/lib/r2";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 1. Authenticate an active, verified user.
    const { user } = await requireActiveUser();
    const userId = user.id;

    if (!isR2Configured) {
      return NextResponse.json(
        { error: "Media storage is not configured. Add the R2 environment variables." },
        { status: 503 },
      );
    }

    // 2. Parse request JSON
    const body = await request.json();
    const { mediaId, width, height, altText } = body as {
      mediaId: string;
      width?: number;
      height?: number;
      altText?: string;
    };

    if (!mediaId) {
      return NextResponse.json({ error: "BAD_REQUEST: Missing mediaId" }, { status: 400 });
    }

    // 3. Query media record (using dbQuery read client)
    const mediaRecord = await dbQuery.query.media.findFirst({
      where: eq(media.id, mediaId),
    });

    if (!mediaRecord) {
      return NextResponse.json({ error: "NOT_FOUND: Media record not found" }, { status: 404 });
    }

    // Ensure session user owns the media or is admin
    const isAdminOrOwner = user.role === "admin" || user.role === "owner";
    if (mediaRecord.ownerId !== userId && !isAdminOrOwner) {
      return NextResponse.json({ error: "FORBIDDEN: Permission mismatch" }, { status: 403 });
    }

    // 4. Perform S3 HEAD Check (executed outside transaction to prevent holding connections open)
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: R2_BUCKET,
        Key: mediaRecord.objectKey,
      });

      const s3Object = await s3Client.send(headCommand);

      // Verify that S3 ContentLength matches database record size
      if (s3Object.ContentLength !== mediaRecord.sizeBytes) {
        return NextResponse.json(
          {
            error: "BAD_REQUEST: File size mismatch",
            dbSize: mediaRecord.sizeBytes,
            s3Size: s3Object.ContentLength,
          },
          { status: 400 }
        );
      }
    } catch (s3Error: any) {
      console.error("S3 HEAD error on object key:", mediaRecord.objectKey, s3Error);
      return NextResponse.json(
        { error: "BAD_REQUEST: File does not exist in storage bucket." },
        { status: 400 }
      );
    }

    // 5. Update media state to 'ready' and write audit log inside a transaction
    const updatedMedia = await withTransaction(async (tx) => {
      const [record] = await tx
        .update(media)
        .set({
          status: "ready",
          width: width || null,
          height: height || null,
          altText: altText || mediaRecord.altText || null,
          updatedAt: new Date(),
        })
        .where(eq(media.id, mediaId))
        .returning();

      await tx.insert(auditLogs).values({
        actorId: userId,
        action: "media_complete",
        resourceType: "media",
        resourceId: mediaId,
        metadata: {
          bucket: mediaRecord.bucket,
          objectKey: mediaRecord.objectKey,
          mimeType: mediaRecord.mimeType,
          sizeBytes: mediaRecord.sizeBytes,
        },
      });

      return record;
    });

    return NextResponse.json({
      success: true,
      media: updatedMedia,
      publicUrl: `${R2_PUBLIC_BASE_URL}/${updatedMedia.objectKey}`,
    });
  } catch (error: unknown) {
    console.error("Complete upload error:", error);
    const message = error instanceof Error ? error.message : "";
    const status = message.startsWith("UNAUTHORIZED:")
      ? 401
      : message.startsWith("FORBIDDEN:")
        ? 403
        : 500;
    return NextResponse.json(
      {
        error:
          status === 401
            ? "Your session expired. Please sign in again."
            : status === 403
              ? "You do not have permission to complete this upload."
              : "Could not verify the uploaded image.",
      },
      { status },
    );
  }
}
