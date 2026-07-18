import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoist mock functions before any module mocks are executed
const { mockFindFirst, mockUpdate, mockInsert, mockDelete } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
  mockInsert: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("@/db", () => {
  return {
    dbQuery: {
      query: {
        posts: {
          findFirst: mockFindFirst,
        },
      },
    },
    withTransaction: vi.fn(async (cb) => {
      const mockTx = {
        query: {
          posts: {
            findFirst: mockFindFirst,
          },
          postVersions: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
          media: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        },
        update: mockUpdate,
        delete: mockDelete,
        insert: mockInsert,
      };
      return await cb(mockTx);
    }),
  };
});

vi.mock("@/lib/authorization", () => ({
  requireRole: vi.fn().mockResolvedValue({
    user: { id: "test-admin-id", role: "admin" },
  }),
}));

vi.mock("@/lib/markdown", () => ({
  markdownToHtml: vi.fn().mockResolvedValue("<p>mock html</p>"),
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

// Now import updatePost after modules are mocked
import { updatePost } from "@/actions/posts";

describe("AstraBlog Actions - Optimistic Concurrency Control (OCC)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should succeed and increment revision when clientRevision matches database", async () => {
    const mockPost = {
      id: "post-1",
      title: "Initial Title",
      slug: "initial-title",
      contentMarkdown: "Content",
      status: "draft",
      revision: 1,
      type: "note",
    };

    mockFindFirst.mockResolvedValue(mockPost);

    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...mockPost, title: "Updated Title", revision: 2 }]),
        }),
      }),
    });

    mockInsert.mockReturnValue({
      values: vi.fn().mockResolvedValue({}),
    });

    mockDelete.mockReturnValue({
      where: vi.fn().mockResolvedValue({}),
    });

    const result = await updatePost("post-1", {
      title: "Updated Title",
      contentMarkdown: "Content",
      clientRevision: 1,
    });

    expect(result.success).toBe(true);
    expect(result.post?.revision).toBe(2);
  });

  it("should fail and return EDIT_CONFLICT when clientRevision does not match database", async () => {
    const mockPost = {
      id: "post-1",
      title: "Initial Title",
      slug: "initial-title",
      contentMarkdown: "Content",
      status: "draft",
      revision: 2, // Database is ahead
      type: "note",
    };

    mockFindFirst.mockResolvedValue(mockPost);

    const result = await updatePost("post-1", {
      title: "Updated Title",
      contentMarkdown: "Content",
      clientRevision: 1, // Client is behind
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("EDIT_CONFLICT");
  });
});
