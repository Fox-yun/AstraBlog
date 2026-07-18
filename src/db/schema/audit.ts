import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
  action: text("action").notNull(), // e.g. 'post_create', 'post_delete', 'role_change', etc.
  resourceType: text("resource_type").notNull(), // e.g. 'post', 'comment', 'user', etc.
  resourceId: text("resource_id"),
  metadata: jsonb("metadata"),
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("audit_logs_created_idx").on(table.createdAt.desc()),
  index("audit_logs_actor_created_idx").on(table.actorId, table.createdAt.desc()),
]);
