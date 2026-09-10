import { sql } from "drizzle-orm";
import { pgTable, pgEnum, uuid, varchar, text, integer, numeric, boolean, jsonb, timestamp, index, check } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const barStatusEnum = pgEnum("bar_recipe_status", ["draft", "published", "archived"]);

export const barIngredientCategories = pgTable("bar_ingredient_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 80 }).notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const barIngredients = pgTable("bar_ingredients", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  nameEn: varchar("name_en", { length: 160 }).notNull().default(""),
  aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
  categoryId: uuid("category_id").notNull().references(() => barIngredientCategories.id, { onDelete: "restrict" }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("bar_ingredients_category_idx").on(t.categoryId)]);

export const barRecipes = pgTable("bar_recipes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 160 }).notNull().default(""),
  nameEn: varchar("name_en", { length: 160 }).notNull().default(""),
  aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
  description: varchar("description", { length: 500 }).notNull().default(""),
  flavorTags: jsonb("flavor_tags").$type<string[]>().notNull().default([]),
  method: varchar("method", { length: 120 }).notNull().default(""),
  glass: varchar("glass", { length: 120 }).notNull().default(""),
  iceNote: varchar("ice_note", { length: 500 }).notNull().default(""),
  steps: jsonb("steps").$type<string[]>().notNull().default([]),
  publicNotes: text("public_notes").notNull().default(""),
  privateNotes: text("private_notes").notNull().default(""),
  sourceName: varchar("source_name", { length: 200 }).notNull().default(""),
  sourceUrl: varchar("source_url", { length: 2000 }).notNull().default(""),
  status: barStatusEnum("status").notNull().default("draft"),
  revision: integer("revision").notNull().default(1),
  createdBy: text("created_by").notNull().references(() => user.id, { onDelete: "restrict" }),
  updatedBy: text("updated_by").notNull().references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
}, (t) => [index("bar_recipes_status_idx").on(t.status), check("bar_revision_positive", sql`${t.revision} > 0`)]);

export const barRecipeIngredients = pgTable("bar_recipe_ingredients", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipeId: uuid("recipe_id").notNull().references(() => barRecipes.id, { onDelete: "cascade" }),
  ingredientId: uuid("ingredient_id").notNull().references(() => barIngredients.id, { onDelete: "restrict" }),
  amount: numeric("amount", { precision: 12, scale: 4, mode: "number" }),
  unit: varchar("unit", { length: 30 }).notNull().default(""),
  amountText: varchar("amount_text", { length: 120 }).notNull().default(""),
  isOptional: boolean("is_optional").notNull().default(false),
  note: varchar("note", { length: 500 }).notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => [
  index("bar_recipe_ingredients_recipe_idx").on(t.recipeId, t.sortOrder),
  index("bar_recipe_ingredients_ingredient_idx").on(t.ingredientId),
  check("bar_amount_positive", sql`${t.amount} IS NULL OR (${t.amount} > 0 AND ${t.amount} <= 1000000)`),
  check("bar_amount_exclusive", sql`${t.amountText} = '' OR (${t.amount} IS NULL AND ${t.unit} = '')`),
]);
