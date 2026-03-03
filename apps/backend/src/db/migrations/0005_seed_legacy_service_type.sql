-- Seed LEGACY service type for automatic job generation
-- This migration is idempotent and can be safely re-run
INSERT INTO "service_types" ("id", "code", "name", "status", "created_at", "updated_at") VALUES
	(
		gen_random_uuid(),
		'LEGACY',
		'Legacy Accounting Services',
		'active',
		now(),
		now()
	)
ON CONFLICT (code) DO NOTHING;
