import * as Sentry from '@sentry/node';
import { eq } from 'drizzle-orm';
import type { Database } from '../../../db/connection.js';
import { db } from '../../../db/connection.js';
import { serviceTypes } from '../../../db/schema-local.js';
import { env } from '../../../lib/env.js';
import { logger } from '../../../lib/logger.js';
import type { CreateJobInput } from '../domain/job.types.js';
import type { CompanyBillingPeriodPair } from '../repositories/company-billing-periods.repository.js';
import { findEligibleCompaniesWithLatestPeriod } from '../repositories/company-billing-periods.repository.js';
import { createJobService } from './jobs.service.js';

/**
 * Format a Date to YYYY-MM-DD string using LOCAL time components
 *
 * IMPORTANT: PostgreSQL `timestamp without time zone` columns return Date objects
 * where the LOCAL time components match the stored date/time values.
 *
 * PostgreSQL driver (postgres.js) returns timestamp without time zone as strings
 * like '2024-04-01 00:00:00'. JavaScript's Date constructor interprets these
 * WITHOUT the 'Z' suffix as LOCAL time, so:
 * - getFullYear(), getMonth(), getDate() return the correct values
 * - getUTCFullYear(), etc. would shift based on timezone offset
 *
 * @param date Date object from database (timestamp without time zone)
 * @returns Date string in YYYY-MM-DD format
 */
function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Execution statistics for job generation runs
 */
export interface JobGenerationStatistics {
  companiesProcessed: number;
  periodsDiscovered: number;
  jobsCreated: number;
  jobsFailed: number;
  executionDurationMs: number;
}

/**
 * Configuration for job generation execution
 */
export interface JobGenerationConfig {
  /** Execution ID for logging and tracking */
  executionId: string;
}

/**
 * Service for automatic job generation from billing periods
 *
 * This service handles the core business logic for:
 * - Discovering eligible companies with approved billing periods
 * - Creating jobs with proper field mapping and due date calculation
 * - Retrying failed job creations with exponential backoff
 * - Providing comprehensive logging and error handling
 * - Calculating execution statistics
 */
export class AutomaticJobGenerationService {
  private readonly legacyServiceTypeIdCache: string | null = null;

  /**
   * Get or cache the LEGACY service type UUID
   *
   * @param database Database connection (defaults to main db)
   * @returns LEGACY service type UUID
   * @throws Error if LEGACY service type is not found
   */
  async getLegacyServiceTypeId(database: Database = db): Promise<string> {
    if (this.legacyServiceTypeIdCache) {
      return this.legacyServiceTypeIdCache;
    }

    const [serviceType] = await database
      .select({ id: serviceTypes.id })
      .from(serviceTypes)
      .where(eq(serviceTypes.code, 'LEGACY'))
      .limit(1);

    if (!serviceType) {
      const error = new Error('LEGACY service type not found in service_types table');
      logger.error(
        error,
        'LEGACY service type not found - ensure database migration ran successfully'
      );
      throw error;
    }

    const serviceTypeId = serviceType.id;

    // Cache the result for this instance
    (this as unknown as { legacyServiceTypeIdCache: string | null }).legacyServiceTypeIdCache =
      serviceTypeId;

    logger.info({ serviceTypeId: serviceTypeId }, 'LEGACY service type resolved and cached');

    return serviceTypeId;
  }

  /**
   * Generate job title from service type and billing period
   *
   * @param periodStart Billing period start date
   * @returns Formatted job title (e.g., "LEGACY - January 2024")
   */
  generateJobTitle(periodStart: Date): string {
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    // Use LOCAL time methods because PostgreSQL `timestamp without time zone`
    // is returned by the driver as local time (without the 'Z' suffix).
    // The local date/time components match the stored values.
    const month = monthNames[periodStart.getMonth()];
    const year = periodStart.getFullYear();

    return `LEGACY - ${month} ${year}`;
  }

