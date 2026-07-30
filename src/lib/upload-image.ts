export type UploadImageResource = "avatar" | "note" | "chat" | "page" | "temporary";

export interface UploadedImage {
  mediaId: string;
  objectKey: string;
  publicUrl: string;
  altText: string;
}

interface UploadImageOptions {
  file: File;
  altText?: string;
  resourceType: UploadImageResource;
  onProgress?: (message: string) => void;
}

const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

async function parseJsonResponse(response: Response) {
  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}

async function imageDimensions(file: File) {
  if (typeof Image === "undefined") return {};

  return new Promise<{ width?: number; height?: number }>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(objectUrl);
    };
    image.onerror = () => {
      resolve({});
      URL.revokeObjectURL(objectUrl);
    };
    image.src = objectUrl;
  });
}

function responseError(body: Record<string, unknown>, fallback: string) {
  return typeof body.error === "string" ? body.error : fallback;
}

export async function uploadImage({
  file,
  altText,
  resourceType,
  onProgress,
}: UploadImageOptions): Promise<UploadedImage> {
  if (!allowedImageTypes.has(file.type)) {
    throw new Error("Choose a JPEG, PNG, WEBP, or AVIF image.");
  }

  const sizeLimit = resourceType === "avatar" ? 2 * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size > sizeLimit) {
    throw new Error(
      resourceType === "avatar"
        ? "Avatar images must be 2 MB or smaller."
        : "Content images must be 10 MB or smaller.",
    );
  }

  onProgress?.("Requesting upload slot...");
  const presignResponse = await fetch("/api/media/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      type: resourceType,
    }),
  });
  const presign = await parseJsonResponse(presignResponse);
  if (!presignResponse.ok) {
    throw new Error(responseError(presign, "Could not prepare the image upload."));
  }
  if (
    typeof presign.uploadUrl !== "string" ||
    typeof presign.mediaId !== "string" ||
    typeof presign.objectKey !== "string"
  ) {
    throw new Error("The upload service returned an invalid response.");
  }

  onProgress?.("Uploading image...");
  const uploadResponse = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!uploadResponse.ok) {
    throw new Error("Storage rejected the image upload.");
  }

  onProgress?.("Verifying image...");
  const dimensions = await imageDimensions(file);
  const resolvedAltText = altText?.trim() || file.name.replace(/\.[^.]+$/, "");
  const completeResponse = await fetch("/api/media/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mediaId: presign.mediaId,
      altText: resolvedAltText,
      ...dimensions,
    }),
  });
  const complete = await parseJsonResponse(completeResponse);
  if (!completeResponse.ok) {
    throw new Error(responseError(complete, "Could not verify the uploaded image."));
  }
  if (typeof complete.publicUrl !== "string" || !complete.publicUrl) {
    throw new Error("The image uploaded, but its public URL is not configured.");
  }

  return {
    mediaId: presign.mediaId,
    objectKey: presign.objectKey,
    publicUrl: complete.publicUrl,
    altText: resolvedAltText,
  };
}
