import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/authorization";
import { withTransaction } from "@/db";
import { media } from "@/db/schema/media";
import { isR2Configured, s3Client, R2_BUCKET } from "@/lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

    // 2. Parse request JSON body
    const body = await request.json();
    const { filename, mimeType, sizeBytes, type } = body as {
      filename: string;
      mimeType: string;
      sizeBytes: number;
      type: "avatar" | "note" | "chat" | "page" | "temporary";
      postId?: string;
    };

    const allowedResourceTypes = ["avatar", "note", "chat", "page", "temporary"] as const;
    if (
      !filename ||
      !mimeType ||
      !Number.isFinite(sizeBytes) ||
      sizeBytes <= 0 ||
      !allowedResourceTypes.includes(type)
    ) {
      return NextResponse.json({ error: "BAD_REQUEST: Missing parameters" }, { status: 400 });
    }

    const isAdminOrOwner = user.role === "admin" || user.role === "owner";

    // 3. Enforce access rules & size limits
    if (type !== "avatar" && !isAdminOrOwner) {
      return NextResponse.json({ error: "FORBIDDEN: Content upload restricted to admins" }, { status: 403 });
    }

    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    if (!allowedMimeTypes.includes(mimeType)) {
      return NextResponse.json({ error: "BAD_REQUEST: Unsupported media type" }, { status: 400 });
    }

    if (type === "avatar") {
      // Avatars: max 2MB
      if (sizeBytes > 2 * 1024 * 1024) {
        return NextResponse.json({ error: "BAD_REQUEST: Avatar exceeds 2MB limit" }, { status: 400 });
      }
    } else {
      // Content images: max 10MB
      if (sizeBytes > 10 * 1024 * 1024) {
        return NextResponse.json({ error: "BAD_REQUEST: Media file exceeds 10MB limit" }, { status: 400 });
      }
    }

    // 4. Determine structured object path key
    // Pattern: astrablog/{environment}/{resource}/{year}/{month}/{uuid}.{ext}
    const extension = mimeType.split("/")[1] || "webp";
    const mediaId = crypto.randomUUID();
    const env = process.env.NODE_ENV || "development";
    const resource = type === "avatar" ? "avatars" : `${type}s`;

    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");

    const objectKey = `astrablog/${env}/${resource}/${year}/${month}/${mediaId}.${extension}`;

    // 5. Generate Presigned PUT URL (valid for 5 minutes)
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: objectKey,
      ContentType: mimeType,
      ContentLength: sizeBytes,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    // 6. Save media in database inside a transaction on dbTx
    const mediaRecord = await withTransaction(async (tx) => {
      const [record] = await tx
        .insert(media)
        .values({
          id: mediaId,
          ownerId: userId,
          bucket: R2_BUCKET,
          objectKey: objectKey,
          originalFilename: filename,
          mimeType: mimeType,
          sizeBytes: sizeBytes,
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      return record;
    });

    return NextResponse.json({
      uploadUrl,
      mediaId: mediaRecord.id,
      objectKey: mediaRecord.objectKey,
    });
  } catch (error: unknown) {
    console.error("Presign error:", error);
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
              ? "You do not have permission to upload this image."
              : "Could not prepare the image upload.",
      },
      { status },
    );
  }
}
