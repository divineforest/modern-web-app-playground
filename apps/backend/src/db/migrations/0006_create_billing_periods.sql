-- Create billing_periods table (managed by core service in production, but needed for tests)
-- Using IF NOT EXISTS because in production this table is created by the core service
CREATE TABLE IF NOT EXISTS "billing_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE cascade,
	"start_date" timestamp DEFAULT now() NOT NULL,
	"end_date" timestamp DEFAULT now() NOT NULL,
	"is_approved" varchar(10) DEFAULT 'false' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
