import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db } from "../src/db";
import { user } from "../src/db/schema/auth";
import { profiles } from "../src/db/schema/profiles";
import { categories, tags } from "../src/db/schema/taxonomy";
import { posts, postTags } from "../src/db/schema/posts";
import { comments } from "../src/db/schema/comments";
import { eq } from "drizzle-orm";

async function main() {
  console.log("🌱 Starting database seeding...");

  // 1. Create developer user
  const devEmail = process.env.SEED_OWNER_EMAIL || "dev@example.com";
  const devName = process.env.SEED_OWNER_NAME || "Astra Developer";
  const devUsername = process.env.SEED_OWNER_USERNAME || "astra_dev";
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "AstraBlog";
  let devUser = await db.query.user.findFirst({
    where: eq(user.email, devEmail),
  });

  if (!devUser) {
    console.log("👤 Creating mock developer user...");
    const [created] = await db
      .insert(user)
      .values({
        id: "dev-user-id",
        name: devName,
        email: devEmail,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: "owner",
      })
      .returning();
    devUser = created;
  }

  // 2. Create profile
  const devProfile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, devUser.id),
  });

  if (!devProfile) {
    console.log("👤 Creating developer profile...");
    await db.insert(profiles).values({
      userId: devUser.id,
      username: devUsername,
      displayName: devName,
      bio: "Software, systems and long-form thinking.",
    });
  }

  // 3. Seed Categories
  console.log("📁 Seeding categories...");
  const categoriesList = [
    { name: "Engineering", slug: "engineering", description: "System design, performance, and architecture." },
    { name: "Design", slug: "design", description: "Visual guidelines, CSS typography, and minimalist interfaces." },
    { name: "Thoughts", slug: "thoughts", description: "Philosophical notes and long-term tech retrospectives." },
  ];

  const seededCategories = [];
  for (const cat of categoriesList) {
    let existing = await db.query.categories.findFirst({
      where: eq(categories.slug, cat.slug),
    });
    if (!existing) {
      const [newCat] = await db.insert(categories).values(cat).returning();
      existing = newCat;
    }
    seededCategories.push(existing);
  }

  // 4. Seed Tags
  console.log("🏷️ Seeding tags...");
  const tagsList = [
    { name: "Next.js", slug: "nextjs" },
    { name: "PostgreSQL", slug: "postgresql" },
    { name: "Drizzle ORM", slug: "drizzle" },
    { name: "Tailwind CSS", slug: "tailwindcss" },
    { name: "Minimalism", slug: "minimalism" },
  ];

  const seededTags = [];
  for (const t of tagsList) {
    let existing = await db.query.tags.findFirst({
      where: eq(tags.slug, t.slug),
    });
    if (!existing) {
      const [newTag] = await db.insert(tags).values(t).returning();
      existing = newTag;
    }
    seededTags.push(existing);
  }

  // 5. Seed Posts
  console.log("📝 Seeding blog posts...");

  // Note 1
  const noteSlug = "neon-http-vs-websocket";
  let notePost = await db.query.posts.findFirst({
    where: eq(posts.slug, noteSlug),
  });

  if (!notePost) {
    const [newPost] = await db.insert(posts).values({
      type: "note",
      title: "Neon HTTP vs. WebSocket Connection Performance",
      slug: noteSlug,
      description: "Analyzing database query latencies when running Drizzle ORM on serverless runtimes using Neon's HTTP and WebSocket clients.",
      contentMarkdown: `## Introduction

When building serverless web applications with Next.js and Neon PostgreSQL, we are presented with two connection protocols: Neon HTTP and WebSocket-based pools. This article examines their characteristics, optimization methods, and latency comparisons.

### Neon HTTP Client
The Neon HTTP driver (\`@neondatabase/serverless\`) is designed specifically for single-query requests in serverless environments.

- **Pros**: Zero connection startup overhead, highly optimized for edge and serverless requests.
- **Cons**: No interactive multi-statement transactions.

### Performance Benchmark
Our measurements yield the following query round-trip times (RTT) under high concurrency:
1. Neon HTTP Client: ~25ms
2. WebSocket Connection (Direct): ~65ms (includes TCP & TLS handshake overhead per invocation)

### Conclusion
For most general routes and read operations, Neon HTTP is the default choice. For long-lived sessions or multi-statement transactions, rely on standard pool connections.`,
      contentHtml: `<h2>Introduction</h2><p>When building serverless web applications with Next.js and Neon PostgreSQL, we are presented with two connection protocols: Neon HTTP and WebSocket-based pools. This article examines their characteristics, optimization methods, and latency comparisons.</p><h3>Neon HTTP Client</h3><p>The Neon HTTP driver (<code>@neondatabase/serverless</code>) is designed specifically for single-query requests in serverless environments.</p><ul><li><strong>Pros</strong>: Zero connection startup overhead, highly optimized for edge and serverless requests.</li><li><strong>Cons</strong>: No interactive multi-statement transactions.</li></ul><h3>Performance Benchmark</h3><p>Our measurements yield the following query round-trip times (RTT) under high concurrency:</p><ol><li>Neon HTTP Client: ~25ms</li><li>WebSocket Connection (Direct): ~65ms (includes TCP & TLS handshake overhead per invocation)</li></ol><h3>Conclusion</h3><p>For most general routes and read operations, Neon HTTP is the default choice. For long-lived sessions or multi-statement transactions, rely on standard pool connections.</p>`,
      status: "published",
      categoryId: seededCategories[0].id,
      allowComments: true,
      isFeatured: true,
      isPinned: true,
      publishedAt: new Date(),
      createdBy: devUser.id,
      updatedBy: devUser.id,
    }).returning();
    notePost = newPost;

    // Attach tags
    await db.insert(postTags).values([
      { postId: notePost.id, tagId: seededTags[0].id },
      { postId: notePost.id, tagId: seededTags[1].id },
      { postId: notePost.id, tagId: seededTags[2].id },
    ]);

    // Add a comment
    console.log("💬 Seeding post comments...");
    await db.insert(comments).values({
      postId: notePost.id,
      authorId: devUser.id,
      contentMarkdown: "Great analysis! The HTTP driver really speeds up cold starts on Vercel serverless functions.",
      contentHtml: "<p>Great analysis! The HTTP driver really speeds up cold starts on Vercel serverless functions.</p>",
      status: "visible",
    });
  }

  // Chat 1
  const chatSlug = "chat-123456";
  const chatPost = await db.query.posts.findFirst({
    where: eq(posts.slug, chatSlug),
  });

  if (!chatPost) {
    const [newChat] = await db.insert(posts).values({
      type: "chat",
      title: null,
      slug: chatSlug,
      description: "Dev log snippet.",
      contentMarkdown: `Migrated ${siteName} authentication to Better Auth with the Drizzle PostgreSQL adapter. The configuration is clean, case-insensitive usernames work out of the box, and database schemas are fully controlled through Drizzle Kit. Database-backed session rate limiting keeps it safe.`,
      contentHtml: `<p>Migrated ${siteName} authentication to Better Auth with the Drizzle PostgreSQL adapter. The configuration is clean, case-insensitive usernames work out of the box, and database schemas are fully controlled through Drizzle Kit. Database-backed session rate limiting keeps it safe.</p>`,
      status: "published",
      allowComments: true,
      publishedAt: new Date(),
      createdBy: devUser.id,
      updatedBy: devUser.id,
    }).returning();

    // Attach tags
    await db.insert(postTags).values([
      { postId: newChat.id, tagId: seededTags[2].id },
      { postId: newChat.id, tagId: seededTags[4].id },
    ]);
  }

  console.log("✅ Database seeding completed successfully!");
}

main()
  .catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
