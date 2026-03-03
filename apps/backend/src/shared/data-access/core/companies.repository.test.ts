import { eq } from 'drizzle-orm';
import { buildTestCompanyData } from '../../../../tests/factories/index.js';
import { db } from '../../../db/index.js';
import { companies } from '../../../db/schema.js';
import { getCompanyByBillingInboundToken } from './companies.repository.js';

it('inserts and reads a company', async () => {
  // ARRANGE
  const testCompanyData = buildTestCompanyData();

  // ACT
  const [insertedCompany] = await db.insert(companies).values(testCompanyData).returning();
  expect(insertedCompany).toBeDefined();

  if (!insertedCompany) return; // TypeScript guard

  expect(insertedCompany.id).toBeDefined();

  const rows = await db.select().from(companies).where(eq(companies.id, insertedCompany.id));

  // ASSERT
  expect(rows[0]?.id).toBe(insertedCompany.id);
  expect(rows[0]?.name).toBe('Test Company');
});

it('case-insensitive billing token lookup works correctly', async () => {
  // ARRANGE
  const testCompanyData = buildTestCompanyData();
  // Set a specific billing token with mixed case (make it unique)
  const mixedCaseToken = `AbC123XyZ-${Date.now()}-${Math.random()}`;
  testCompanyData.billingInboundToken = mixedCaseToken;

  const [insertedCompany] = await db.insert(companies).values(testCompanyData).returning();
  expect(insertedCompany).toBeDefined();

  // Test lookup with exact case match
  const exactMatch = await getCompanyByBillingInboundToken(mixedCaseToken);
  expect(exactMatch).toBeDefined();
  expect(exactMatch?.id).toBe(insertedCompany?.id);

  // Test lookup with lowercase token
  const lowercaseMatch = await getCompanyByBillingInboundToken(mixedCaseToken.toLowerCase());
  expect(lowercaseMatch).toBeDefined();
  expect(lowercaseMatch?.id).toBe(insertedCompany?.id);

  // Test lookup with uppercase token
  const uppercaseMatch = await getCompanyByBillingInboundToken(mixedCaseToken.toUpperCase());
  expect(uppercaseMatch).toBeDefined();
  expect(uppercaseMatch?.id).toBe(insertedCompany?.id);

  // Test lookup with mixed case variations
  const variationMatch = await getCompanyByBillingInboundToken(
    mixedCaseToken.replace('AbC123XyZ', 'abc123xyz')
  );
  expect(variationMatch).toBeDefined();
  expect(variationMatch?.id).toBe(insertedCompany?.id);

  // Test lookup with non-existent token
  const noMatch = await getCompanyByBillingInboundToken('nonexistent');
  expect(noMatch).toBeNull();
});