  /**
   * Calculate due date from billing period end with configurable offset
   *
   * IMPORTANT TIMEZONE HANDLING:
   * - Billing periods (billing_periods table) use `timestamp without time zone`
   * - Jobs (jobs table) use `timestamp with time zone` for due_at
   *
   * When PostgreSQL returns billing period dates, they come without timezone info.
   * This function explicitly uses UTC methods (setUTCHours, etc.) to ensure:
   * 1. Due dates are calculated consistently regardless of system timezone
   * 2. The resulting Date object can be safely stored in the jobs.due_at column
   * 3. DST transitions don't cause unexpected date shifts
   *
   * @param periodEnd Billing period end date (from billing_periods.end_date)
   * @returns Due date as Date object with explicit UTC time (for jobs.due_at)
   */
  calculateDueDate(periodEnd: Date): Date {
    const dueDate = new Date(periodEnd);

    // Add offset days using UTC date to avoid DST issues
    dueDate.setDate(dueDate.getDate() + env.JOB_GENERATION_DUE_OFFSET_DAYS);

    // Set the time to the configured hour in UTC (default 17:00 UTC)
    // This ensures the timestamp is properly stored in timestamptz column
    dueDate.setUTCHours(env.JOB_GENERATION_DUE_HOUR, 0, 0, 0);

    return dueDate;
  }

