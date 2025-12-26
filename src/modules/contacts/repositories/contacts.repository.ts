/**
 * Contacts repository for global_contacts table operations
 */
import { and, asc, desc, eq, gt, lt, or, type SQL, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Database, GlobalContact, NewGlobalContact } from '../../../db/index.js';
import { companies, db, globalContacts, globalContactsCompanies } from '../../../db/index.js';
import { CursorSortMismatchError, InvalidCursorError } from '../domain/contact.errors.js';
import type {
  ContactListFilters,
  ContactPaginationOptions,
  ContactPaginationResult,
  ContactSortField,
  CursorData,
} from '../domain/contact.types.js';

/**
 * Create a new contact in the database
 */
export async function createContact(
  data: NewGlobalContact,
  database: Database = db
): Promise<GlobalContact> {
  const results = await database.insert(globalContacts).values(data).returning();

  if (!results[0]) {
    throw new Error('Failed to create contact');
  }

  return results[0];
}

/**
 * Find a contact by VAT ID
 * Returns null if no contact found or if vatId is null/undefined
 */
export async function findContactByVatId(
  vatId: string | null | undefined,
  database: Database = db
): Promise<GlobalContact | null> {
  if (!vatId) {
    return null;
  }

  const results = await database
    .select()
    .from(globalContacts)
    .where(eq(globalContacts.vatId, vatId))
    .limit(1);

  return results[0] || null;
}

/**
 * Find a contact by ID
 */
export async function findContactById(
  id: string,
  database: Database = db
): Promise<GlobalContact | null> {
  const results = await database
    .select()
    .from(globalContacts)
    .where(eq(globalContacts.id, id))
    .limit(1);

  return results[0] || null;
}

/**
 * Update a contact by ID
 */
export async function updateContact(
  id: string,
  data: Partial<NewGlobalContact>,
  database: Database = db
): Promise<GlobalContact | null> {
  const results = await database
    .update(globalContacts)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(globalContacts.id, id))
    .returning();

  return results[0] || null;
}

/**
 * Encode cursor data to base64 string
 */
export function encodeCursor(data: CursorData): string {
  const jsonStr = JSON.stringify({
    sf: data.sortField,
    sd: data.sortDirection,
    sv: data.sortValue instanceof Date ? data.sortValue.toISOString() : data.sortValue,
    id: data.id,
  });
  return Buffer.from(jsonStr).toString('base64');
}

/**
 * Decode cursor from base64 string
 * Returns null if cursor is invalid or malformed
 */
export function decodeCursor(cursor: string): CursorData | null {
  try {
    const jsonStr = Buffer.from(cursor, 'base64').toString('utf-8');
    const parsed = JSON.parse(jsonStr);

    // Validate required fields
    if (!parsed.sf || !parsed.sd || parsed.sv === undefined || !parsed.id) {
      return null;
    }

    // Validate sort field
    const validSortFields: ContactSortField[] = ['created_at', 'updated_at', 'name'];
    if (!validSortFields.includes(parsed.sf)) {
      return null;
    }

    // Validate sort direction
    if (parsed.sd !== 'asc' && parsed.sd !== 'desc') {
      return null;
    }

    return {
      sortField: parsed.sf,
      sortDirection: parsed.sd,
      sortValue: parsed.sf === 'name' ? parsed.sv : new Date(parsed.sv),
      id: parsed.id,
    };
  } catch {
    return null;
  }
}

/**
 * Get sort value from a contact based on sort field
 */
function getSortValue(contact: GlobalContact, sortField: ContactSortField): string | Date {
  switch (sortField) {
    case 'created_at':
      return contact.createdAt;
    case 'updated_at':
      return contact.updatedAt;
    case 'name':
      return contact.name;
  }
}

/**
 * Get the Drizzle column for a sort field
 */
function getSortColumn(sortField: ContactSortField) {
  switch (sortField) {
    case 'created_at':
      return globalContacts.createdAt;
    case 'updated_at':
      return globalContacts.updatedAt;
    case 'name':
      return globalContacts.name;
  }
}

/**
 * Validate and decode cursor for pagination
 * Uses early-return guard clauses for cleaner flow
 * @param cursor - The cursor string to validate
 * @param sort - The sort options to validate against
 * @returns Decoded cursor data or null if no cursor provided
 * @throws InvalidCursorError if cursor is malformed
 * @throws CursorSortMismatchError if cursor sort doesn't match request sort
 */
