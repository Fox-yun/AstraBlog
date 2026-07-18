import { S3Client } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

if (
  process.env.NODE_ENV === "development" &&
  (!accountId || !accessKeyId || !secretAccessKey)
) {
  console.warn("⚠️  Cloudflare R2 is not fully configured in environment variables.");
}

export const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId || "placeholder"}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: accessKeyId || "placeholder",
    secretAccessKey: secretAccessKey || "placeholder",
  },
});

export const R2_BUCKET = process.env.R2_BUCKET || "astrablog-media";
export const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL || "";
