import type {
  Database,
  GlobalContactCompany,
  NewGlobalContactCompany,
} from '../../src/db/index.js';
import { db, globalContactsCompanies } from '../../src/db/index.js';
import type { ContactCompanyRole } from '../../src/modules/contacts/domain/global-contact-company.types.js';

/**
 * Create a test global contact company relationship record in the database
 * Requires valid globalContactId and companyId to be provided
 */
export async function createTestGlobalContactCompany(
  overrides: {
    globalContactId: string;
    companyId: string;
    role?: ContactCompanyRole;
    bobId?: string | null;
  },
  database: Database = db
): Promise<GlobalContactCompany> {
  const relationshipData: NewGlobalContactCompany = {
    globalContactId: overrides.globalContactId,
    companyId: overrides.companyId,
    role: overrides.role ?? 'supplier',
    bobId: overrides.bobId ?? null,
  };

  const results = await database
    .insert(globalContactsCompanies)
    .values(relationshipData)
    .returning();

  if (!results[0]) {
    throw new Error('Failed to create test global contact company relationship');
  }

  return results[0];
}
