import { sql } from 'drizzle-orm';
import { type Company, companies, type Database, db } from '../../../db/index.js';

/**
 * Get a company by billing inbound token (case-insensitive)
 */
export async function getCompanyByBillingInboundToken(
  token: string,
  database: Database = db
): Promise<Company | null> {
  const [company] = await database
    .select()
    .from(companies)
    .where(sql`lower(${companies.billingInboundToken}) = lower(${token})`);
  return company || null;
}
