/**
 * Repository for global_contacts_companies join table operations
 */
import { and, eq } from 'drizzle-orm';
import type { Database, GlobalContactCompany, NewGlobalContactCompany } from '../../../db/index.js';
import { bobContacts, db, globalContactsCompanies } from '../../../db/index.js';
import type { ContactCompanyRole } from '../domain/global-contact-company.types.js';

/**
 * Create or update a contact-company relationship (upsert)
 * If the relationship already exists:
 * - Updates bobId only if the new value is not null, not undefined, and not empty string
 * - Always updates updatedAt to current timestamp
 * Always returns the resulting relationship row
 */
export async function createContactCompanyRelationship(
  data: NewGlobalContactCompany,
  database: Database = db
): Promise<GlobalContactCompany> {
  // Build the set clause for upsert - only update bobId if new value is meaningful
  const setClause: { bobId?: string | null; updatedAt: Date } = {
    updatedAt: new Date(),
  };

  // Only update bobId if the new value is not null, not undefined, and not empty string
  if (data.bobId !== null && data.bobId !== undefined && data.bobId !== '') {
    setClause.bobId = data.bobId;
  }

  const results = await database
    .insert(globalContactsCompanies)
    .values(data)
    .onConflictDoUpdate({
      target: [
        globalContactsCompanies.globalContactId,
        globalContactsCompanies.companyId,
        globalContactsCompanies.role,
      ],
      set: setClause,
    })
    .returning();

  // This should never happen as upsert always returns a row
  if (!results[0]) {
    throw new Error('Failed to create or update contact-company relationship');
  }

  return results[0];
}

/**
 * Find a specific relationship by contact, company, and role
 */
export async function findContactCompanyRelationship(
  globalContactId: string,
  companyId: string,
  role: ContactCompanyRole,
  database: Database = db
): Promise<GlobalContactCompany | null> {
  const results = await database
    .select()
    .from(globalContactsCompanies)
    .where(
      and(
        eq(globalContactsCompanies.globalContactId, globalContactId),
        eq(globalContactsCompanies.companyId, companyId),
        eq(globalContactsCompanies.role, role)
      )
    )
    .limit(1);

  return results[0] || null;
}

/**
 * Find all relationships for a contact
 */
export async function findRelationshipsByContactId(
  globalContactId: string,
  database: Database = db
): Promise<GlobalContactCompany[]> {
  return database
    .select()
    .from(globalContactsCompanies)
    .where(eq(globalContactsCompanies.globalContactId, globalContactId));
}

/**
 * Find all relationships for a company
 */
export async function findRelationshipsByCompanyId(
  companyId: string,
  database: Database = db
): Promise<GlobalContactCompany[]> {
  return database
    .select()
    .from(globalContactsCompanies)
    .where(eq(globalContactsCompanies.companyId, companyId));
}

/**
 * Delete a relationship by ID
 */
export async function deleteRelationshipById(
  id: string,
  database: Database = db
): Promise<boolean> {
  const result = await database
    .delete(globalContactsCompanies)
    .where(eq(globalContactsCompanies.id, id))
    .returning({ id: globalContactsCompanies.id });

  return result.length > 0;
}

/**
 * Delete a specific relationship by contact, company, and role
 */
export async function deleteRelationship(
  globalContactId: string,
  companyId: string,
  role: ContactCompanyRole,
  database: Database = db
): Promise<boolean> {
  const result = await database
    .delete(globalContactsCompanies)
    .where(
      and(
        eq(globalContactsCompanies.globalContactId, globalContactId),
        eq(globalContactsCompanies.companyId, companyId),
        eq(globalContactsCompanies.role, role)
      )
    )
    .returning({ id: globalContactsCompanies.id });

  return result.length > 0;
}

/**
 * Find bob_id from bob_contacts table by company_id and vat_id
 * Used to populate bob_id when creating a contact-company relationship
 *
 * @param companyId - The company ID to match
 * @param vatId - The VAT ID to match (normalized)
 * @param database - Database connection
 * @returns The bob_id if a matching record is found, null otherwise
 */
export async function findBobIdByCompanyAndVatId(
  companyId: string,
  vatId: string,
  database: Database = db
): Promise<string | null> {
  const results = await database
    .select({ bobId: bobContacts.bobId })
    .from(bobContacts)
    .where(and(eq(bobContacts.companyId, companyId), eq(bobContacts.vatId, vatId)))
    .limit(1);

  return results[0]?.bobId ?? null;
}
