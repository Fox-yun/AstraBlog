import { createHash } from "node:crypto";
import { dbQuery } from "@/db";
import { profiles } from "@/db/schema/profiles";
import { eq } from "drizzle-orm";

interface ProfileSeedUser {
  id: string;
  name: string;
  email: string;
  username?: string | null;
  displayUsername?: string | null;
}

function normalizeUsername(value: string, fallback: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 24);

  return normalized.length >= 3 ? normalized : `user-${fallback}`;
}

export async function ensureUserProfile(user: ProfileSeedUser) {
  const existing = await dbQuery.query.profiles.findFirst({
    where: eq(profiles.userId, user.id),
  });

  if (existing) return existing;

  const suffix = createHash("sha256").update(user.id).digest("hex").slice(0, 8);
  const preferredUsername = normalizeUsername(
    user.username || user.email.split("@")[0] || user.id,
    suffix,
  );
  const displayName = (user.displayUsername || user.name || preferredUsername).trim().slice(0, 80);

  const createProfile = async (username: string) => {
    const [created] = await dbQuery
      .insert(profiles)
      .values({
        userId: user.id,
        username,
        displayName: displayName || username,
      })
      .onConflictDoNothing()
      .returning();

    return created;
  };

  const created = await createProfile(preferredUsername);
  if (created) return created;

  const concurrent = await dbQuery.query.profiles.findFirst({
    where: eq(profiles.userId, user.id),
  });
  if (concurrent) return concurrent;

  const fallbackUsername = `${preferredUsername.slice(0, 15)}-${suffix}`.slice(0, 24);
  const fallbackProfile = await createProfile(fallbackUsername);
  if (fallbackProfile) return fallbackProfile;

  throw new Error("Unable to initialize user profile.");
}