function validateCursor(
  cursor: string | undefined,
  sort: { field: ContactSortField; direction: 'asc' | 'desc' }
): CursorData | null {
  if (!cursor) {
    return null;
  }

  const cursorData = decodeCursor(cursor);
  if (!cursorData) {
    throw new InvalidCursorError();
  }

  if (cursorData.sortField !== sort.field || cursorData.sortDirection !== sort.direction) {
    throw new CursorSortMismatchError();
  }

  return cursorData;
}

/**
 * Build SQL condition for cursor-based pagination
 * @param cursorData - The decoded cursor data
 * @param sort - The sort options
 * @returns SQL condition for cursor pagination
 */
function buildCursorCondition(
  cursorData: CursorData,
  sort: { field: ContactSortField; direction: 'asc' | 'desc' }
): SQL | undefined {
  const sortColumn = getSortColumn(sort.field);
  const cursorValue = cursorData.sortValue;

  // For DESC: get items where (sortValue < cursorValue) OR (sortValue = cursorValue AND id < cursorId)
  if (sort.direction === 'desc') {
    return or(
      lt(sortColumn, cursorValue),
      and(eq(sortColumn, cursorValue), lt(globalContacts.id, cursorData.id))
    );
  }

  // For ASC: get items where (sortValue > cursorValue) OR (sortValue = cursorValue AND id > cursorId)
  return or(
    gt(sortColumn, cursorValue),
    and(eq(sortColumn, cursorValue), gt(globalContacts.id, cursorData.id))
  );
}

/**
 * Contact with optional bob_id from global_contacts_companies relationship
 * Used when listing contacts with company filter, where bob_id may be present
 */
export type ContactWithBobId = GlobalContact & {
  /** Bob contact ID from the company relationship, if present */
  bobId?: string | null;
};

/**
 * List result with contacts and pagination
 */
export interface ListContactsResult {
  contacts: ContactWithBobId[];
  pagination: ContactPaginationResult;
}

/**
 * List contacts with filtering and cursor-based pagination
 */

/** Alias for global_contacts_companies table to avoid column name conflicts in joins */
const contactCompaniesAlias = alias(globalContactsCompanies, 'gcc');

/**
 * Build and execute a query for contacts filtered by company relationship.
 * Uses a table alias for global_contacts_companies to prevent column name conflicts.
 *
 * @param database - Database instance
 * @param companyId - Company ID to filter by
 * @param role - Optional role filter (customer/supplier)
 * @param conditions - Additional WHERE conditions
 * @param primarySort - Primary sort expression
 * @param secondarySort - Secondary sort expression (tiebreaker)
 * @param limit - Result limit (null for unlimited)
 * @returns Array of GlobalContact matching the filters
 */
export async function queryContactsWithCompanyFilter(
  database: Database,
  companyId: string,
  role: string | undefined,
  conditions: SQL[],
  primarySort: ReturnType<typeof desc>,
  secondarySort: ReturnType<typeof desc>,
  limit: number | null | undefined
): Promise<ContactWithBobId[]> {
  // Build join conditions using the aliased table
  const joinConditions: SQL[] = [
    eq(contactCompaniesAlias.globalContactId, globalContacts.id),
    eq(contactCompaniesAlias.companyId, companyId),
  ];

  if (role) {
    joinConditions.push(eq(contactCompaniesAlias.role, role));
  }

  // Build query with explicit column selection to avoid conflicts
  // Include bobId from global_contacts_companies for ID substitution in API response
  let query = database
    .select({
      id: globalContacts.id,
      createdAt: globalContacts.createdAt,
      updatedAt: globalContacts.updatedAt,
      name: globalContacts.name,
      email: globalContacts.email,
      entityType: globalContacts.entityType,
      source: globalContacts.source,
      phone: globalContacts.phone,
      vatId: globalContacts.vatId,
      vatType: globalContacts.vatType,
      taxNumber: globalContacts.taxNumber,
      contactPerson: globalContacts.contactPerson,
      countryCode: globalContacts.countryCode,
      billingAddress: globalContacts.billingAddress,
      postalAddress: globalContacts.postalAddress,
      rawExtraction: globalContacts.rawExtraction,
      rawViesResponse: globalContacts.rawViesResponse,
      isValidVatId: globalContacts.isValidVatId,
      vatIdValidatedAt: globalContacts.vatIdValidatedAt,
      // Include bobId from relationship for ID substitution
      bobId: contactCompaniesAlias.bobId,
    })
    .from(globalContacts)
    .innerJoin(contactCompaniesAlias, and(...joinConditions))
    .orderBy(primarySort, secondarySort);

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  if (limit !== null && limit !== undefined) {
    // Fetch one extra to determine if there are more results
    query = query.limit(limit + 1) as typeof query;
  }

  return (await query) as ContactWithBobId[];
}

