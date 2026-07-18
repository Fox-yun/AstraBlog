import { pgTable, uuid, text, integer, timestamp, pgEnum, index, unique } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const mediaStatusEnum = pgEnum("media_status", [
  "pending",
  "ready",
  "orphaned",
  "deleted",
]);

export const media = pgTable("media", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  bucket: text("bucket").notNull(),
  objectKey: text("object_key").notNull(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  width: integer("width"),
  height: integer("height"),
  altText: text("alt_text"),
  status: mediaStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("media_status_created_idx").on(table.status, table.createdAt),
]);

export const mediaReferences = pgTable("media_references", {
  id: uuid("id").defaultRandom().primaryKey(),
  mediaId: uuid("media_id")
    .notNull()
    .references(() => media.id, { onDelete: "cascade" }),
  resourceType: text("resource_type").notNull(), // post | profile | site
  resourceId: text("resource_id").notNull(), // text to support both post (uuid) and user (text)
  referenceType: text("reference_type").notNull(), // cover | inline | avatar | og_image
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("media_ref_unique_idx").on(table.mediaId, table.resourceType, table.resourceId, table.referenceType),
  index("media_ref_media_idx").on(table.mediaId),
]);
