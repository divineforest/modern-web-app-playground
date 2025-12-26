import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createTestBillingPeriod } from '../../../../tests/factories/billing-periods.js';
import { createTestCompany } from '../../../../tests/factories/companies.js';
import { createTestJob } from '../../../../tests/factories/jobs.js';
import { getFirstServiceType } from '../../../../tests/factories/service-types.js';
import { db } from '../../../db/index.js';
import { findEligibleCompaniesWithLatestPeriod } from './company-billing-periods.repository.js';

describe('CompanyBillingPeriodsRepository', () => {
  describe('findEligibleCompaniesWithLatestPeriod', () => {
    it('should find eligible companies with approved billing periods', async () => {
      // ARRANGE
      const company = await createTestCompany();
      await db.execute(
        sql`UPDATE companies SET status = 'in_service', billing_settings = '{"isBillingEnabled": true}', billing_address = '123 Main St' WHERE id = ${company.id}`
      );
      const billingPeriod = await createTestBillingPeriod({
        companyId: company.id,
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-01-31'),
        isApproved: 'TRUE',
      });

      // ACT
      const result = await findEligibleCompaniesWithLatestPeriod({}, db);

      // ASSERT
      expect(result.length).toBeGreaterThanOrEqual(1);
      const found = result.find((r) => r.companyId === company.id);
      expect(found).toBeDefined();
      expect(found?.billingPeriodId).toBe(billingPeriod.id);
    });

    it('should exclude companies without in_service status', async () => {
      // ARRANGE
      const company = await createTestCompany();
      await db.execute(
        sql`UPDATE companies SET status = 'churned', billing_settings = '{"isBillingEnabled": true}', billing_address = '123 Main St' WHERE id = ${company.id}`
      );
      await createTestBillingPeriod({
        companyId: company.id,
        isApproved: 'TRUE',
      });

      // ACT
      const result = await findEligibleCompaniesWithLatestPeriod({}, db);

      // ASSERT
      const found = result.find((r) => r.companyId === company.id);
      expect(found).toBeUndefined();
    });

    it('should exclude companies without billing enabled', async () => {
      // ARRANGE
      const company = await createTestCompany();
      await db.execute(
        sql`UPDATE companies SET status = 'in_service', billing_settings = '{"isBillingEnabled": false}', billing_address = '123 Main St' WHERE id = ${company.id}`
      );
      await createTestBillingPeriod({
        companyId: company.id,
        isApproved: 'TRUE',
      });

      // ACT
      const result = await findEligibleCompaniesWithLatestPeriod({}, db);

      // ASSERT
      const found = result.find((r) => r.companyId === company.id);
      expect(found).toBeUndefined();
    });

    it('should exclude companies without billing address', async () => {
      // ARRANGE
      const company = await createTestCompany();
      await db.execute(
        sql`UPDATE companies SET status = 'in_service', billing_settings = '{"isBillingEnabled": true}', billing_address = NULL WHERE id = ${company.id}`
      );
      await createTestBillingPeriod({
        companyId: company.id,
        isApproved: 'TRUE',
      });

      // ACT
      const result = await findEligibleCompaniesWithLatestPeriod({}, db);

      // ASSERT
      const found = result.find((r) => r.companyId === company.id);
      expect(found).toBeUndefined();
    });

    it('should exclude billing periods that are not approved', async () => {
      // ARRANGE
      const company = await createTestCompany();
      await db.execute(
        sql`UPDATE companies SET status = 'in_service', billing_settings = '{"isBillingEnabled": true}', billing_address = '123 Main St' WHERE id = ${company.id}`
      );
      await createTestBillingPeriod({
        companyId: company.id,
        isApproved: 'FALSE',
      });

      // ACT
      const result = await findEligibleCompaniesWithLatestPeriod({}, db);

      // ASSERT
      const found = result.find((r) => r.companyId === company.id);
      expect(found).toBeUndefined();
    });

    it('should exclude billing periods that already have jobs', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const serviceType = await getFirstServiceType(db);
      await db.execute(
        sql`UPDATE companies SET status = 'in_service', billing_settings = '{"isBillingEnabled": true}', billing_address = '123 Main St' WHERE id = ${company.id}`
      );
      const billingPeriod = await createTestBillingPeriod({
        companyId: company.id,
        isApproved: 'TRUE',
      });

      // Create job for this billing period
      await createTestJob(
        {
          companyId: company.id,
          serviceTypeId: serviceType.id,
          billingPeriodId: billingPeriod.id,
        },
        db
      );

      // ACT
      const result = await findEligibleCompaniesWithLatestPeriod({}, db);

      // ASSERT
      const found = result.find((r) => r.billingPeriodId === billingPeriod.id);
      expect(found).toBeUndefined();
    });

    it('should return only the latest billing period per company', async () => {
      // ARRANGE
      const company = await createTestCompany();
      await db.execute(
        sql`UPDATE companies SET status = 'in_service', billing_settings = '{"isBillingEnabled": true}', billing_address = '123 Main St' WHERE id = ${company.id}`
      );

      const oldPeriod = await createTestBillingPeriod({
        companyId: company.id,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        isApproved: 'TRUE',
      });

      const latestPeriod = await createTestBillingPeriod({
        companyId: company.id,
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-02-29'),
        isApproved: 'TRUE',
      });

      // ACT
      const result = await findEligibleCompaniesWithLatestPeriod({}, db);

      // ASSERT
      const found = result.filter((r) => r.companyId === company.id);
      expect(found).toHaveLength(1);
      expect(found[0]?.billingPeriodId).toBe(latestPeriod.id);
      expect(found[0]?.billingPeriodId).not.toBe(oldPeriod.id);
    });

    it('should support batch processing with limit', async () => {
      // ARRANGE
      const company1 = await createTestCompany();
      const company2 = await createTestCompany();
      const company3 = await createTestCompany();

      await db.execute(
        sql`UPDATE companies SET status = 'in_service', billing_settings = '{"isBillingEnabled": true}', billing_address = '123 Main St' WHERE id IN (${company1.id}, ${company2.id}, ${company3.id})`
      );

      await createTestBillingPeriod({ companyId: company1.id, isApproved: 'TRUE' });
      await createTestBillingPeriod({ companyId: company2.id, isApproved: 'TRUE' });
      await createTestBillingPeriod({ companyId: company3.id, isApproved: 'TRUE' });

      // ACT
      const result = await findEligibleCompaniesWithLatestPeriod({ limit: 2 }, db);

      // ASSERT
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('should return empty array when no eligible companies found', async () => {
      // ARRANGE
      // Create companies that don't meet criteria
      const company = await createTestCompany();
      await db.execute(sql`UPDATE companies SET status = 'churned' WHERE id = ${company.id}`);

      // ACT
      const result = await findEligibleCompaniesWithLatestPeriod({}, db);

      // ASSERT
      // May have other test data, but our specific company shouldn't be there
      const found = result.find((r) => r.companyId === company.id);
      expect(found).toBeUndefined();
    });

    it('should return correct data structure for company-period pairs', async () => {
      // ARRANGE
      const company = await createTestCompany();
      await db.execute(
        sql`UPDATE companies SET status = 'in_service', billing_settings = '{"isBillingEnabled": true}', billing_address = '123 Main St' WHERE id = ${company.id}`
      );
      const billingPeriod = await createTestBillingPeriod({
        companyId: company.id,
        startDate: new Date('2023-02-01'),
        endDate: new Date('2023-02-28'),
        isApproved: 'TRUE',
      });

      // ACT
      const result = await findEligibleCompaniesWithLatestPeriod({}, db);

      // ASSERT
      const found = result.find((r) => r.companyId === company.id);
      expect(found).toBeDefined();
      expect(found).toMatchObject({
        companyId: company.id,
        billingPeriodId: billingPeriod.id,
      });
      // The repository should return valid Date objects that represent the billing periods
      // Due to database timezone handling, we verify that the dates are reasonable and consistent
      expect(found?.billingPeriodStart).toBeInstanceOf(Date);
      expect(found?.billingPeriodEnd).toBeInstanceOf(Date);

      expect(found?.billingPeriodStart.getTime()).toBeLessThan(
        found?.billingPeriodEnd.getTime() as number
      );

      // Verify the dates are in the expected year (2023) and month range
      expect(found?.billingPeriodStart.getFullYear()).toBe(2023);
      expect(found?.billingPeriodEnd.getFullYear()).toBe(2023);
      expect(found?.billingPeriodStart.getMonth()).toBe(1); // February (0-indexed)
      expect(found?.billingPeriodEnd.getMonth()).toBe(1); // February (0-indexed)
    });

    it('should handle companies with multiple approved periods correctly', async () => {
      // ARRANGE
      const company = await createTestCompany();
      await db.execute(
        sql`UPDATE companies SET status = 'in_service', billing_settings = '{"isBillingEnabled": true}', billing_address = '123 Main St' WHERE id = ${company.id}`
      );

      // Create multiple approved periods with different end dates
      const period1 = await createTestBillingPeriod({
        companyId: company.id,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        isApproved: 'TRUE',
      });

      const period2 = await createTestBillingPeriod({
        companyId: company.id,
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-02-29'),
        isApproved: 'TRUE',
      });

      const latestPeriod = await createTestBillingPeriod({
        companyId: company.id,
        startDate: new Date('2024-03-01'),
        endDate: new Date('2024-03-31'),
        isApproved: 'TRUE',
      });

      // ACT
      const result = await findEligibleCompaniesWithLatestPeriod({}, db);

      // ASSERT
      const found = result.filter((r) => r.companyId === company.id);
      expect(found).toHaveLength(1);
      expect(found[0]?.billingPeriodId).toBe(latestPeriod.id);
      expect(found[0]?.billingPeriodId).not.toBe(period1.id);
      expect(found[0]?.billingPeriodId).not.toBe(period2.id);
    });

    it('should handle tie-breaking when periods have same end date', async () => {
      // ARRANGE
      const company = await createTestCompany();
      await db.execute(
        sql`UPDATE companies SET status = 'in_service', billing_settings = '{"isBillingEnabled": true}', billing_address = '123 Main St' WHERE id = ${company.id}`
      );

      // Create two periods with the same end date (edge case)
      await createTestBillingPeriod({
        companyId: company.id,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        isApproved: 'TRUE',
      });

      await createTestBillingPeriod({
        companyId: company.id,
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-31'),
        isApproved: 'TRUE',
      });

      // ACT
      const result = await findEligibleCompaniesWithLatestPeriod({}, db);

      // ASSERT
      const found = result.filter((r) => r.companyId === company.id);
      // Should return exactly one period (implementation picks one deterministically)
      expect(found).toHaveLength(1);
    });
  });
});
