ALTER TABLE "jobs" ADD COLUMN "billing_period_id" uuid;
--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_billing_period_id_billing_periods_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_periods"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_jobs_unique_billing_period" ON "jobs" USING btree ("billing_period_id") WHERE "billing_period_id" IS NOT NULL;
