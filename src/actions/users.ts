"use server";

import { auth } from "@/lib/auth";
import { dbQuery, withTransaction } from "@/db";
import { auditLogs } from "@/db/schema/audit";
import { requireRole } from "@/lib/authorization";
import { eq, desc } from "drizzle-orm";
import { headers } from "next/headers";

export async function banUser(targetUserId: string, reason?: string) {
  const { user } = await requireRole("admin", "owner");
  const userId = user.id;

  // Better Auth admin plugin context requires headers for request parsing
  const reqHeaders = await headers();

  await withTransaction(async (tx) => {
    // 1. Perform Better Auth ban call via administrative client api
    await auth.api.banUser({
      headers: reqHeaders,
      body: {
        userId: targetUserId,
        banReason: reason || "Violating community standards.",
      },
    });

    // 2. Write to Audit Log
    await tx.insert(auditLogs).values({
      actorId: userId,
      action: "user_ban",
      resourceType: "user",
      resourceId: targetUserId,
      metadata: { reason: reason || "Violating community standards." },
    });
  });

  return { success: true };
}

export async function unbanUser(targetUserId: string) {
  const { user } = await requireRole("admin", "owner");
  const userId = user.id;

  const reqHeaders = await headers();

  await withTransaction(async (tx) => {
    // 1. Perform Better Auth unban call
    await auth.api.unbanUser({
      headers: reqHeaders,
      body: {
        userId: targetUserId,
      },
    });

    // 2. Write to Audit Log
    await tx.insert(auditLogs).values({
      actorId: userId,
      action: "user_unban",
      resourceType: "user",
      resourceId: targetUserId,
    });
  });

  return { success: true };
}

export async function fetchUsersList() {
  await requireRole("admin", "owner");
  // Query all users from db
  const list = await dbQuery.query.user.findMany({
    orderBy: [desc(sql`created_at`)],
  });
  return list;
}

import { sql } from "drizzle-orm";
