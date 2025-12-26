import { and, desc, eq, type SQL } from 'drizzle-orm';
import type { Database } from '../../../db/connection.js';
import { db } from '../../../db/connection.js';
import { invoices } from '../../../db/schema-local.js';
import type { Invoice, NewInvoice, UpdateInvoice } from '../domain/invoice.entity.js';

/**
 * Filter options for listing invoices
 */
export interface InvoiceFilters {
  companyId?: string;
  type?: string;
  status?: string;
}

/**
 * Create a new invoice
 * @param data Invoice data to insert
 * @param database Database instance (for dependency injection)
 * @returns Created invoice
 */
export async function createInvoice(data: NewInvoice, database: Database = db): Promise<Invoice> {
  const results = await database.insert(invoices).values(data).returning();

  if (!results[0]) {
    throw new Error('Failed to create invoice');
  }

  // Type assertion needed: Drizzle returns type/status as string, but we use typed enums
  return results[0] as Invoice;
}

/**
 * Find an invoice by ID
 * @param id Invoice ID
 * @param database Database instance (for dependency injection)
 * @returns Invoice or null if not found
 */
export async function findInvoiceById(
  id: string,
  database: Database = db
): Promise<Invoice | null> {
  const results = await database.select().from(invoices).where(eq(invoices.id, id));

  // Type assertion needed: Drizzle returns type/status as string, but we use typed enums
  return (results[0] as Invoice | undefined) || null;
}

/**
 * Builds SQL filter conditions from invoice filters
 * @param filters Optional invoice filters to apply
 * @returns Array of SQL conditions
 */
function buildInvoiceFilterConditions(filters?: InvoiceFilters): SQL[] {
  const conditions: SQL[] = [];

  if (filters?.companyId) {
    conditions.push(eq(invoices.companyId, filters.companyId));
  }
  if (filters?.type) {
    conditions.push(eq(invoices.type, filters.type));
  }
  if (filters?.status) {
    conditions.push(eq(invoices.status, filters.status));
  }

  return conditions;
}

/**
 * Find all invoices with optional filtering
 * @param filters Optional filters (companyId, type, status)
 * @param database Database instance (for dependency injection)
 * @returns Array of invoices ordered by issue date (newest first)
 */
export async function findAllInvoices(
  filters?: InvoiceFilters,
  database: Database = db
): Promise<Invoice[]> {
  const conditions = buildInvoiceFilterConditions(filters);

  // Build query with conditions
  const baseQuery = database.select().from(invoices);
  const query = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

  // Order by issue date (newest first)
  const results = await query.orderBy(desc(invoices.issueDate));

  // Type assertion needed: Drizzle returns type/status as string, but we use typed enums
  return results as Invoice[];
}

/**
 * Update an invoice by ID
 * @param id Invoice ID
 * @param data Partial invoice data to update
 * @param database Database instance (for dependency injection)
 * @returns Updated invoice or null if not found
 */
export async function updateInvoice(
  id: string,
  data: UpdateInvoice,
  database: Database = db
): Promise<Invoice | null> {
  // Update the updatedAt timestamp
  const updateData = {
    ...data,
    updatedAt: new Date(),
  };

  const results = await database
    .update(invoices)
    .set(updateData)
    .where(eq(invoices.id, id))
    .returning();

  // Type assertion needed: Drizzle returns type/status as string, but we use typed enums
  return (results[0] as Invoice | undefined) || null;
}

/**
 * Delete an invoice by ID (hard delete)
 * @param id Invoice ID
 * @param database Database instance (for dependency injection)
 * @returns true if deleted, false if not found
 */
export async function deleteInvoice(id: string, database: Database = db): Promise<boolean> {
  const result = await database.delete(invoices).where(eq(invoices.id, id)).returning();

  return result.length > 0;
}
