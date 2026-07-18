import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindFirst, mockInsert, mockValues, mockOnConflictDoNothing, mockReturning } =
  vi.hoisted(() => ({
    mockFindFirst: vi.fn(),
    mockInsert: vi.fn(),
    mockValues: vi.fn(),
    mockOnConflictDoNothing: vi.fn(),
    mockReturning: vi.fn(),
  }));

vi.mock("@/db", () => ({
  dbQuery: {
    query: {
      profiles: {
        findFirst: mockFindFirst,
      },
    },
    insert: mockInsert,
  },
}));

import { ensureUserProfile } from "./user-profile";

describe("ensureUserProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing });
    mockOnConflictDoNothing.mockReturnValue({ returning: mockReturning });
  });

  it("returns an existing profile without writing", async () => {
    const profile = { id: "profile-1", userId: "user-1", username: "xtzzz" };
    mockFindFirst.mockResolvedValue(profile);

    await expect(
      ensureUserProfile({
        id: "user-1",
        name: "XTZZZ",
        email: "z33280326@gmail.com",
        username: "xtzzz",
      }),
    ).resolves.toBe(profile);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("creates the missing profile from the Better Auth username", async () => {
    const profile = {
      id: "profile-1",
      userId: "user-1",
      username: "xtzzz",
      displayName: "XTZZZ",
    };
    mockFindFirst.mockResolvedValue(null);
    mockReturning.mockResolvedValue([profile]);

    await expect(
      ensureUserProfile({
        id: "user-1",
        name: "XTZZZ",
        email: "z33280326@gmail.com",
        username: "xtzzz",
      }),
    ).resolves.toEqual(profile);
    expect(mockValues).toHaveBeenCalledWith({
      userId: "user-1",
      username: "xtzzz",
      displayName: "XTZZZ",
    });
  });
});
