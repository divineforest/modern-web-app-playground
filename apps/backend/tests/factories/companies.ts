import { companies, db } from '../../src/db/index.js';
import type { Company, NewCompany } from '../../src/db/schema';

/**
 * Build test company data with default values that can be overridden
 * Use this when you only need the data structure, not a database record
 */
export function buildTestCompanyData(overrides: Partial<NewCompany> = {}): NewCompany {
  return {
    name: 'Test Company',
    billingInboundToken: crypto.randomUUID(),
    bobReferenceId: overrides.bobReferenceId ?? null,
    ...overrides,
  };
}

/**
 * Create a test company record in the database with default values that can be overridden
 */
export async function createTestCompany(overrides: Partial<NewCompany> = {}): Promise<Company> {
  const companyData = buildTestCompanyData(overrides);
  const [company] = await db.insert(companies).values(companyData).returning();

  if (!company) {
    throw new Error('Failed to create test company');
  }

  return company;
}
