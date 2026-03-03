-- Create companies table (managed by core service in production, but needed for tests)
-- Using IF NOT EXISTS because in production this table is created by the core service
CREATE TABLE IF NOT EXISTS "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"billing_inbound_token" text NOT NULL,
	CONSTRAINT "companies_billing_inbound_token_unique" UNIQUE("billing_inbound_token")
);
--> statement-breakpoint

-- Create job_templates table
CREATE TABLE "job_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"code" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_active" varchar(10) DEFAULT 'true' NOT NULL,
	"default_assignee_id" uuid,
	"title_pattern" text NOT NULL,
	CONSTRAINT "job_templates_code_unique" UNIQUE("code"),
	CONSTRAINT "code_check" CHECK ("job_templates"."code" ~ '^[A-Z0-9_]+$')
);