  /**
   * Utility helper for sleep/delay functionality
   *
   * @param ms Milliseconds to sleep
   * @returns Promise that resolves after the specified delay
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a job for a specific company-billing period pair with retry logic
   *
   * @param pair Company and billing period information
   * @param serviceTypeId LEGACY service type UUID
   * @param config Execution configuration
   * @param database Database connection
   * @returns Created job ID or null if failed after retries
   */
  async createJobForBillingPeriod(
    pair: CompanyBillingPeriodPair,
    serviceTypeId: string,
    config: JobGenerationConfig,
    database: Database = db
  ): Promise<string | null> {
    const { companyId, billingPeriodId, billingPeriodStart, billingPeriodEnd } = pair;

    /**
     * TIMEZONE HANDLING NOTE:
     * - billingPeriodStart/End come from billing_periods table (timestamp without time zone)
     * - dueAt is calculated using UTC methods and stored in jobs.due_at (timestamp with time zone)
     * - periodStart/End are stored in jobs.period_start/end (date columns - YYYY-MM-DD format)
     *
     * Date-only strings are derived by calling formatDateToYYYYMMDD(), which uses local
     * date components (getFullYear/getMonth/getDate) to correctly handle PostgreSQL
     * timestamp without time zone values—the driver returns these as local time, so
     * local getters yield the correct stored date.
     */
    const jobInput: CreateJobInput = {
      companyId,
      serviceTypeId,
      title: this.generateJobTitle(billingPeriodStart),
      status: 'planned',
      dueAt: this.calculateDueDate(billingPeriodEnd),
      periodStart: formatDateToYYYYMMDD(billingPeriodStart),
      periodEnd: formatDateToYYYYMMDD(billingPeriodEnd),
      billingPeriodId,
    };

    // Retry logic with exponential backoff (up to 3 retries)
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const job = await createJobService(jobInput, database);

        logger.info(
          {
            executionId: config.executionId,
            jobId: job.id,
            companyId,
            billingPeriodId,
            periodStart: billingPeriodStart,
            periodEnd: billingPeriodEnd,
            attempt,
          },
          'Created job for billing period'
        );

        return job.id;
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delayMs = 2 ** (attempt - 1) * 1000;

          logger.warn(
            {
              executionId: config.executionId,
              companyId,
              billingPeriodId,
              attempt,
              maxRetries,
              delayMs,
              error: lastError.message,
            },
            'Job creation failed, retrying with exponential backoff'
          );

          await this.sleep(delayMs);
        } else {
          logger.error(
            {
              ...jobInput,
              attempt,
              maxRetries,
              error: lastError,
            },
            'Job creation failed after all retries, reporting to Sentry'
          );

          Sentry.captureException(lastError, {
            tags: {
              component: 'automatic-job-generation',
              executionId: config.executionId,
            },
            extra: {
              ...jobInput,
            },
          });
        }
      }
    }

    return null;
  }

  /**
   * Process company-billing period pairs in batches and create jobs
   *
   * @param pairs Array of company-billing period pairs to process
   * @param config Execution configuration
   * @param database Database connection
   * @returns Processing statistics
   */
  async processCompanyBillingPeriodPairs(
    pairs: CompanyBillingPeriodPair[],
    config: JobGenerationConfig,
    database: Database = db
  ): Promise<{ jobsCreated: number; jobsFailed: number }> {
    let jobsCreated = 0;
    let jobsFailed = 0;

    // Get LEGACY service type ID once for all job creations
    const serviceTypeId = await this.getLegacyServiceTypeId(database);

    logger.info(
      {
        executionId: config.executionId,
        totalPairs: pairs.length,
        serviceTypeId,
      },
      'Starting to process company-billing period pairs'
    );

    // Process each pair individually (continues on individual failures)
    for (const pair of pairs) {
      try {
        const jobId = await this.createJobForBillingPeriod(pair, serviceTypeId, config, database);

        if (jobId) {
          jobsCreated++;
        } else {
          jobsFailed++;
        }
      } catch (error) {
        jobsFailed++;
        logger.error(
          {
            executionId: config.executionId,
            companyId: pair.companyId,
            billingPeriodId: pair.billingPeriodId,
            error,
          },
          'Unexpected error processing company-billing period pair'
        );
      }
    }

    logger.info(
      {
        executionId: config.executionId,
        jobsCreated,
        jobsFailed,
        totalProcessed: pairs.length,
      },
      'Completed processing company-billing period pairs'
    );

    return { jobsCreated, jobsFailed };
  }

  /**
   * Execute automatic job generation
   *
   * This is the main entry point for the job generation process.
   * It handles discovery, processing, and statistics calculation.
   *
   * @param config Execution configuration
   * @param database Database connection
   * @returns Execution statistics
   */
  async executeJobGeneration(
    config: JobGenerationConfig,
    database: Database = db
  ): Promise<JobGenerationStatistics> {
    const startTime = Date.now();
    const { executionId } = config;

    logger.info(
      {
        executionId,
      },
      'Starting automatic job generation'
    );

    try {
      // Process in batches to manage memory efficiently
      const batchSize = env.JOB_GENERATION_BATCH_SIZE || 100;
      let totalJobsCreated = 0;
      let totalJobsFailed = 0;
      let totalPairsProcessed = 0;
      let batchNumber = 0;

      // Continue querying batches until no more results are returned
      while (true) {
        batchNumber++;

        const pairs = await findEligibleCompaniesWithLatestPeriod({ limit: batchSize }, database);

        // If no more pairs returned, we're done
        if (pairs.length === 0) {
          logger.debug(
            {
              executionId,
              batchNumber,
            },
            'No more company-period pairs found, completing batch processing'
          );
          break;
        }

        const { jobsCreated, jobsFailed } = await this.processCompanyBillingPeriodPairs(
          pairs,
          config,
          database
        );

        totalJobsCreated += jobsCreated;
        totalJobsFailed += jobsFailed;
        totalPairsProcessed += pairs.length;

        logger.debug(
          {
            executionId,
            batchNumber,
            batchPairsProcessed: pairs.length,
            batchJobsCreated: jobsCreated,
            batchJobsFailed: jobsFailed,
            cumulativePairsProcessed: totalPairsProcessed,
            cumulativeJobsCreated: totalJobsCreated,
            cumulativeJobsFailed: totalJobsFailed,
          },
          `Processed batch ${batchNumber}`
        );
      }

      const endTime = Date.now();
      const executionDurationMs = endTime - startTime;

      const statistics: JobGenerationStatistics = {
        companiesProcessed: totalPairsProcessed,
        periodsDiscovered: totalPairsProcessed,
        jobsCreated: totalJobsCreated,
        jobsFailed: totalJobsFailed,
        executionDurationMs,
      };

      logger.info(
        {
          executionId,
          statistics,
        },
        'Completed automatic job generation'
      );

      return statistics;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error(
        {
          executionId,
          error,
          executionDurationMs: duration,
        },
        'Automatic job generation failed'
      );

      Sentry.captureException(error, {
        tags: {
          component: 'automatic-job-generation',
          executionId,
        },
      });

      throw error;
    }
  }
}

// Export singleton instance for convenience
export const automaticJobGenerationService = new AutomaticJobGenerationService();
