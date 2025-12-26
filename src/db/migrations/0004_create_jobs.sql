-- Create jobs table with all constraints and indexes
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"company_id" uuid NOT NULL,
	"service_type_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" varchar(32) DEFAULT 'planned' NOT NULL,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"assignee_id" uuid,
	"period_start" date,
	"period_end" date,
	CONSTRAINT "jobs_status_check" CHECK ("jobs"."status" IN ('planned', 'in_progress', 'completed', 'canceled'))
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_service_type_id_service_types_id_fk" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
CREATE INDEX "idx_jobs_company_id" ON "jobs" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX "idx_jobs_service_type_id" ON "jobs" USING btree ("service_type_id");
--> statement-breakpoint
CREATE INDEX "idx_jobs_status" ON "jobs" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "idx_jobs_assignee_id" ON "jobs" USING btree ("assignee_id");
--> statement-breakpoint
CREATE INDEX "idx_jobs_due_at" ON "jobs" USING btree ("due_at");


