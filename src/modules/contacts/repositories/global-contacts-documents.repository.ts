/**
 * Repository for global_contacts_documents join table operations
 */
import { and, eq } from 'drizzle-orm';
import type {
  Database,
  GlobalContactDocument,
  NewGlobalContactDocument,
} from '../../../db/index.js';
import { db, globalContactsDocuments } from '../../../db/index.js';

/**
 * Create or get a contact-document link (upsert with do nothing on conflict)
 * If the link already exists, returns the existing link
 * If the link doesn't exist, creates a new one
 *
 * @param data - The document link data to insert
 * @param database - Database connection
 * @returns The created or existing document link
 */
export async function createContactDocumentLink(
  data: NewGlobalContactDocument,
  database: Database = db
): Promise<GlobalContactDocument> {
  // First try to insert, do nothing on conflict
  await database
    .insert(globalContactsDocuments)
    .values(data)
    .onConflictDoNothing({
      target: [globalContactsDocuments.globalContactId, globalContactsDocuments.documentId],
    });

  // Then fetch the record (either newly created or existing)
  const result = await database
    .select()
    .from(globalContactsDocuments)
    .where(
      and(
        eq(globalContactsDocuments.globalContactId, data.globalContactId),
        eq(globalContactsDocuments.documentId, data.documentId)
      )
    )
    .limit(1);

  if (!result[0]) {
    throw new Error('Failed to create or find contact-document link');
  }

  return result[0];
}

/**
 * Find a specific document link by contact and document
 *
 * @param globalContactId - The contact ID
 * @param documentId - The document ID
 * @param database - Database connection
 * @returns The document link if found, null otherwise
 */
export async function findContactDocumentLink(
  globalContactId: string,
  documentId: string,
  database: Database = db
): Promise<GlobalContactDocument | null> {
  const results = await database
    .select()
    .from(globalContactsDocuments)
    .where(
      and(
        eq(globalContactsDocuments.globalContactId, globalContactId),
        eq(globalContactsDocuments.documentId, documentId)
      )
    )
    .limit(1);

  return results[0] || null;
}

/**
 * Find all document links for a contact
 *
 * @param globalContactId - The contact ID
 * @param database - Database connection
 * @returns Array of document links
 */
export async function findDocumentLinksByContactId(
  globalContactId: string,
  database: Database = db
): Promise<GlobalContactDocument[]> {
  return database
    .select()
    .from(globalContactsDocuments)
    .where(eq(globalContactsDocuments.globalContactId, globalContactId));
}

/**
 * Find all document links for a document
 *
 * @param documentId - The document ID
 * @param database - Database connection
 * @returns Array of document links
 */
export async function findDocumentLinksByDocumentId(
  documentId: string,
  database: Database = db
): Promise<GlobalContactDocument[]> {
  return database
    .select()
    .from(globalContactsDocuments)
    .where(eq(globalContactsDocuments.documentId, documentId));
}

/**
 * Delete a document link by ID
 *
 * @param id - The document link ID
 * @param database - Database connection
 * @returns true if deleted, false if not found
 */
export async function deleteDocumentLinkById(
  id: string,
  database: Database = db
): Promise<boolean> {
  const result = await database
    .delete(globalContactsDocuments)
    .where(eq(globalContactsDocuments.id, id))
    .returning({ id: globalContactsDocuments.id });

  return result.length > 0;
}

/**
 * Delete a specific document link by contact and document
 *
 * @param globalContactId - The contact ID
 * @param documentId - The document ID
 * @param database - Database connection
 * @returns true if deleted, false if not found
 */
export async function deleteDocumentLink(
  globalContactId: string,
  documentId: string,
  database: Database = db
): Promise<boolean> {
  const result = await database
    .delete(globalContactsDocuments)
    .where(
      and(
        eq(globalContactsDocuments.globalContactId, globalContactId),
        eq(globalContactsDocuments.documentId, documentId)
      )
    )
    .returning({ id: globalContactsDocuments.id });

  return result.length > 0;
}
