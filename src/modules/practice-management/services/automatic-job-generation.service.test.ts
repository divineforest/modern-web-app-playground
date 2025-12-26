import * as Sentry from '@sentry/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestBillingPeriod } from '../../../../tests/factories/billing-periods.js';
import { createTestCompany } from '../../../../tests/factories/companies.js';
import { getFirstServiceType } from '../../../../tests/factories/service-types.js';
import type { Database } from '../../../db/connection.js';
import { db } from '../../../db/index.js';
import { serviceTypes } from '../../../db/schema-local.js';
import { env } from '../../../lib/env.js';
import type { Job } from '../domain/job.entity.js';
import type { CompanyBillingPeriodPair } from '../repositories/company-billing-periods.repository.js';
import { findEligibleCompaniesWithLatestPeriod } from '../repositories/company-billing-periods.repository.js';
import {
  AutomaticJobGenerationService,
  type JobGenerationConfig,
} from './automatic-job-generation.service.js';
import { createJobService } from './jobs.service.js';

// Mock dependencies
vi.mock('./jobs.service.js');
vi.mock('../repositories/company-billing-periods.repository.js');
vi.mock('@sentry/node');

/**
 * Format a Date to YYYY-MM-DD string using LOCAL time components.
 *
 * NOTE: This helper intentionally duplicates the logic in the production
 * `formatDateToYYYYMMDD` function. This is NOT a DRY violation - it's a
 * deliberate testing pattern:
 *
 * 1. Tests should independently verify expected behavior, not use the same
 *    function to generate both expected and actual values (tautological testing).
 *
 * 2. The production function is intentionally private/non-exported. Exporting
 *    it solely for tests would expose internal implementation details.
 *
 * 3. If the production function has a bug, tests using this independent helper
 *    will catch it (expected ≠ actual). If we imported the production function,
 *    both values would be equally wrong and the test would falsely pass.
 *
 * @see https://kentcdodds.com/blog/testing-implementation-details
 */
