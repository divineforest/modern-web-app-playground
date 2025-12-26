import type {
  Database,
  GlobalContactDocument,
  NewGlobalContactDocument,
} from '../../src/db/index.js';
import { db, globalContactsDocuments } from '../../src/db/index.js';

/**
 * Create a test global contact document link record in the database
 * Requires valid globalContactId and documentId to be provided
 */
export async function createTestGlobalContactDocument(
  overrides: {
    globalContactId: string;
    documentId: string;
  },
  database: Database = db
): Promise<GlobalContactDocument> {
  const linkData: NewGlobalContactDocument = {
    globalContactId: overrides.globalContactId,
    documentId: overrides.documentId,
  };

  const results = await database.insert(globalContactsDocuments).values(linkData).returning();

  if (!results[0]) {
    throw new Error('Failed to create test global contact document link');
  }

  return results[0];
}
