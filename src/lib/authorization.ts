import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { ensureUserProfile } from "@/lib/user-profile";

export async function getSession() {
  const reqHeaders = await headers();
  return await auth.api.getSession({
    headers: reqHeaders,
  });
}

/**
 * Ensures there is an active session.
 */
export async function requireSession() {
  const sessionResult = await getSession();
  if (!sessionResult || !sessionResult.session || !sessionResult.user) {
    throw new Error("UNAUTHORIZED: Session required");
  }
  return sessionResult;
}

/**
 * Ensures the session user has a verified email.
 */
export async function requireVerifiedUser() {
  const sessionResult = await requireSession();
  if (!sessionResult.user.emailVerified) {
    throw new Error("FORBIDDEN: Email verification required");
  }
  return sessionResult;
}

/**
 * Ensures the user has a verified session and their profile status is 'active'.
 */
export async function requireActiveUser() {
  const sessionResult = await requireVerifiedUser();
  const userId = sessionResult.user.id;

  // Check if the user is banned in Better Auth user record
  if (sessionResult.user.banned) {
    throw new Error("FORBIDDEN: User account is banned");
  }

  // Better Auth owns the user record; ensure the matching public profile exists.
  const profile = await ensureUserProfile({
    id: userId,
    name: sessionResult.user.name,
    email: sessionResult.user.email,
    username: sessionResult.user.username,
    displayUsername: sessionResult.user.displayUsername,
  });

  return { ...sessionResult, profile };
}

/**
 * Ensures the user has a verified active session and matches one of the required roles.
 */
export async function requireRole(...roles: Array<"member" | "admin" | "owner">) {
  const activeUser = await requireActiveUser();
  const userRole = (activeUser.user.role || "member") as "member" | "admin" | "owner";

  if (!roles.includes(userRole)) {
    throw new Error("FORBIDDEN: Insufficient role permissions");
  }

  return activeUser;
}

/**
 * Shortcut for owner role restriction.
 */
export async function requireOwner() {
  return await requireRole("owner");
}

/**
 * Ensures the active user is the owner of the specified resource,
 * or is an administrator/site owner.
 */
export async function requireResourceOwner(resourceOwnerId: string) {
  const activeUser = await requireActiveUser();
  const userId = activeUser.user.id;
  const userRole = activeUser.user.role || "member";

  if (userId !== resourceOwnerId && userRole !== "admin" && userRole !== "owner") {
    throw new Error("FORBIDDEN: Resource ownership mismatch");
  }

  return activeUser;
}
