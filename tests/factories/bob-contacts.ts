import type { BobContact, Database, NewBobContact } from '../../src/db/index.js';
import { bobContacts, db } from '../../src/db/index.js';

/**
 * Create a test bob contact record in the database
 * Used to test bob_id population in global_contacts_companies
 */
export async function createTestBobContact(
  overrides: {
    companyId: string;
    vatId?: string | null;
    bobId?: string | null;
  },
  database: Database = db
): Promise<BobContact> {
  const bobContactData: NewBobContact = {
    companyId: overrides.companyId,
    vatId: overrides.vatId ?? null,
    // Use explicit null if provided, otherwise generate a default
    // Check if 'bobId' key exists in overrides (even if value is null)
    bobId: 'bobId' in overrides ? overrides.bobId : `bob_${Date.now()}`,
  };

  const results = await database.insert(bobContacts).values(bobContactData).returning();

  if (!results[0]) {
    throw new Error('Failed to create test bob contact');
  }

  return results[0];
}