function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('AutomaticJobGenerationService', () => {
  let service: AutomaticJobGenerationService;
  let config: JobGenerationConfig;

  beforeEach(() => {
    service = new AutomaticJobGenerationService();
    config = {
      executionId: 'test-execution-123',
    };
    vi.clearAllMocks();
  });

  describe('getLegacyServiceTypeId', () => {
    it('should query and return LEGACY service type UUID', async () => {
      // ACT
      const result = await service.getLegacyServiceTypeId(db);

      // ASSERT
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should cache LEGACY service type UUID on subsequent calls', async () => {
      // ACT
      const result1 = await service.getLegacyServiceTypeId(db);
      const result2 = await service.getLegacyServiceTypeId(db);
      const result3 = await service.getLegacyServiceTypeId(db);

      // ASSERT
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result3).toBeDefined();
      // Cache should return same value without additional queries
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('should only call database once when getter is called multiple times (caching)', async () => {
      // ARRANGE
      // Create a new service instance for this test to ensure clean cache state
      const testService = new AutomaticJobGenerationService();

      // Create a mock database with a spy to track how many times select is called
      const mockLimitFn = vi.fn().mockResolvedValue([{ id: 'test-service-type-uuid-123' }]);
      const mockWhereFn = vi.fn().mockReturnValue({
        limit: mockLimitFn,
      });
      const mockFromFn = vi.fn().mockReturnValue({
        where: mockWhereFn,
      });
      const mockSelectFn = vi.fn().mockReturnValue({
        from: mockFromFn,
      });

      const mockDb = {
        select: mockSelectFn,
      } as unknown as Database;

      // ACT
      const result1 = await testService.getLegacyServiceTypeId(mockDb);
      const result2 = await testService.getLegacyServiceTypeId(mockDb);
      const result3 = await testService.getLegacyServiceTypeId(mockDb);

      // ASSERT
      // All results should be the same UUID
      expect(result1).toBe('test-service-type-uuid-123');
      expect(result2).toBe('test-service-type-uuid-123');
      expect(result3).toBe('test-service-type-uuid-123');

      // Database select should only be called ONCE (first call)
      expect(mockSelectFn).toHaveBeenCalledTimes(1);
      expect(mockFromFn).toHaveBeenCalledTimes(1);
      expect(mockWhereFn).toHaveBeenCalledTimes(1);
      expect(mockLimitFn).toHaveBeenCalledTimes(1);

      // Verify select was called with correct field
      expect(mockSelectFn).toHaveBeenCalledWith({ id: serviceTypes.id });
    });

    it('should throw error if LEGACY service type not found', async () => {
      // ARRANGE
      // Create a new service instance for this test
      const testService = new AutomaticJobGenerationService();

      // Mock the database to return empty result
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };

      // ACT & ASSERT
      await expect(
        testService.getLegacyServiceTypeId(mockDb as unknown as Database)
      ).rejects.toThrow('LEGACY service type not found in service_types table');
    });
  });

  describe('generateJobTitle', () => {
    it('should generate job title from period start date', () => {
      // ARRANGE
      const periodStart = new Date('2024-01-15');

      // ACT
      const title = service.generateJobTitle(periodStart);

      // ASSERT
      expect(title).toBe('LEGACY - January 2024');
    });

    it('should handle different months correctly', () => {
      // ARRANGE
      const testCases = [
        { date: new Date('2024-01-01'), expected: 'LEGACY - January 2024' },
        { date: new Date('2024-02-15'), expected: 'LEGACY - February 2024' },
        { date: new Date('2024-03-31'), expected: 'LEGACY - March 2024' },
        { date: new Date('2024-04-10'), expected: 'LEGACY - April 2024' },
        { date: new Date('2024-05-20'), expected: 'LEGACY - May 2024' },
        { date: new Date('2024-06-30'), expected: 'LEGACY - June 2024' },
        { date: new Date('2024-07-15'), expected: 'LEGACY - July 2024' },
        { date: new Date('2024-08-25'), expected: 'LEGACY - August 2024' },
        { date: new Date('2024-09-05'), expected: 'LEGACY - September 2024' },
        { date: new Date('2024-10-12'), expected: 'LEGACY - October 2024' },
        { date: new Date('2024-11-28'), expected: 'LEGACY - November 2024' },
        { date: new Date('2024-12-31'), expected: 'LEGACY - December 2024' },
      ];

      // ACT & ASSERT
      for (const testCase of testCases) {
        const title = service.generateJobTitle(testCase.date);
        expect(title).toBe(testCase.expected);
      }
    });

    it('should handle different years correctly', () => {
      // ARRANGE
      const periodStart2023 = new Date('2023-06-15');
      const periodStart2024 = new Date('2024-06-15');
      const periodStart2025 = new Date('2025-06-15');

      // ACT
      const title2023 = service.generateJobTitle(periodStart2023);
      const title2024 = service.generateJobTitle(periodStart2024);
      const title2025 = service.generateJobTitle(periodStart2025);

      // ASSERT
      expect(title2023).toBe('LEGACY - June 2023');
      expect(title2024).toBe('LEGACY - June 2024');
      expect(title2025).toBe('LEGACY - June 2025');
    });
  });

  describe('calculateDueDate', () => {
    it('should calculate due date from period end with configured offset', () => {
      // ARRANGE
      const periodEnd = new Date('2024-01-31T00:00:00.000Z');
      const expectedDueDate = new Date('2024-02-02T17:00:00.000Z');

      // ACT
      const dueDate = service.calculateDueDate(periodEnd);

      // ASSERT
      expect(dueDate).toEqual(expectedDueDate);
    });

    it('should add offset days from environment configuration', () => {
      // ARRANGE
      const periodEnd = new Date('2024-01-31T00:00:00.000Z');
      const offsetDays = env.JOB_GENERATION_DUE_OFFSET_DAYS;

      // ACT
      const dueDate = service.calculateDueDate(periodEnd);

      // ASSERT
      const expectedDate = new Date(periodEnd);
      expectedDate.setDate(expectedDate.getDate() + offsetDays);
      expectedDate.setUTCHours(env.JOB_GENERATION_DUE_HOUR, 0, 0, 0);
      expect(dueDate).toEqual(expectedDate);
    });

    it('should set time to configured hour in UTC', () => {
      // ARRANGE
      const periodEnd = new Date('2024-01-31T23:59:59.999Z');

      // ACT
      const dueDate = service.calculateDueDate(periodEnd);

      // ASSERT
      expect(dueDate.getUTCHours()).toBe(env.JOB_GENERATION_DUE_HOUR);
      expect(dueDate.getUTCMinutes()).toBe(0);
      expect(dueDate.getUTCSeconds()).toBe(0);
      expect(dueDate.getUTCMilliseconds()).toBe(0);
    });

    describe('Timezone handling between billing periods and jobs', () => {
      /**
       * IMPORTANT: Billing period timestamps are stored WITHOUT timezone (timestamp without time zone)
       * while job due_at is stored WITH timezone (timestamp with time zone).
       *
       * PostgreSQL behavior:
       * - timestamp WITHOUT time zone: stores the literal date/time value, no timezone conversion
       * - timestamp WITH time zone: converts input to UTC for storage, converts to client timezone on retrieval
       *
       * When we read billing period dates from the database, PostgreSQL returns them as-is without
       * timezone conversion. When we create Date objects in JavaScript from these values, they are
       * interpreted in the local/system timezone.
       *
       * The calculateDueDate function explicitly uses setUTCHours() to ensure the due date is
       * calculated in UTC, which is then stored correctly in the jobs.due_at column.
       */

      it('should handle billing period dates without timezone information correctly', () => {
        // ARRANGE
        // Simulate a billing period end date as returned from DB (no timezone)
        // PostgreSQL returns this as a Date object in the local timezone
        const billingPeriodEnd = new Date('2024-01-31T00:00:00.000Z');

        // ACT
        const dueDate = service.calculateDueDate(billingPeriodEnd);

        // ASSERT
        // Due date should be calculated using UTC methods
        expect(dueDate).toBeInstanceOf(Date);
        // Verify the date is offset by configured days
        const expectedDate = new Date(billingPeriodEnd);
        expectedDate.setDate(expectedDate.getDate() + env.JOB_GENERATION_DUE_OFFSET_DAYS);
        expect(dueDate.getUTCFullYear()).toBe(expectedDate.getUTCFullYear());
        expect(dueDate.getUTCMonth()).toBe(expectedDate.getUTCMonth());
        expect(dueDate.getUTCDate()).toBe(expectedDate.getUTCDate());
      });

      it('should produce consistent due dates regardless of system timezone', () => {
        // ARRANGE
        // Same billing period end date
        const billingPeriodEnd = new Date('2024-01-31T00:00:00.000Z');

        // ACT
        const dueDate1 = service.calculateDueDate(billingPeriodEnd);

        // Create the same date but specified differently (should produce same result)
        const billingPeriodEndAlt = new Date(Date.UTC(2024, 0, 31, 0, 0, 0, 0));
        const dueDate2 = service.calculateDueDate(billingPeriodEndAlt);

        // ASSERT
        // Both should produce identical UTC timestamps
        expect(dueDate1.getTime()).toBe(dueDate2.getTime());
        expect(dueDate1.toISOString()).toBe(dueDate2.toISOString());
      });

      it('should calculate due date in UTC to avoid DST issues', () => {
        // ARRANGE
        // Test with a date that might be affected by DST in some timezones
        // March 10, 2024 is when DST starts in US (2am -> 3am)
        const dstTransitionDate = new Date('2024-03-10T00:00:00.000Z');

        // ACT
        const dueDate = service.calculateDueDate(dstTransitionDate);

        // ASSERT
        // Should use UTC hours, not local hours (which might be affected by DST)
        expect(dueDate.getUTCHours()).toBe(env.JOB_GENERATION_DUE_HOUR);
        // The date math should be done in UTC to avoid DST weirdness
        const expectedDateUTC = new Date(dstTransitionDate);
        expectedDateUTC.setDate(expectedDateUTC.getDate() + env.JOB_GENERATION_DUE_OFFSET_DAYS);
        expect(dueDate.getUTCDate()).toBe(expectedDateUTC.getUTCDate());
      });

      it('should handle month boundary correctly when adding offset days', () => {
        // ARRANGE
        // End of January - offset should roll into February
        const januaryEnd = new Date('2024-01-31T00:00:00.000Z');

        // ACT
        const dueDate = service.calculateDueDate(januaryEnd);

        // ASSERT
        // With offset of 2 days, should be Feb 2
        expect(dueDate.getUTCMonth()).toBe(1); // February (0-indexed)
        expect(dueDate.getUTCDate()).toBe(2);
        expect(dueDate.getUTCFullYear()).toBe(2024);
        expect(dueDate.getUTCHours()).toBe(env.JOB_GENERATION_DUE_HOUR);
      });

      it('should handle leap year correctly when adding offset days', () => {
        // ARRANGE
        // 2024 is a leap year, Feb has 29 days
        const febLeapYear = new Date('2024-02-28T00:00:00.000Z');

        // ACT
        const dueDate = service.calculateDueDate(febLeapYear);

        // ASSERT
        // With offset of 2 days from Feb 28, should be Mar 1 in a leap year
        expect(dueDate.getUTCMonth()).toBe(2); // March (0-indexed)
        expect(dueDate.getUTCDate()).toBe(1);
      });

      it('should handle year boundary correctly when adding offset days', () => {
        // ARRANGE
        // End of December
        const decemberEnd = new Date('2024-12-31T00:00:00.000Z');

        // ACT
        const dueDate = service.calculateDueDate(decemberEnd);

        // ASSERT
        // With offset of 2 days, should roll into next year
        expect(dueDate.getUTCFullYear()).toBe(2025);
        expect(dueDate.getUTCMonth()).toBe(0); // January (0-indexed)
        expect(dueDate.getUTCDate()).toBe(2);
      });

      it('should preserve date consistency through ISO string conversion', () => {
        // ARRANGE
        const billingPeriodStart = new Date('2024-01-01T00:00:00.000Z');
        const billingPeriodEnd = new Date('2024-01-31T00:00:00.000Z');

        // ACT
        // This mimics what happens in createJobForBillingPeriod
        const periodStartISO = billingPeriodStart.toISOString();
        const periodEndISO = billingPeriodEnd.toISOString();
        const dueDate = service.calculateDueDate(billingPeriodEnd);

        // ASSERT
        // ISO strings should be consistent
        expect(periodStartISO).toBe('2024-01-01T00:00:00.000Z');
        expect(periodEndISO).toBe('2024-01-31T00:00:00.000Z');
        // Due date should be a proper Date object that can be stored in timestamptz
        expect(dueDate.toISOString()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });
    });
  });

  describe('createJobForBillingPeriod', () => {
    it('should create job with correct field mapping', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const billingPeriod = await createTestBillingPeriod({
        companyId: company.id,
      });
      const serviceType = await getFirstServiceType(db);

      const pair: CompanyBillingPeriodPair = {
        companyId: company.id,
        billingPeriodId: billingPeriod.id,
        billingPeriodStart: billingPeriod.startDate,
        billingPeriodEnd: billingPeriod.endDate,
      };

      const mockJob = {
        id: 'mock-job-id',
        companyId: company.id,
        serviceTypeId: serviceType.id,
        title: 'LEGACY - January 2024',
        status: 'planned' as const,
        billingPeriodId: billingPeriod.id,
      };

      vi.mocked(createJobService).mockResolvedValue(mockJob as Job);

      // ACT
      const jobId = await service.createJobForBillingPeriod(pair, serviceType.id, config, db);

      // ASSERT
      expect(jobId).toBe('mock-job-id');
      expect(createJobService).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: company.id,
          serviceTypeId: serviceType.id,
          billingPeriodId: billingPeriod.id,
          status: 'planned',
          title: expect.stringContaining('LEGACY'),
          dueAt: expect.any(Date),
          periodStart: formatLocalDate(billingPeriod.startDate),
          periodEnd: formatLocalDate(billingPeriod.endDate),
        }),
        db
      );
    });

    it('should correctly convert billing period dates (no TZ) to job due_at (with TZ)', async () => {
      /**
       * IMPORTANT: This test verifies the critical timezone conversion between:
       * - billing_periods.start_date/end_date (timestamp WITHOUT time zone)
       * - jobs.due_at (timestamp WITH time zone)
       *
       * The conversion happens in calculateDueDate() which uses setUTCHours() to ensure
       * the due date is properly calculated in UTC regardless of system timezone.
       */

      // ARRANGE
      const company = await createTestCompany();
      // Create billing period with specific dates (stored as timestamp without tz)
      const billingPeriod = await createTestBillingPeriod({
        companyId: company.id,
        startDate: new Date('2024-01-01T00:00:00.000Z'),
        endDate: new Date('2024-01-31T00:00:00.000Z'),
      });
      const serviceType = await getFirstServiceType(db);

      const pair: CompanyBillingPeriodPair = {
        companyId: company.id,
        billingPeriodId: billingPeriod.id,
        billingPeriodStart: billingPeriod.startDate,
        billingPeriodEnd: billingPeriod.endDate,
      };

      const mockJob = {
        id: 'mock-job-id',
        companyId: company.id,
        serviceTypeId: serviceType.id,
        title: 'LEGACY - January 2024',
        status: 'planned' as const,
        billingPeriodId: billingPeriod.id,
        dueAt: new Date('2024-02-02T17:00:00.000Z'), // Expected due date with TZ
      };

      vi.mocked(createJobService).mockResolvedValue(mockJob as Job);

      // ACT
      const jobId = await service.createJobForBillingPeriod(pair, serviceType.id, config, db);

      // ASSERT
      expect(jobId).toBe('mock-job-id');

      // Verify the dueAt calculation
      const callArgs = vi.mocked(createJobService).mock.calls[0];
      expect(callArgs).toBeDefined();
      const jobInput = callArgs?.[0];
      expect(jobInput).toBeDefined();

      // Due date should be calculated from billing period end + offset
      expect(jobInput?.dueAt).toBeInstanceOf(Date);
      expect(jobInput?.dueAt?.toISOString()).toBe('2024-02-02T17:00:00.000Z');

      // Period dates should be converted to local date strings (YYYY-MM-DD)
      expect(jobInput?.periodStart).toBe(formatLocalDate(billingPeriod.startDate));
      expect(jobInput?.periodEnd).toBe(formatLocalDate(billingPeriod.endDate));
    });

    it('should handle billing period dates around DST transitions correctly', async () => {
      /**
       * This test ensures DST transitions don't cause issues when calculating due dates.
       * The billing period end date might be stored without timezone info, but we need
       * to ensure the due date calculation in UTC is consistent regardless of DST.
       */

      // ARRANGE
      const company = await createTestCompany();
      // March 10, 2024 is DST transition in US (2am -> 3am)
      const billingPeriod = await createTestBillingPeriod({
        companyId: company.id,
        startDate: new Date('2024-03-01T00:00:00.000Z'),
        endDate: new Date('2024-03-10T00:00:00.000Z'), // DST transition date
      });
      const serviceType = await getFirstServiceType(db);

      const pair: CompanyBillingPeriodPair = {
        companyId: company.id,
        billingPeriodId: billingPeriod.id,
        billingPeriodStart: billingPeriod.startDate,
        billingPeriodEnd: billingPeriod.endDate,
      };

      const mockJob = {
        id: 'mock-job-id',
        dueAt: new Date('2024-03-12T17:00:00.000Z'),
      };

      vi.mocked(createJobService).mockResolvedValue(mockJob as Job);

      // ACT
      await service.createJobForBillingPeriod(pair, serviceType.id, config, db);

      // ASSERT
      const callArgs = vi.mocked(createJobService).mock.calls[0];
      expect(callArgs).toBeDefined();
      const jobInput = callArgs?.[0];
      expect(jobInput).toBeDefined();
      expect(jobInput?.dueAt).toBeDefined();

      // Due date should be consistently calculated in UTC
      expect(jobInput?.dueAt?.toISOString()).toBe('2024-03-12T17:00:00.000Z');
      expect(jobInput?.dueAt?.getUTCHours()).toBe(17);
      expect(jobInput?.dueAt?.getUTCDate()).toBe(12);
    });

    it('should retry job creation on transient failures with exponential backoff', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const billingPeriod = await createTestBillingPeriod({
        companyId: company.id,
      });
      const serviceType = await getFirstServiceType(db);

      const pair: CompanyBillingPeriodPair = {
        companyId: company.id,
        billingPeriodId: billingPeriod.id,
        billingPeriodStart: billingPeriod.startDate,
        billingPeriodEnd: billingPeriod.endDate,
      };

      const mockJob = { id: 'mock-job-id' };

      // Fail twice, then succeed
      vi.mocked(createJobService)
        .mockRejectedValueOnce(new Error('Transient DB error'))
        .mockRejectedValueOnce(new Error('Transient DB error'))
        .mockResolvedValueOnce(mockJob as Job);

      // ACT
      const jobId = await service.createJobForBillingPeriod(pair, serviceType.id, config, db);

      // ASSERT
      expect(jobId).toBe('mock-job-id');
      expect(createJobService).toHaveBeenCalledTimes(3);
    });

    it('should return null after max retries exhausted', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const billingPeriod = await createTestBillingPeriod({
        companyId: company.id,
      });
      const serviceType = await getFirstServiceType(db);

      const pair: CompanyBillingPeriodPair = {
        companyId: company.id,
        billingPeriodId: billingPeriod.id,
        billingPeriodStart: billingPeriod.startDate,
        billingPeriodEnd: billingPeriod.endDate,
      };

      // Fail all 3 attempts
      vi.mocked(createJobService).mockRejectedValue(new Error('Persistent DB error'));

      // ACT
      const jobId = await service.createJobForBillingPeriod(pair, serviceType.id, config, db);

      // ASSERT
      expect(jobId).toBeNull();
      expect(createJobService).toHaveBeenCalledTimes(3);
      expect(Sentry.captureException).toHaveBeenCalled();
    });

    it('should report to Sentry after retries exhausted', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const billingPeriod = await createTestBillingPeriod({
        companyId: company.id,
      });
      const serviceType = await getFirstServiceType(db);

      const pair: CompanyBillingPeriodPair = {
        companyId: company.id,
        billingPeriodId: billingPeriod.id,
        billingPeriodStart: billingPeriod.startDate,
        billingPeriodEnd: billingPeriod.endDate,
      };

      const error = new Error('Persistent DB error');
      vi.mocked(createJobService).mockRejectedValue(error);

      // ACT
      await service.createJobForBillingPeriod(pair, serviceType.id, config, db);

      // ASSERT
      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          tags: expect.objectContaining({
            component: 'automatic-job-generation',
            executionId: config.executionId,
          }),
        })
      );
    });
  });

  describe('processCompanyBillingPeriodPairs', () => {
    it('should process empty array and return zero stats', async () => {
      // ARRANGE
      const pairs: CompanyBillingPeriodPair[] = [];
      const serviceType = await getFirstServiceType(db);

      // Manually set cache to avoid DB query
      (service as unknown as { legacyServiceTypeIdCache: string | null }).legacyServiceTypeIdCache =
        serviceType.id;

      // ACT
      const result = await service.processCompanyBillingPeriodPairs(pairs, config, db);

      // ASSERT
      expect(result).toEqual({
        jobsCreated: 0,
        jobsFailed: 0,
      });
    });

    it('should process multiple pairs and return correct statistics', async () => {
      // ARRANGE
      const company1 = await createTestCompany();
      const company2 = await createTestCompany();
      const billingPeriod1 = await createTestBillingPeriod({
        companyId: company1.id,
      });
      const billingPeriod2 = await createTestBillingPeriod({
        companyId: company2.id,
      });

      const pairs: CompanyBillingPeriodPair[] = [
        {
          companyId: company1.id,
          billingPeriodId: billingPeriod1.id,
          billingPeriodStart: billingPeriod1.startDate,
          billingPeriodEnd: billingPeriod1.endDate,
        },
        {
          companyId: company2.id,
          billingPeriodId: billingPeriod2.id,
          billingPeriodStart: billingPeriod2.startDate,
          billingPeriodEnd: billingPeriod2.endDate,
        },
      ];

      vi.mocked(createJobService)
        .mockResolvedValueOnce({ id: 'job-1' } as Job)
        .mockResolvedValueOnce({ id: 'job-2' } as Job);

      // ACT
      const result = await service.processCompanyBillingPeriodPairs(pairs, config, db);

      // ASSERT
      expect(result).toEqual({
        jobsCreated: 2,
        jobsFailed: 0,
      });
    });

    it('should continue processing on individual failures', async () => {
      // ARRANGE
      const company1 = await createTestCompany();
      const company2 = await createTestCompany();
      const company3 = await createTestCompany();
      const billingPeriod1 = await createTestBillingPeriod({
        companyId: company1.id,
      });
      const billingPeriod2 = await createTestBillingPeriod({
        companyId: company2.id,
      });
      const billingPeriod3 = await createTestBillingPeriod({
        companyId: company3.id,
      });

      const pairs: CompanyBillingPeriodPair[] = [
        {
          companyId: company1.id,
          billingPeriodId: billingPeriod1.id,
          billingPeriodStart: billingPeriod1.startDate,
          billingPeriodEnd: billingPeriod1.endDate,
        },
        {
          companyId: company2.id,
          billingPeriodId: billingPeriod2.id,
          billingPeriodStart: billingPeriod2.startDate,
          billingPeriodEnd: billingPeriod2.endDate,
        },
        {
          companyId: company3.id,
          billingPeriodId: billingPeriod3.id,
          billingPeriodStart: billingPeriod3.startDate,
          billingPeriodEnd: billingPeriod3.endDate,
        },
      ];

      // Success, Fail, Success
      vi.mocked(createJobService)
        .mockResolvedValueOnce({ id: 'job-1' } as Job)
        .mockRejectedValueOnce(new Error('DB error'))
        .mockRejectedValueOnce(new Error('DB error'))
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce({ id: 'job-3' } as Job);

      // ACT
      const result = await service.processCompanyBillingPeriodPairs(pairs, config, db);

      // ASSERT
      expect(result).toEqual({
        jobsCreated: 2,
        jobsFailed: 1,
      });
    });

    it('should get LEGACY service type ID once for all jobs', async () => {
      // ARRANGE
      const company1 = await createTestCompany();
      const company2 = await createTestCompany();
      const billingPeriod1 = await createTestBillingPeriod({
        companyId: company1.id,
      });
      const billingPeriod2 = await createTestBillingPeriod({
        companyId: company2.id,
      });

      const pairs: CompanyBillingPeriodPair[] = [
        {
          companyId: company1.id,
          billingPeriodId: billingPeriod1.id,
          billingPeriodStart: billingPeriod1.startDate,
          billingPeriodEnd: billingPeriod1.endDate,
        },
        {
          companyId: company2.id,
          billingPeriodId: billingPeriod2.id,
          billingPeriodStart: billingPeriod2.startDate,
          billingPeriodEnd: billingPeriod2.endDate,
        },
      ];

      vi.mocked(createJobService)
        .mockResolvedValueOnce({ id: 'job-1' } as Job)
        .mockResolvedValueOnce({ id: 'job-2' } as Job);

      // ACT
      const serviceTypeIdBefore = await service.getLegacyServiceTypeId(db);
      await service.processCompanyBillingPeriodPairs(pairs, config, db);

      // ASSERT
      // Service type should be looked up and cached, not queried for each job
      expect(createJobService).toHaveBeenCalledTimes(2);
      expect(createJobService).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceTypeId: serviceTypeIdBefore,
        }),
        db
      );
    });
  });

  describe('executeJobGeneration', () => {
    it('should execute full job generation flow and return statistics', async () => {
      // ARRANGE
      const company1 = await createTestCompany();
      const company2 = await createTestCompany();
      const billingPeriod1 = await createTestBillingPeriod({
        companyId: company1.id,
      });
      const billingPeriod2 = await createTestBillingPeriod({
        companyId: company2.id,
      });

      const pairs: CompanyBillingPeriodPair[] = [
        {
          companyId: company1.id,
          billingPeriodId: billingPeriod1.id,
          billingPeriodStart: billingPeriod1.startDate,
          billingPeriodEnd: billingPeriod1.endDate,
        },
        {
          companyId: company2.id,
          billingPeriodId: billingPeriod2.id,
          billingPeriodStart: billingPeriod2.startDate,
          billingPeriodEnd: billingPeriod2.endDate,
        },
      ];

      vi.mocked(findEligibleCompaniesWithLatestPeriod)
        .mockResolvedValueOnce(pairs)
        .mockResolvedValueOnce([]);

      vi.mocked(createJobService)
        .mockResolvedValueOnce({ id: 'job-1' } as Job)
        .mockResolvedValueOnce({ id: 'job-2' } as Job);

      // ACT
      const statistics = await service.executeJobGeneration(config, db);

      // ASSERT
      expect(statistics).toMatchObject({
        companiesProcessed: 2,
        periodsDiscovered: 2,
        jobsCreated: 2,
        jobsFailed: 0,
      });
      expect(statistics.executionDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should process in batches until no more results', async () => {
      // ARRANGE
      const company1 = await createTestCompany();
      const company2 = await createTestCompany();
      const billingPeriod1 = await createTestBillingPeriod({
        companyId: company1.id,
      });
      const billingPeriod2 = await createTestBillingPeriod({
        companyId: company2.id,
      });

      const batch1: CompanyBillingPeriodPair[] = [
        {
          companyId: company1.id,
          billingPeriodId: billingPeriod1.id,
          billingPeriodStart: billingPeriod1.startDate,
          billingPeriodEnd: billingPeriod1.endDate,
        },
      ];

      const batch2: CompanyBillingPeriodPair[] = [
        {
          companyId: company2.id,
          billingPeriodId: billingPeriod2.id,
          billingPeriodStart: billingPeriod2.startDate,
          billingPeriodEnd: billingPeriod2.endDate,
        },
      ];

      // Return batch1, then batch2, then empty array
      vi.mocked(findEligibleCompaniesWithLatestPeriod)
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2)
        .mockResolvedValueOnce([]);

      vi.mocked(createJobService)
        .mockResolvedValueOnce({ id: 'job-1' } as unknown as Job)
        .mockResolvedValueOnce({ id: 'job-2' } as unknown as Job);

      // ACT
      const statistics = await service.executeJobGeneration(config, db);

      // ASSERT
      expect(statistics.companiesProcessed).toBe(2);
      expect(statistics.jobsCreated).toBe(2);
      expect(findEligibleCompaniesWithLatestPeriod).toHaveBeenCalledTimes(3);
    });

    it('should handle execution errors and report to Sentry', async () => {
      // ARRANGE
      const error = new Error('Database connection failed');
      vi.mocked(findEligibleCompaniesWithLatestPeriod).mockRejectedValue(error);

      // ACT & ASSERT
      await expect(service.executeJobGeneration(config, db)).rejects.toThrow(
        'Database connection failed'
      );

      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          tags: expect.objectContaining({
            component: 'automatic-job-generation',
            executionId: config.executionId,
          }),
        })
      );
    });

    it('should calculate execution statistics correctly', async () => {
      // ARRANGE
      vi.mocked(findEligibleCompaniesWithLatestPeriod)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // ACT
      const statistics = await service.executeJobGeneration(config, db);

      // ASSERT
      expect(statistics).toMatchObject({
        companiesProcessed: 0,
        periodsDiscovered: 0,
        jobsCreated: 0,
        jobsFailed: 0,
      });
      expect(statistics.executionDurationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
