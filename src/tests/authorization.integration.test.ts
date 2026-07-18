import { describe, it, expect, vi } from "vitest";
import { requireActiveUser, requireRole } from "@/lib/authorization";

// Mock the dbQuery
vi.mock("@/db", () => {
  return {
    dbQuery: {
      query: {
        profiles: {
          findFirst: vi.fn().mockResolvedValue({
            userId: "test-user-id",
          }),
        },
      },
    },
  };
});

// Mock headers and better-auth getSession
const mockGetSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: any[]) => mockGetSession(...args),
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: () => "mock-header",
  }),
}));

describe("AstraBlog Authorization Guards Integration", () => {
  it("should fail when session is missing", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(requireActiveUser()).rejects.toThrow("UNAUTHORIZED");
  });

  it("should fail when user email is not verified", async () => {
    mockGetSession.mockResolvedValue({
      session: {},
      user: { id: "test-user-id", emailVerified: false },
    });
    await expect(requireActiveUser()).rejects.toThrow("FORBIDDEN: Email verification required");
  });

  it("should fail when user account is banned in Better Auth", async () => {
    mockGetSession.mockResolvedValue({
      session: {},
      user: { id: "test-user-id", emailVerified: true, banned: true },
    });
    await expect(requireActiveUser()).rejects.toThrow("FORBIDDEN: User account is banned");
  });

  it("should succeed when user email is verified and not banned", async () => {
    mockGetSession.mockResolvedValue({
      session: {},
      user: { id: "test-user-id", emailVerified: true, banned: false, role: "member" },
    });
    const res = await requireActiveUser();
    expect(res.user.id).toBe("test-user-id");
  });

  it("should block non-admin roles from accessing requireRole('admin')", async () => {
    mockGetSession.mockResolvedValue({
      session: {},
      user: { id: "test-user-id", emailVerified: true, banned: false, role: "member" },
    });
    await expect(requireRole("admin", "owner")).rejects.toThrow("FORBIDDEN: Insufficient role permissions");
  });
});
