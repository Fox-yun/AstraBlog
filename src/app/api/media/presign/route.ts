import { NextResponse } from "next/server";
import { getSession } from "@/lib/authorization";
import { dbQuery, withTransaction } from "@/db";
import { media } from "@/db/schema/media";
import { profiles } from "@/db/schema/profiles";
import { s3Client, R2_BUCKET } from "@/lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 1. Authenticate user session
    const sessionResult = await getSession();
    if (!sessionResult || !sessionResult.user) {
      return NextResponse.json({ error: "UNAUTHORIZED: Session required" }, { status: 401 });
    }
    const user = sessionResult.user;
    const userId = user.id;

    // Check profile active status (using dbQuery read client)
    const profile = await dbQuery.query.profiles.findFirst({
      where: eq(profiles.userId, userId),
    });
    if (!profile || user.banned) {
      return NextResponse.json({ error: "FORBIDDEN: Profile does not exist or user is banned" }, { status: 403 });
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

    if (!filename || !mimeType || !sizeBytes || !type) {
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
    const uuid = crypto.randomUUID();
    const env = process.env.NODE_ENV || "development";
    const resource = type === "avatar" ? "avatars" : `${type}s`;

    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");

    const objectKey = `astrablog/${env}/${resource}/${year}/${month}/${uuid}.${extension}`;

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
  } catch (error: any) {
    console.error("Presign error:", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR: " + error.message }, { status: 500 });
  }
}
