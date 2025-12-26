import { inArray, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestBillingPeriod } from '../../../../tests/factories/billing-periods.js';
import { createTestCompany } from '../../../../tests/factories/companies.js';
import { createTestJob } from '../../../../tests/factories/jobs.js';
import { getFirstServiceType } from '../../../../tests/factories/service-types.js';
import { db } from '../../../db/index.js';
import { billingPeriods, companies } from '../../../db/schema-core.js';
import { jobs } from '../../../db/schema-local.js';
import { AutomaticJobGenerationService } from './automatic-job-generation.service.js';

/**
 * Integration tests for automatic job generation
 * These tests verify database constraints and data integrity
 */
describe('AutomaticJobGenerationService - Integration Tests', () => {
  describe('Database constraint validation', () => {
    it('should enforce unique billing_period_id constraint', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const serviceType = await getFirstServiceType(db);
      const billingPeriod = await createTestBillingPeriod({
        companyId: company.id,
        isApproved: 'TRUE',
      });

      // Create first job
      await createTestJob({
        companyId: company.id,
        serviceTypeId: serviceType.id,
        billingPeriodId: billingPeriod.id,
      });

      // ACT & ASSERT
      // Attempt to create duplicate should fail
      await expect(
        db.insert(jobs).values({
          companyId: company.id,
          serviceTypeId: serviceType.id,
          title: 'Duplicate Job',
          status: 'planned',
          billingPeriodId: billingPeriod.id,
        })
      ).rejects.toThrow();
    });

    it('should allow multiple jobs with null billing_period_id', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const serviceType = await getFirstServiceType(db);

      // ACT
      const job1 = await createTestJob({
        companyId: company.id,
        serviceTypeId: serviceType.id,
        billingPeriodId: null,
      });

      const job2 = await createTestJob({
        companyId: company.id,
        serviceTypeId: serviceType.id,
        billingPeriodId: null,
      });

      // ASSERT
      expect(job1).toBeDefined();
      expect(job2).toBeDefined();
      expect(job1.id).not.toBe(job2.id);
      expect(job1.billingPeriodId).toBeNull();
      expect(job2.billingPeriodId).toBeNull();
    });

    it('should enforce foreign key constraint for billing_period_id', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const serviceType = await getFirstServiceType(db);
      const nonExistentBillingPeriodId = '00000000-0000-0000-0000-999999999999';

      // ACT & ASSERT
      await expect(
        db.insert(jobs).values({
          companyId: company.id,
          serviceTypeId: serviceType.id,
          title: 'Invalid Billing Period Job',
          status: 'planned',
          billingPeriodId: nonExistentBillingPeriodId,
        })
      ).rejects.toThrow();
    });

    it('should correctly link job to billing period', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const serviceType = await getFirstServiceType(db);
      const billingPeriod = await createTestBillingPeriod({
        companyId: company.id,
        startDate: new Date('2024-03-01'),
        endDate: new Date('2024-03-31'),
        isApproved: 'TRUE',
      });

      // ACT
      const job = await createTestJob({
        companyId: company.id,
        serviceTypeId: serviceType.id,
        billingPeriodId: billingPeriod.id,
        periodStart: '2024-03-01',
        periodEnd: '2024-03-31',
      });

      // ASSERT
      expect(job).toBeDefined();
      expect(job.companyId).toBe(company.id);
      expect(job.billingPeriodId).toBe(billingPeriod.id);
      expect(job.periodStart).toBe('2024-03-01');
      expect(job.periodEnd).toBe('2024-03-31');
    });

    it('should verify job can be queried by billing_period_id', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const serviceType = await getFirstServiceType(db);
      const billingPeriod = await createTestBillingPeriod({
        companyId: company.id,
        isApproved: 'TRUE',
      });

      const createdJob = await createTestJob({
        companyId: company.id,
        serviceTypeId: serviceType.id,
        billingPeriodId: billingPeriod.id,
      });

      // ACT
      const [queriedJob] = await db
        .select()
        .from(jobs)
        .where(sql`${jobs.billingPeriodId} = ${billingPeriod.id}`);

      // ASSERT
      expect(queriedJob).toBeDefined();
      expect(queriedJob?.id).toBe(createdJob.id);
      expect(queriedJob?.billingPeriodId).toBe(billingPeriod.id);
    });

    it('should verify unique index prevents duplicate billing_period_id', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const serviceType = await getFirstServiceType(db);
      const billingPeriod = await createTestBillingPeriod({
        companyId: company.id,
        isApproved: 'TRUE',
      });

      // Create first job successfully
      const firstJob = await createTestJob({
        companyId: company.id,
        serviceTypeId: serviceType.id,
        billingPeriodId: billingPeriod.id,
      });

      expect(firstJob).toBeDefined();
      expect(firstJob.billingPeriodId).toBe(billingPeriod.id);

      // ACT & ASSERT
      // Second job with same billing_period_id should fail
      await expect(
        db.insert(jobs).values({
          companyId: company.id,
          serviceTypeId: serviceType.id,
          title: 'Duplicate Job',
          status: 'planned',
          billingPeriodId: billingPeriod.id,
        })
      ).rejects.toThrow();
    });
  });
});

