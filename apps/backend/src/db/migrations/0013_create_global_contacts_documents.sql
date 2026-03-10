-- Create global_contacts_documents join table for contact-document linking
CREATE TABLE "global_contacts_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"global_contact_id" uuid NOT NULL,
	"document_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "global_contacts_documents" ADD CONSTRAINT "global_contacts_documents_global_contact_id_global_contacts_id_fk" FOREIGN KEY ("global_contact_id") REFERENCES "public"."global_contacts"("id") ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
-- Prevent duplicate links (same contact and document)
CREATE UNIQUE INDEX "idx_global_contacts_documents_unique" ON "global_contacts_documents" USING btree ("global_contact_id","document_id");
--> statement-breakpoint
-- Index for efficient document lookups
CREATE INDEX "idx_global_contacts_documents_document_id" ON "global_contacts_documents" USING btree ("document_id");
--> statement-breakpoint
-- Index for efficient contact lookups
CREATE INDEX "idx_global_contacts_documents_contact_id" ON "global_contacts_documents" USING btree ("global_contact_id");
