-- Create invoices table (new table not in previous migrations)
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"company_id" uuid NOT NULL,
	"contact_id" uuid,
	"type" varchar(32) NOT NULL,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"invoice_number" text NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date,
	"paid_at" timestamp with time zone,
	"currency" varchar(3) NOT NULL,
	"total_amount" text NOT NULL,
	"description" text,
	CONSTRAINT "invoices_type_check" CHECK ("invoices"."type" IN ('sales', 'purchase')),
	CONSTRAINT "invoices_status_check" CHECK ("invoices"."status" IN ('draft', 'sent', 'paid', 'overdue', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contact_id_global_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."global_contacts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_invoices_company_invoice_number" ON "invoices" USING btree ("company_id","invoice_number");--> statement-breakpoint
CREATE INDEX "idx_invoices_company_id" ON "invoices" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_contact_id" ON "invoices" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_status" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_invoices_type" ON "invoices" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_invoices_issue_date" ON "invoices" USING btree ("issue_date");