describe('Automatic job generation workflow', () => {
  // Track all entity IDs created during test for cleanup
  let createdCompanyIds: string[] = [];
  let createdBillingPeriodIds: string[] = [];
  let createdJobIds: string[] = [];

  beforeEach(() => {
    // Reset tracking arrays before each test
    createdCompanyIds = [];
    createdBillingPeriodIds = [];
    createdJobIds = [];
  });

  afterEach(async () => {
    // Clean up test data in reverse order of dependencies
    // 1. Delete jobs first (depends on companies and billing_periods)
    if (createdJobIds.length > 0) {
      await db.delete(jobs).where(inArray(jobs.id, createdJobIds));
    }

    // 2. Delete billing periods (depends on companies)
    if (createdBillingPeriodIds.length > 0) {
      await db.delete(billingPeriods).where(inArray(billingPeriods.id, createdBillingPeriodIds));
    }

    // 3. Delete companies last
    if (createdCompanyIds.length > 0) {
      await db.delete(companies).where(inArray(companies.id, createdCompanyIds));
    }
  });

  it('should create only 1 job per company for the latest approved billing period when multiple periods exist', async () => {
    // ARRANGE - Create multiple companies with eligibility settings
    const company1 = await createTestCompany({
      name: 'Company One',
      status: 'in_service',
      billingSettings: { isBillingEnabled: true },
      billingAddress: '123 Main St, City, Country',
    });
    createdCompanyIds.push(company1.id);

    const company2 = await createTestCompany({
      name: 'Company Two',
      status: 'in_service',
      billingSettings: { isBillingEnabled: true },
      billingAddress: '456 Oak Ave, Town, Country',
    });
    createdCompanyIds.push(company2.id);

    const company3 = await createTestCompany({
      name: 'Company Three',
      status: 'in_service',
      billingSettings: { isBillingEnabled: true },
      billingAddress: '789 Pine Rd, Village, Country',
    });
    createdCompanyIds.push(company3.id);

    // Create multiple approved billing periods for Company 1
    const company1Period1 = await createTestBillingPeriod({
      companyId: company1.id,
      startDate: new Date('2024-01-01T00:00:00.000Z'),
      endDate: new Date('2024-01-31T00:00:00.000Z'),
      isApproved: 'TRUE',
    });
    createdBillingPeriodIds.push(company1Period1.id);

    const company1Period2 = await createTestBillingPeriod({
      companyId: company1.id,
      startDate: new Date('2024-02-01T00:00:00.000Z'),
      endDate: new Date('2024-02-29T00:00:00.000Z'),
      isApproved: 'TRUE',
    });
    createdBillingPeriodIds.push(company1Period2.id);

    const company1Period3 = await createTestBillingPeriod({
      companyId: company1.id,
      startDate: new Date('2024-03-01T00:00:00.000Z'),
      endDate: new Date('2024-03-31T00:00:00.000Z'),
      isApproved: 'TRUE',
    });
    createdBillingPeriodIds.push(company1Period3.id);

    // Latest period for company 1
    const company1LatestPeriod = await createTestBillingPeriod({
      companyId: company1.id,
      startDate: new Date('2024-04-01T00:00:00.000Z'),
      endDate: new Date('2024-04-30T00:00:00.000Z'),
      isApproved: 'TRUE',
    });
    createdBillingPeriodIds.push(company1LatestPeriod.id);

    // Create multiple approved billing periods for Company 2
    const company2Period1 = await createTestBillingPeriod({
      companyId: company2.id,
      startDate: new Date('2024-01-01T00:00:00.000Z'),
      endDate: new Date('2024-01-31T00:00:00.000Z'),
      isApproved: 'TRUE',
    });
    createdBillingPeriodIds.push(company2Period1.id);

    const company2Period2 = await createTestBillingPeriod({
      companyId: company2.id,
      startDate: new Date('2024-02-01T00:00:00.000Z'),
      endDate: new Date('2024-02-29T00:00:00.000Z'),
      isApproved: 'TRUE',
    });
    createdBillingPeriodIds.push(company2Period2.id);

    // Latest period for company 2
    const company2LatestPeriod = await createTestBillingPeriod({
      companyId: company2.id,
      startDate: new Date('2024-03-01T00:00:00.000Z'),
      endDate: new Date('2024-03-31T00:00:00.000Z'),
      isApproved: 'TRUE',
    });
    createdBillingPeriodIds.push(company2LatestPeriod.id);

    // Create multiple approved billing periods for Company 3
    const company3Period1 = await createTestBillingPeriod({
      companyId: company3.id,
      startDate: new Date('2024-02-01T00:00:00.000Z'),
      endDate: new Date('2024-02-29T00:00:00.000Z'),
      isApproved: 'TRUE',
    });
    createdBillingPeriodIds.push(company3Period1.id);

    // Latest period for company 3
    const company3LatestPeriod = await createTestBillingPeriod({
      companyId: company3.id,
      startDate: new Date('2024-03-01T00:00:00.000Z'),
      endDate: new Date('2024-03-31T00:00:00.000Z'),
      isApproved: 'TRUE',
    });
    createdBillingPeriodIds.push(company3LatestPeriod.id);

    // ACT - Run the automatic job generation service
    const service = new AutomaticJobGenerationService();
    const executionId = `test-exec-${Date.now()}`;
    const statistics = await service.executeJobGeneration({ executionId }, db);

    // Track created jobs for cleanup - query by company IDs we created
    const newJobs = await db.select().from(jobs).where(inArray(jobs.companyId, createdCompanyIds));
    for (const job of newJobs) {
      createdJobIds.push(job.id);
    }

    // ASSERT - Verify statistics (only for our test companies)
    // The service may process other eligible companies in the database,
    // so we check that AT LEAST our 3 companies were processed
    expect(statistics.companiesProcessed).toBeGreaterThanOrEqual(3);
    expect(statistics.periodsDiscovered).toBeGreaterThanOrEqual(3);
    expect(statistics.jobsCreated).toBeGreaterThanOrEqual(3);
    expect(statistics.jobsFailed).toBe(0);

    // Verify each test company has exactly 1 job linked to the LATEST billing period
    // Filter jobs by our specific company IDs to isolate from other test data
    const company1Jobs = newJobs.filter((job) => job.companyId === company1.id);
    expect(company1Jobs).toHaveLength(1);
    expect(company1Jobs[0]?.billingPeriodId).toBe(company1LatestPeriod.id);
    expect(company1Jobs[0]?.periodStart).toBe('2024-04-01');
    expect(company1Jobs[0]?.periodEnd).toBe('2024-04-30');
    expect(company1Jobs[0]?.title).toContain('April 2024');

    const company2Jobs = newJobs.filter((job) => job.companyId === company2.id);
    expect(company2Jobs).toHaveLength(1);
    expect(company2Jobs[0]?.billingPeriodId).toBe(company2LatestPeriod.id);
    expect(company2Jobs[0]?.periodStart).toBe('2024-03-01');
    expect(company2Jobs[0]?.periodEnd).toBe('2024-03-31');
    expect(company2Jobs[0]?.title).toContain('March 2024');

    const company3Jobs = newJobs.filter((job) => job.companyId === company3.id);
    expect(company3Jobs).toHaveLength(1);
    expect(company3Jobs[0]?.billingPeriodId).toBe(company3LatestPeriod.id);
    expect(company3Jobs[0]?.periodStart).toBe('2024-03-01');
    expect(company3Jobs[0]?.periodEnd).toBe('2024-03-31');
    expect(company3Jobs[0]?.title).toContain('March 2024');

    // Verify that older periods did NOT get jobs created (using newJobs which is filtered by our companies)
    const olderPeriodIds = [
      company1Period1.id,
      company1Period2.id,
      company1Period3.id,
      company2Period1.id,
      company2Period2.id,
      company3Period1.id,
    ];

    const jobsForOlderPeriods = newJobs.filter((job) =>
      olderPeriodIds.includes(job.billingPeriodId ?? '')
    );
    expect(jobsForOlderPeriods).toHaveLength(0);
  });
});
