ALTER TABLE "billing_periods" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "job_templates" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "jobs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "billing_periods" CASCADE;--> statement-breakpoint
DROP TABLE "job_templates" CASCADE;--> statement-breakpoint
DROP TABLE "jobs" CASCADE;--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_status_check";--> statement-breakpoint
DROP INDEX "idx_invoices_company_invoice_number";--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "invoice_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "issue_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "currency" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "total_amount" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_invoices_company_invoice_number" ON "invoices" USING btree ("company_id","invoice_number") WHERE "invoices"."invoice_number" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_status_check" CHECK ("invoices"."status" IN ('new', 'draft', 'sent', 'paid', 'overdue', 'cancelled'));