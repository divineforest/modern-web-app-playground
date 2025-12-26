import type { Database } from '../../src/db/connection.js';
import { billingPeriods, db } from '../../src/db/index.js';
import type { BillingPeriod, NewBillingPeriod } from '../../src/db/schema.js';

/**
 * Build test billing period data with default values that can be overridden
 * Use this when you only need the data structure, not a database record
 */
function buildTestBillingPeriodData(
  overrides: Partial<Omit<NewBillingPeriod, 'companyId'>> & { companyId: string }
): NewBillingPeriod {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth(), 31);

  return {
    startDate: overrides['startDate'] || startDate,
    endDate: overrides['endDate'] || endDate,
    isApproved: overrides['isApproved'] || 'TRUE',
    ...overrides,
  };
}

/**
 * Create a test billing period record in the database with default values that can be overridden
 */
export async function createTestBillingPeriod(
  overrides: Partial<Omit<NewBillingPeriod, 'companyId'>> & { companyId: string },
  database: Database = db
): Promise<BillingPeriod> {
  const billingPeriodData = buildTestBillingPeriodData(overrides);
  const [billingPeriod] = await database
    .insert(billingPeriods)
    .values(billingPeriodData)
    .returning();

  if (!billingPeriod) {
    throw new Error('Failed to create test billing period');
  }

  return billingPeriod;
}
