import { pgTable, uuid, text } from "drizzle-orm/pg-core";
import { citext } from "./profiles";

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: citext("slug").unique().notNull(),
  description: text("description"),
});

export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: citext("slug").unique().notNull(),
});
