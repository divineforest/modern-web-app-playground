ALTER TABLE "orders" DROP CONSTRAINT "orders_status_check";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_transaction_id" text;--> statement-breakpoint
CREATE INDEX "idx_orders_payment_transaction_id" ON "orders" USING btree ("payment_transaction_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_status_check" CHECK ("orders"."status" IN ('draft', 'confirmed', 'processing', 'shipped', 'fulfilled', 'paid', 'cancelled'));