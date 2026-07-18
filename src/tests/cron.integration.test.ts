import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/cron/publish/route";

const { mockSelect, mockUpdate, mockInsert } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockInsert: vi.fn(),
}));

vi.mock("@/db", () => {
  return {
    withTransaction: vi.fn(async (cb) => {
      const mockTx = {
        select: mockSelect,
        update: mockUpdate,
        insert: mockInsert,
      };
      return await cb(mockTx);
    }),
  };
});

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

describe("AstraBlog Cron Publishing Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "secret-token-123";
  });

  it("should fail with 401 when Authorization header is missing or incorrect", async () => {
    const request = new Request("http://localhost:3000/api/cron/publish", {
      headers: {
        authorization: "Bearer wrong-token",
      },
    });

    const res = await GET(request);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain("UNAUTHORIZED");
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const request = new Request("http://localhost:3000/api/cron/publish");

    const res = await GET(request);

    expect(res.status).toBe(503);
  });

  it("should succeed and publish scheduled items when authorization header matches CRON_SECRET", async () => {
    const mockPost = {
      id: "post-1",
      title: "Scheduled Post",
      slug: "scheduled-post",
      type: "note",
      revision: 1,
    };

    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            for: vi.fn().mockResolvedValue([mockPost]),
          }),
        }),
      }),
    });

    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      }),
    });

    mockInsert.mockReturnValue({
      values: vi.fn().mockResolvedValue({}),
    });

    const request = new Request("http://localhost:3000/api/cron/publish", {
      headers: {
        authorization: "Bearer secret-token-123",
      },
    });

    const res = await GET(request);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.processedCount).toBe(1);
    expect(data.publishedIds).toContain("post-1");
  });
});
