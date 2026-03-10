-- Create users table (managed by core microservice but needed for FK reference)
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"email" varchar NOT NULL,
	"is_admin" boolean DEFAULT false,
	"password" varchar NOT NULL,
	"salt" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"confirmed_email_at" timestamp,
	"phone" varchar(30),
	"locale" varchar(10) DEFAULT 'en-GB',
	"admin_role" varchar,
	"admin_company_ids" text[],
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_opted_in_to_marketing" boolean DEFAULT false NOT NULL,
	"plain_customer_id" varchar,
	"plain_last_synced_at" timestamp,
	CONSTRAINT "UQ_users_email" UNIQUE("email")
);
--> statement-breakpoint

-- Add foreign key constraint from jobs.assignee_id to users.id
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;
