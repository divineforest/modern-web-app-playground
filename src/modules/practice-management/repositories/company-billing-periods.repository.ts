import { and, asc, eq, sql } from 'drizzle-orm';
import type { Database } from '../../../db/connection.js';
import { db } from '../../../db/connection.js';
import { billingPeriods, companies } from '../../../db/schema-core.js';

/**
 * Company and billing period pairing for job generation
 */
export interface CompanyBillingPeriodPair {
  companyId: string;
  billingPeriodId: string;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
}

/**
 * Filter options for company billing period discovery
 */
export interface CompanyBillingPeriodFilters {
  /** Filter by billing period end date range (for backfill operations) */
  endDateRange?: {
    start?: Date;
    end?: Date;
  };
  /** Limit for batch processing */
  limit?: number;
}

/**
 * Repository for discovering eligible companies with their approved billing periods
 *
 * This repository performs cross-microservice queries to find companies that:
 * - Have status = 'in_service'
 * - Have billing enabled (billing_settings.isBillingEnabled = true)
 * - Have a billing address (billing_address IS NOT NULL)
 * - Have approved billing periods (billing_periods.is_approved = 'TRUE')
 * - Don't already have jobs for those billing periods (deduplication)
 */

/**
 * Find eligible companies with their latest approved billing period
 *
 * Performs a single JOIN query across core microservice tables and local jobs table
 * to discover company-period pairs that need job creation.
 *
 * @param filters Optional filters for date range and pagination
 * @param database Database connection (defaults to main db)
 * @returns Array of company-billing period pairs
 */
export async function findEligibleCompaniesWithLatestPeriod(
  filters: CompanyBillingPeriodFilters = {},
  database: Database = db
): Promise<CompanyBillingPeriodPair[]> {
  const { limit = 100 } = filters || {};

  // Build the complex JOIN query as specified in the requirements
  const approvedBillingPeriods = database.$with('approvedBillingPeriods').as(
    database
      .select({
        company_id: sql<string>`${companies.id}`.as('company_id'),
        billing_period_id: sql<string>`${billingPeriods.id}`.as('billing_period_id'),
        billing_period_start: sql<Date>`${billingPeriods.startDate}`.as('billing_period_start'),
        billing_period_end: sql<Date>`${billingPeriods.endDate}`.as('billing_period_end'),
        row_number:
          sql<number>`ROW_NUMBER() OVER (PARTITION BY ${companies.id} ORDER BY ${billingPeriods.endDate} DESC)`.as(
            'row_number'
          ),
      })
      .from(companies)
      .innerJoin(billingPeriods, eq(companies.id, billingPeriods.companyId))
      .where(
        and(
          // Company eligibility filters
          sql`companies.status = 'in_service'`,
          sql`companies.billing_settings->>'isBillingEnabled' = 'true'`,
          sql`companies.billing_address IS NOT NULL`,

          // Billing period approval filter
          sql`billing_periods.is_approved = 'TRUE'`
        )
      )
  );

  // Apply filter to get only the latest billing period per company using a correlated subquery
  const results = await database
    .with(approvedBillingPeriods)
    .select({
      companyId: approvedBillingPeriods.company_id,
      billingPeriodId: approvedBillingPeriods.billing_period_id,
      billingPeriodStart: approvedBillingPeriods.billing_period_start,
      billingPeriodEnd: approvedBillingPeriods.billing_period_end,
    })
    .from(approvedBillingPeriods)
    // Select only the latest period per company
    .where(
      and(
        sql`row_number = 1`,
        sql`NOT EXISTS (
        SELECT 1 FROM jobs
        WHERE jobs.company_id = "approvedBillingPeriods".company_id
          AND jobs.billing_period_id = "approvedBillingPeriods".billing_period_id
      )`
      )
    )
    .orderBy(
      asc(approvedBillingPeriods.billing_period_end),
      asc(approvedBillingPeriods.company_id),
      asc(approvedBillingPeriods.billing_period_id)
    )
    .limit(limit);

  return results.map((result) => ({
    companyId: result.companyId,
    billingPeriodId: result.billingPeriodId,
    billingPeriodStart:
      result.billingPeriodStart instanceof Date
        ? result.billingPeriodStart
        : new Date(result.billingPeriodStart),
    billingPeriodEnd:
      result.billingPeriodEnd instanceof Date
        ? result.billingPeriodEnd
        : new Date(result.billingPeriodEnd),
  }));
}
