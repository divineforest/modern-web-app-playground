-- Add bob_id column to global_contacts_companies table
-- This column stores the Bob contact ID when a matching bob_contacts record is found

ALTER TABLE "global_contacts_companies" 
  ADD COLUMN IF NOT EXISTS "bob_id" varchar(100);

-- Create bob_contacts table for test environment
-- This table exists in production core microservice but may be missing from test schema
CREATE TABLE IF NOT EXISTS "bob_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"vat_id" varchar(20),
	"bob_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Create index for efficient lookup by company_id and vat_id
CREATE INDEX IF NOT EXISTS "idx_bob_contacts_company_vat" 
  ON "bob_contacts" USING btree ("company_id", "vat_id");
