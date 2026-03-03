CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"order_number" text NOT NULL,
	"reference_number" text,
	"order_date" date NOT NULL,
	"expected_delivery_date" date,
	"currency" varchar(3) NOT NULL,
	"subtotal" text NOT NULL,
	"tax_amount" text DEFAULT '0.00' NOT NULL,
	"discount_amount" text DEFAULT '0.00' NOT NULL,
	"shipping_amount" text DEFAULT '0.00' NOT NULL,
	"total_amount" text NOT NULL,
	"shipping_address" text,
	"billing_address" text,
	"payment_terms" varchar(64),
	"notes" text,
	"customer_notes" text,
	CONSTRAINT "orders_status_check" CHECK ("orders"."status" IN ('draft', 'confirmed', 'processing', 'shipped', 'fulfilled', 'cancelled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_orders_order_number" ON "orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "idx_orders_status" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_orders_order_date" ON "orders" USING btree ("order_date");