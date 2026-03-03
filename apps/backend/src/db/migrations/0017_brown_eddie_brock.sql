ALTER TABLE "bob_contacts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "global_contacts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "global_contacts_companies" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "global_contacts_documents" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "bob_contacts" CASCADE;--> statement-breakpoint
DROP TABLE "global_contacts" CASCADE;--> statement-breakpoint
DROP TABLE "global_contacts_companies" CASCADE;--> statement-breakpoint
DROP TABLE "global_contacts_documents" CASCADE;