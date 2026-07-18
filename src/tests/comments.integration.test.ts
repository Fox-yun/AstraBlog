import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindFirst, mockSelect, mockInsert } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
}));

vi.mock("@/db", () => {
  return {
    dbQuery: {
      query: {
        comments: {
          findFirst: mockFindFirst,
        },
      },
      select: mockSelect,
    },
    withTransaction: vi.fn(async (cb) => {
      const mockTx = {
        query: {
          comments: {
            findFirst: mockFindFirst,
          },
          posts: {
            findFirst: vi.fn().mockResolvedValue({ id: "post-1", createdBy: "author-1" }),
          },
        },
        select: mockSelect,
        insert: mockInsert,
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: "comment-1" }]),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      };
      return await cb(mockTx);
    }),
  };
});

vi.mock("@/lib/authorization", () => ({
  requireActiveUser: vi.fn().mockResolvedValue({
    user: { id: "user-1", role: "member", emailVerified: true },
  }),
}));

vi.mock("@/lib/markdown", () => ({
  markdownToHtml: vi.fn().mockResolvedValue("<p>comment html</p>"),
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

import { submitComment } from "@/actions/comments";

describe("AstraBlog Comments Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fail when parent comment does not exist", async () => {
    mockFindFirst.mockResolvedValue(null);
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      }),
    });

    const res = await submitComment({
      postId: "post-1",
      contentMarkdown: "This is a comment",
      parentId: "non-existent-comment-id",
    });

    expect(res).toEqual({ success: false, error: "Parent comment not found." });
  });

  it("should enforce depth constraints when replying to root comment", async () => {
    const parentComment = {
      id: "parent-1",
      parentId: null,
      rootId: null,
      depth: 0,
    };
    mockFindFirst.mockResolvedValue(parentComment);

    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      }),
    });

    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "comment-new", depth: 1 }]),
      }),
    });

    const res = await submitComment({
      postId: "post-1",
      contentMarkdown: "Replying to root comment",
      parentId: "parent-1",
    });

    expect(res.success).toBe(true);
  });
});
