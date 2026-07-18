import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db } from "../src/db";
import { user } from "../src/db/schema/auth";
import { profiles } from "../src/db/schema/profiles";
import { auditLogs } from "../src/db/schema/audit";
import { eq, ne, and } from "drizzle-orm";

async function main() {
  const args = process.argv.slice(2);
  const email = args[0];
  const usernameArg = args[1];
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "AstraBlog";

  if (!email || !usernameArg) {
    console.error("❌ Usage: npx tsx scripts/create-owner.ts <email> <username>");
    process.exit(1);
  }

  console.log(`🔑 Initializing Owner creation for email: "${email}" and username: "${usernameArg}"...`);

  // 1. Check if an owner already exists (with a different email)
  const existingOwner = await db.query.user.findFirst({
    where: and(eq(user.role, "owner"), ne(user.email, email)),
  });

  if (existingOwner) {
    console.error(`❌ Security Abort: An owner already exists in the system: ${existingOwner.email}. Multiple owners cannot be created silently.`);
    process.exit(1);
  }

  // 2. Find or create the target user
  let targetUser = await db.query.user.findFirst({
    where: eq(user.email, email),
  });

  if (targetUser) {
    console.log(`👤 User with email ${email} already exists. Upgrading role to 'owner'...`);
    await db
      .update(user)
      .set({
        role: "owner",
        updatedAt: new Date(),
      })
      .where(eq(user.id, targetUser.id));
  } else {
    console.log(`👤 Creating a new user with email ${email}...`);
    // Create random user ID (Better Auth standard uses short ID or UUID, let's generate a uuid or random string)
    const newUserId = crypto.randomUUID ? crypto.randomUUID() : `user_${Date.now()}`;
    const [created] = await db
      .insert(user)
      .values({
        id: newUserId,
        name: usernameArg,
        email: email,
        emailVerified: true, // Mark verified directly
        createdAt: new Date(),
        updatedAt: new Date(),
        role: "owner",
      })
      .returning();
    targetUser = created;
  }

  // 3. Create or update profile
  const targetProfile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, targetUser.id),
  });

  if (!targetProfile) {
    console.log(`👤 Creating user profile for username "${usernameArg}"...`);
    await db.insert(profiles).values({
      userId: targetUser.id,
      username: usernameArg,
      displayName: usernameArg,
      bio: `Owner of ${siteName}.`,
    });
  } else {
    console.log(`👤 Profile already exists. Updating username to "${usernameArg}"...`);
    await db
      .update(profiles)
      .set({
        username: usernameArg,
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, targetUser.id));
  }

  // 4. Log audit log
  console.log("📝 Writing safety audit log...");
  await db.insert(auditLogs).values({
    actorId: targetUser.id,
    action: "owner_create",
    resourceType: "user",
    resourceId: targetUser.id,
    metadata: {
      email,
      username: usernameArg,
      timestamp: new Date().toISOString(),
    },
    ipHash: "local-cli",
  });

  console.log(`✅ Success! Owner profile for "${email}" ("${usernameArg}") has been created/upgraded.`);
}

main()
  .catch((err) => {
    console.error("❌ Process error:", err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
