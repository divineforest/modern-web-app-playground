import { eq } from 'drizzle-orm';
import { db } from '../../../src/db/connection.js';
import { companies } from '../../../src/db/schema.js';

/**
 * Create a test company in the database for smoke testing
 */
export async function createTestCompany(billingToken: string): Promise<string> {
  console.log(`[SMOKE] Creating test company with billing token: ${billingToken}`);

  const [company] = await db
    .insert(companies)
    .values({
      name: 'Smoke Test Company',
      status: 'active',
      billingInboundToken: billingToken,
      billingSettings: {},
      companyDetails: {},
    })
    .returning({ id: companies.id });

  if (!company) {
    throw new Error('Failed to create test company');
  }

  console.log(`[SMOKE] ✓ Created test company: ${company.id}`);
  return company.id;
}

/**
 * Clean up test company from database
 */
export async function deleteTestCompany(companyId: string): Promise<void> {
  console.log(`[SMOKE] Deleting test company: ${companyId}`);

  await db.delete(companies).where(eq(companies.id, companyId));

  console.log(`[SMOKE] ✓ Deleted test company: ${companyId}`);
}
