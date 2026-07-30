import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadImage } from "./upload-image";

describe("uploadImage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uploads and completes a valid image", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            uploadUrl: "https://storage.example/upload",
            mediaId: "12b6af7b-79f5-4bb2-b3cd-f750433ca859",
            objectKey:
              "astrablog/test/notes/2026/07/12b6af7b-79f5-4bb2-b3cd-f750433ca859.webp",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            publicUrl:
              "https://media.example/astrablog/test/notes/2026/07/12b6af7b-79f5-4bb2-b3cd-f750433ca859.webp",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const progress = vi.fn();
    const file = new File(["image"], "cover.webp", { type: "image/webp" });
    const result = await uploadImage({
      file,
      altText: "Article cover",
      resourceType: "note",
      onProgress: progress,
    });

    expect(result.altText).toBe("Article cover");
    expect(result.publicUrl).toContain("12b6af7b-79f5-4bb2-b3cd-f750433ca859.webp");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(progress).toHaveBeenLastCalledWith("Verifying image...");
  });

  it("rejects unsupported image formats before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const file = new File(["image"], "vector.svg", { type: "image/svg+xml" });
    await expect(
      uploadImage({ file, resourceType: "page" }),
    ).rejects.toThrow("Choose a JPEG, PNG, WEBP, or AVIF image.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces configuration errors returned by the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "Media storage is not configured. Add the R2 environment variables.",
          }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const file = new File(["image"], "cover.png", { type: "image/png" });
    await expect(
      uploadImage({ file, resourceType: "note" }),
    ).rejects.toThrow("Media storage is not configured");
  });
});
