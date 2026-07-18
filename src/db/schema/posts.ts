import { pgTable, uuid, text, varchar, boolean, timestamp, pgEnum, jsonb, unique, primaryKey, integer, index } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { citext } from "./profiles";
import { categories, tags } from "./taxonomy";
import { media } from "./media";

export const postTypeEnum = pgEnum("post_type", ["note", "chat", "page"]);
export const postStatusEnum = pgEnum("post_status", [
  "draft",
  "scheduled",
  "published",
  "archived",
]);

export const posts = pgTable("posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: postTypeEnum("type").notNull(),
  title: varchar("title", { length: 200 }), // Nullable for chat posts, validated in application
  slug: citext("slug").unique().notNull(),
  description: varchar("description", { length: 500 }),
  contentMarkdown: text("content_markdown").notNull(),
  contentHtml: text("content_html").notNull(),
  searchText: text("search_text"),
  status: postStatusEnum("status").notNull().default("draft"),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  coverMediaId: uuid("cover_media_id").references(() => media.id, { onDelete: "set null" }),
  allowComments: boolean("allow_comments").notNull().default(true),
  isFeatured: boolean("is_featured").notNull().default(false),
  isPinned: boolean("is_pinned").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  revision: integer("revision").notNull().default(1),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  updatedBy: text("updated_by")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("posts_status_pub_idx").on(table.status, table.publishedAt.desc()),
  index("posts_type_status_pub_idx").on(table.type, table.status, table.publishedAt.desc()),
  index("posts_cat_status_idx").on(table.categoryId, table.status),
]);

export const postVersions = pgTable(
  "post_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    title: varchar("title", { length: 200 }),
    description: varchar("description", { length: 500 }),
    contentMarkdown: text("content_markdown").notNull(),
    metadata: jsonb("metadata"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("post_version_num_idx").on(table.postId, table.versionNumber),
    index("post_ver_post_ver_idx").on(table.postId, table.versionNumber.desc()),
  ]
);

export const postTags = pgTable(
  "post_tags",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.tagId] }),
  ]
);
