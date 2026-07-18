import { customType, pgTable, uuid, text, varchar, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth";
import { media } from "./media";

export const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .unique()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  username: citext("username").unique().notNull(),
  displayName: varchar("display_name", { length: 80 }).notNull(),
  bio: varchar("bio", { length: 500 }),
  websiteUrl: text("website_url"),
  avatarMediaId: uuid("avatar_media_id").references(() => media.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("profiles_username_format", sql`${table.username} ~ '^[a-zA-Z0-9_-]{3,24}$'`),
]);

export const reservedUsernames = pgTable("reserved_usernames", {
  username: citext("username").primaryKey(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
