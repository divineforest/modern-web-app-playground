-- Add bob_reference_id column to companies table for testing
-- This column exists in production core microservice but was missing from test schema
ALTER TABLE companies 
  ADD COLUMN IF NOT EXISTS bob_reference_id varchar;

CREATE TABLE "global_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"entity_type" varchar(32) DEFAULT 'legal_entity' NOT NULL,
	"source" varchar(32) NOT NULL,
	"phone" varchar(50),
	"vat_id" varchar(20),
	"vat_type" varchar(32),
	"tax_number" varchar(30),
	"contact_person" text,
	"country_code" varchar(2),
	"billing_address" jsonb,
	"postal_address" jsonb,
	"raw_extraction" jsonb,
	"raw_vies_response" jsonb,
	"is_valid_vat_id" boolean DEFAULT false NOT NULL,
	"vat_id_validated_at" timestamp with time zone,
	CONSTRAINT "global_contacts_entity_type_check" CHECK ("global_contacts"."entity_type" IN ('legal_entity', 'individual')),
	CONSTRAINT "global_contacts_source_check" CHECK ("global_contacts"."source" IN ('ocr', 'vies')),
	CONSTRAINT "global_contacts_vat_type_check" CHECK ("global_contacts"."vat_type" IS NULL OR "global_contacts"."vat_type" IN ('eligible', 'exempt')),
	CONSTRAINT "global_contacts_vat_id_format_check" CHECK ("global_contacts"."vat_id" IS NULL OR "global_contacts"."vat_id" ~ '^[A-Z]{2}[A-Z0-9]+$')
);
--> statement-breakpoint
CREATE TABLE "global_contacts_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"global_contact_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"role" varchar(32) NOT NULL,
	CONSTRAINT "global_contacts_companies_role_check" CHECK ("global_contacts_companies"."role" IN ('customer', 'supplier'))
);
--> statement-breakpoint
ALTER TABLE "global_contacts_companies" ADD CONSTRAINT "global_contacts_companies_global_contact_id_global_contacts_id_fk" FOREIGN KEY ("global_contact_id") REFERENCES "public"."global_contacts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "global_contacts_companies" ADD CONSTRAINT "global_contacts_companies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_global_contacts_vat_id" ON "global_contacts" USING btree ("vat_id") WHERE "global_contacts"."vat_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_global_contacts_country_code" ON "global_contacts" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "idx_global_contacts_source" ON "global_contacts" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_global_contacts_is_valid_vat_id" ON "global_contacts" USING btree ("is_valid_vat_id");--> statement-breakpoint
CREATE INDEX "idx_global_contacts_entity_type" ON "global_contacts" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "idx_global_contacts_updated_at_id" ON "global_contacts" USING btree ("updated_at","id");--> statement-breakpoint
CREATE INDEX "idx_global_contacts_created_at_id" ON "global_contacts" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "idx_global_contacts_name_id" ON "global_contacts" USING btree ("name","id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_global_contacts_companies_unique" ON "global_contacts_companies" USING btree ("global_contact_id","company_id","role");--> statement-breakpoint
CREATE INDEX "idx_global_contacts_companies_company_role" ON "global_contacts_companies" USING btree ("company_id","role");--> statement-breakpoint
CREATE INDEX "idx_global_contacts_companies_contact_id" ON "global_contacts_companies" USING btree ("global_contact_id");