/** Alias for companies table to avoid column name conflicts in joins */
const companiesAlias = alias(companies, 'c');

/**
 * Build and execute a query for contacts filtered by company's bob_reference_id.
 * Requires joining through global_contacts_companies -> companies tables.
 *
 * @param database - Database instance
 * @param bobReferenceId - Company's Bob reference ID to filter by
 * @param role - Optional role filter (customer/supplier)
 * @param conditions - Additional WHERE conditions
 * @param primarySort - Primary sort expression
 * @param secondarySort - Secondary sort expression (tiebreaker)
 * @param limit - Result limit (null for unlimited)
 * @returns Array of GlobalContact matching the filters
 */
export async function queryContactsWithBobReferenceIdFilter(
  database: Database,
  bobReferenceId: string,
  role: string | undefined,
  conditions: SQL[],
  primarySort: ReturnType<typeof desc>,
  secondarySort: ReturnType<typeof desc>,
  limit: number | null | undefined
): Promise<ContactWithBobId[]> {
  // Build join conditions for global_contacts_companies
  const gccJoinConditions: SQL[] = [eq(contactCompaniesAlias.globalContactId, globalContacts.id)];

  if (role) {
    gccJoinConditions.push(eq(contactCompaniesAlias.role, role));
  }

  // Build join conditions for companies table
  const companiesJoinConditions: SQL[] = [
    eq(companiesAlias.id, contactCompaniesAlias.companyId),
    eq(companiesAlias.bobReferenceId, bobReferenceId),
  ];

  // Build query with explicit column selection to avoid conflicts
  // Include bobId from global_contacts_companies for ID substitution in API response
  let query = database
    .select({
      id: globalContacts.id,
      createdAt: globalContacts.createdAt,
      updatedAt: globalContacts.updatedAt,
      name: globalContacts.name,
      email: globalContacts.email,
      entityType: globalContacts.entityType,
      source: globalContacts.source,
      phone: globalContacts.phone,
      vatId: globalContacts.vatId,
      vatType: globalContacts.vatType,
      taxNumber: globalContacts.taxNumber,
      contactPerson: globalContacts.contactPerson,
      countryCode: globalContacts.countryCode,
      billingAddress: globalContacts.billingAddress,
      postalAddress: globalContacts.postalAddress,
      rawExtraction: globalContacts.rawExtraction,
      rawViesResponse: globalContacts.rawViesResponse,
      isValidVatId: globalContacts.isValidVatId,
      vatIdValidatedAt: globalContacts.vatIdValidatedAt,
      // Include bobId from relationship for ID substitution
      bobId: contactCompaniesAlias.bobId,
    })
    .from(globalContacts)
    .innerJoin(contactCompaniesAlias, and(...gccJoinConditions))
    .innerJoin(companiesAlias, and(...companiesJoinConditions))
    .orderBy(primarySort, secondarySort);

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  if (limit !== null && limit !== undefined) {
    // Fetch one extra to determine if there are more results
    query = query.limit(limit + 1) as typeof query;
  }

  return (await query) as ContactWithBobId[];
}

