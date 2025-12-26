-- Create service_types table
CREATE TABLE "service_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_types_code_unique" UNIQUE("code"),
	CONSTRAINT "service_types_code_check" CHECK ("service_types"."code" ~ '^[A-Z_]+$'),
	CONSTRAINT "service_types_status_check" CHECK ("service_types"."status" IN ('active', 'deprecated'))
);
--> statement-breakpoint
CREATE INDEX "idx_service_types_status" ON "service_types" USING btree ("status");
--> statement-breakpoint

-- Add service_type_id to job_templates
ALTER TABLE "job_templates" ADD COLUMN "service_type_id" uuid;
--> statement-breakpoint
ALTER TABLE "job_templates" ADD CONSTRAINT "job_templates_service_type_id_service_types_id_fk" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
CREATE INDEX "idx_job_templates_service_type_id" ON "job_templates" USING btree ("service_type_id");
--> statement-breakpoint

-- Seed initial service types
INSERT INTO "service_types" ("code", "name", "description", "status") VALUES
	('PAYROLL', 'Payroll Processing', 'Monthly payroll processing and reporting', 'active'),
	('ACCOUNTING', 'Accounting Services', 'General accounting and bookkeeping', 'active'),
	('VAT', 'VAT Returns', 'VAT return preparation and submission', 'active'),
	('TAX_PREP', 'Tax Preparation', 'Annual tax preparation and filing', 'active'),
	('AUDIT', 'Audit Services', 'Financial audit and review services', 'active')
ON CONFLICT (code) DO NOTHING;

