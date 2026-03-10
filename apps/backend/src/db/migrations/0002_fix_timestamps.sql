-- Fix timestamp columns to use timezone-aware timestamps
ALTER TABLE "job_templates" 
	ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone,
	ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;
