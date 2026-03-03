CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sku" text NOT NULL,
	"description" text,
	"short_description" text,
	"category" text,
	"tags" jsonb,
	"currency" varchar(3) NOT NULL,
	"price" numeric(15, 2) NOT NULL,
	"compare_at_price" numeric(15, 2),
	"cost_price" numeric(15, 2),
	"weight" numeric(15, 2),
	"width" numeric(15, 2),
	"height" numeric(15, 2),
	"length" numeric(15, 2),
	CONSTRAINT "products_status_check" CHECK ("products"."status" IN ('draft', 'active', 'archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_products_sku" ON "products" USING btree ("sku");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_products_slug" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_products_status" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_products_category" ON "products" USING btree ("category");