export async function listContacts(
  filters: ContactListFilters = {},
  pagination: ContactPaginationOptions,
  database: Database = db
): Promise<ListContactsResult> {
  const { sort, cursor, limit } = pagination;
  const conditions: SQL[] = [];

  // Validate and decode cursor using early-return helper
  const cursorData = validateCursor(cursor, sort);

  // Build filter conditions
  if (filters.source) {
    conditions.push(eq(globalContacts.source, filters.source));
  }

  if (filters.isValidVatId !== undefined) {
    conditions.push(eq(globalContacts.isValidVatId, filters.isValidVatId));
  }

  if (filters.countryCode) {
    conditions.push(eq(globalContacts.countryCode, filters.countryCode));
  }

  if (filters.entityType) {
    conditions.push(eq(globalContacts.entityType, filters.entityType));
  }

  // Use date_trunc to compare at millisecond precision to handle precision mismatch
  // between PostgreSQL (microseconds) and JavaScript Date (milliseconds).
  // This prevents duplicate records when paginating with updated_at_gt/lt filters.
  if (filters.updatedAtGt) {
    conditions.push(
      sql`date_trunc('milliseconds', ${globalContacts.updatedAt}) > date_trunc('milliseconds', ${filters.updatedAtGt.toISOString()}::timestamptz)`
    );
  }

  if (filters.updatedAtLt) {
    conditions.push(
      sql`date_trunc('milliseconds', ${globalContacts.updatedAt}) < date_trunc('milliseconds', ${filters.updatedAtLt.toISOString()}::timestamptz)`
    );
  }

  // Handle company/role filtering (requires join)
  const needsCompanyJoin = filters.companyId !== undefined;
  const needsBobReferenceIdJoin = filters.bobReferenceId !== undefined;

  // Build cursor condition for pagination using helper
  if (cursorData) {
    const cursorCondition = buildCursorCondition(cursorData, sort);
    if (cursorCondition) {
      conditions.push(cursorCondition);
    }
  }

  // Build sort order
  const sortColumn = getSortColumn(sort.field);
  const primarySort = sort.direction === 'desc' ? desc(sortColumn) : asc(sortColumn);
  const secondarySort =
    sort.direction === 'desc' ? desc(globalContacts.id) : asc(globalContacts.id);

  // Execute query
  // Use ContactWithBobId type which includes optional bobId from company relationship
  let results: ContactWithBobId[];

  if (needsCompanyJoin && filters.companyId) {
    // Use helper function with aliased join for company filtering
    // Returns contacts with bobId included
    results = await queryContactsWithCompanyFilter(
      database,
      filters.companyId,
      filters.role,
      conditions,
      primarySort,
      secondarySort,
      limit
    );
  } else if (needsBobReferenceIdJoin && filters.bobReferenceId) {
    // Use helper function with aliased join for bob_reference_id filtering
    // Returns contacts with bobId included
    results = await queryContactsWithBobReferenceIdFilter(
      database,
      filters.bobReferenceId,
      filters.role,
      conditions,
      primarySort,
      secondarySort,
      limit
    );
  } else {
    // Query without join - no bobId available (no company context)
    let query = database.select().from(globalContacts).orderBy(primarySort, secondarySort);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    if (limit !== null && limit !== undefined) {
      // Fetch one extra to determine if there are more results
      query = query.limit(limit + 1) as typeof query;
    }

    // Cast to ContactWithBobId - bobId will be undefined for these results
    results = (await query) as ContactWithBobId[];
  }

  // Determine if there are more results
  let hasMore = false;
  if (limit !== null && limit !== undefined && results.length > limit) {
    hasMore = true;
    results = results.slice(0, limit);
  }

  // Generate next cursor if there are more results
  let nextCursor: string | null = null;
  if (hasMore && results.length > 0) {
    const lastContact = results.at(-1);
    if (lastContact) {
      nextCursor = encodeCursor({
        sortField: sort.field,
        sortDirection: sort.direction,
        sortValue: getSortValue(lastContact, sort.field),
        id: lastContact.id,
      });
    }
  }

  return {
    contacts: results,
    pagination: {
      nextCursor,
      hasMore,
    },
  };
}

/**
 * Find a contact by ID with company relationships
 */
export async function findContactByIdWithCompanies(
  id: string,
  database: Database = db
): Promise<{
  contact: GlobalContact;
  companies: Array<{
    id: string;
    companyId: string;
    role: string;
  }>;
} | null> {
  const contact = await findContactById(id, database);
  if (!contact) {
    return null;
  }

  const relationships = await database
    .select({
      id: globalContactsCompanies.id,
      companyId: globalContactsCompanies.companyId,
      role: globalContactsCompanies.role,
    })
    .from(globalContactsCompanies)
    .where(eq(globalContactsCompanies.globalContactId, id));

  return {
    contact,
    companies: relationships,
  };
}
