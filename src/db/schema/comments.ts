import { pgTable, uuid, text, boolean, timestamp, pgEnum, unique, smallint, check, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth";
import { posts } from "./posts";

export const commentStatusEnum = pgEnum("comment_status", [
  "pending",
  "visible",
  "hidden",
  "deleted",
  "spam",
]);

export const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id").references(() => posts.id, { onDelete: "cascade" }),
  isGuestbook: boolean("is_guestbook").notNull().default(false),
  authorId: text("author_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id").references((): any => comments.id, { onDelete: "cascade" }),
  rootId: uuid("root_id").references((): any => comments.id, { onDelete: "cascade" }),
  depth: smallint("depth").notNull().default(0),
  contentMarkdown: text("content_markdown").notNull(),
  contentHtml: text("content_html").notNull(),
  status: commentStatusEnum("status").notNull().default("pending"),
  editedAt: timestamp("edited_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("comments_depth_chk", sql`${table.depth} IN (0, 1)`),
  check("comments_root_id_chk", sql`(${table.depth} = 0 AND ${table.rootId} IS NULL) OR (${table.depth} = 1 AND ${table.rootId} IS NOT NULL)`),
  index("comments_post_status_created_idx").on(table.postId, table.status, table.createdAt),
  index("comments_root_created_idx").on(table.rootId, table.createdAt),
  index("comments_author_created_idx").on(table.authorId, table.createdAt),
]);

export const reportStatusEnum = pgEnum("report_status", [
  "pending",
  "reviewed",
  "dismissed",
]);

export const commentReports = pgTable(
  "comment_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    commentId: uuid("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    details: text("details"),
    status: reportStatusEnum("status").notNull().default("pending"),
    reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("comment_reporter_idx").on(table.commentId, table.reporterId),
  ]
);
