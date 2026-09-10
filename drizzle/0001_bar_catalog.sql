-- Stop before creating tables if /bar would shadow an existing custom page.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM posts WHERE type = 'page' AND lower(split_part(slug::text, '/', 1)) = 'bar') THEN
    RAISE EXCEPTION 'BAR_ROUTE_CONFLICT: rename the existing custom /bar page before migrating';
  END IF;
END $$;
--> statement-breakpoint
CREATE TYPE "public"."bar_recipe_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "bar_ingredient_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(80) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bar_ingredient_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "bar_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(120) NOT NULL,
	"name_en" varchar(160) DEFAULT '' NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bar_ingredients_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "bar_recipe_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"amount" numeric(12, 4),
	"unit" varchar(30) DEFAULT '' NOT NULL,
	"amount_text" varchar(120) DEFAULT '' NOT NULL,
	"is_optional" boolean DEFAULT false NOT NULL,
	"note" varchar(500) DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "bar_amount_positive" CHECK ("bar_recipe_ingredients"."amount" IS NULL OR ("bar_recipe_ingredients"."amount" > 0 AND "bar_recipe_ingredients"."amount" <= 1000000)),
	CONSTRAINT "bar_amount_exclusive" CHECK ("bar_recipe_ingredients"."amount_text" = '' OR ("bar_recipe_ingredients"."amount" IS NULL AND "bar_recipe_ingredients"."unit" = ''))
);
--> statement-breakpoint
CREATE TABLE "bar_recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) DEFAULT '' NOT NULL,
	"name_en" varchar(160) DEFAULT '' NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" varchar(500) DEFAULT '' NOT NULL,
	"flavor_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"method" varchar(120) DEFAULT '' NOT NULL,
	"glass" varchar(120) DEFAULT '' NOT NULL,
	"ice_note" varchar(500) DEFAULT '' NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"public_notes" text DEFAULT '' NOT NULL,
	"private_notes" text DEFAULT '' NOT NULL,
	"source_name" varchar(200) DEFAULT '' NOT NULL,
	"source_url" varchar(2000) DEFAULT '' NOT NULL,
	"status" "bar_recipe_status" DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "bar_revision_positive" CHECK ("bar_recipes"."revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "bar_ingredients" ADD CONSTRAINT "bar_ingredients_category_id_bar_ingredient_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."bar_ingredient_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bar_recipe_ingredients" ADD CONSTRAINT "bar_recipe_ingredients_recipe_id_bar_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."bar_recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bar_recipe_ingredients" ADD CONSTRAINT "bar_recipe_ingredients_ingredient_id_bar_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."bar_ingredients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bar_recipes" ADD CONSTRAINT "bar_recipes_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bar_recipes" ADD CONSTRAINT "bar_recipes_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bar_ingredients_category_idx" ON "bar_ingredients" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "bar_recipe_ingredients_recipe_idx" ON "bar_recipe_ingredients" USING btree ("recipe_id","sort_order");--> statement-breakpoint
CREATE INDEX "bar_recipe_ingredients_ingredient_idx" ON "bar_recipe_ingredients" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "bar_recipes_status_idx" ON "bar_recipes" USING btree ("status");
--> statement-breakpoint
-- These are ordinary Owner-managed labels, not an enum or a fixed frontend list.
INSERT INTO bar_ingredient_categories (name, sort_order)
VALUES ('金酒', 10), ('朗姆', 20), ('威士忌', 30), ('伏特加', 40), ('龙舌兰', 50),
  ('白兰地', 60), ('利口酒', 70), ('味美思', 80), ('苦精', 90), ('果汁', 100),
  ('水果', 110), ('糖浆', 120), ('汽水', 130), ('乳制品', 140), ('其他', 150)
ON CONFLICT (name) DO NOTHING;
--> statement-breakpoint
INSERT INTO bar_ingredients (code, name, name_en, category_id, sort_order)
SELECT source.code, source.name, source.name_en, category.id, source.sort_order
FROM (VALUES ('ice', '冰', 'Ice', 99998), ('water', '普通饮用水', 'Drinking water', 99999))
  AS source(code, name, name_en, sort_order)
CROSS JOIN bar_ingredient_categories AS category WHERE category.name = '其他'
ON CONFLICT (code) DO NOTHING;
--> statement-breakpoint
CREATE FUNCTION bar_protect_ingredient_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.code IN ('ice', 'water') THEN RAISE EXCEPTION 'System bar ingredients cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF NEW.code IS DISTINCT FROM OLD.code OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Bar ingredient identity is immutable';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER bar_ingredient_identity_guard BEFORE UPDATE OR DELETE ON bar_ingredients
FOR EACH ROW EXECUTE FUNCTION bar_protect_ingredient_identity();
