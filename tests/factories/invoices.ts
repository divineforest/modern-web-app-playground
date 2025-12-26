import type { Database } from '../../src/db/index.js';
import { db, invoices } from '../../src/db/index.js';
import type { Invoice, NewInvoice } from '../../src/modules/invoices/domain/invoice.entity.js';
import { createTestCompany } from './companies.js';

/**
 * Build test invoice data with default values that can be overridden
 * Note: companyId is required to ensure valid foreign key references
 * Use createTestInvoice() if you want companyId to be automatically created
 */
export function buildTestInvoiceData(
  required: { companyId: string },
  overrides: Partial<Omit<NewInvoice, 'companyId'>> = {}
): NewInvoice {
  const now = new Date();
  const invoiceNumber = overrides.invoiceNumber || `INV-${now.getTime()}`;

  return {
    companyId: required.companyId,
    contactId: overrides.contactId !== undefined ? overrides.contactId : null,
    type: overrides.type || 'sales',
    status: overrides.status || 'draft',
    invoiceNumber,
    issueDate: overrides.issueDate || now.toISOString().split('T')[0] || '2024-01-01',
    dueDate: overrides.dueDate !== undefined ? overrides.dueDate : null,
    paidAt: overrides.paidAt !== undefined ? overrides.paidAt : null,
    currency: overrides.currency || 'EUR',
    totalAmount: overrides.totalAmount || '1000.00',
    description: overrides.description !== undefined ? overrides.description : null,
  };
}

/**
 * Create a test invoice record in the database with default values that can be overridden
 * Note: If companyId is not provided, it will be created automatically
 */
export async function createTestInvoice(
  overrides: Partial<NewInvoice> = {},
  database: Database = db
): Promise<Invoice> {
  // If no companyId provided, create a test company
  let companyId = overrides.companyId;
  if (!companyId) {
    const company = await createTestCompany();
    companyId = company.id;
  }

  const invoiceData = buildTestInvoiceData({ companyId }, overrides);
  const results = await database.insert(invoices).values(invoiceData).returning();

  if (!results[0]) {
    throw new Error('Failed to create test invoice');
  }

  // Type assertion needed: Drizzle returns type/status as string, but we use typed enums
  return results[0] as Invoice;
}

/**
 * Create multiple test invoice records in the database
 * Note: If companyId is not provided, a single company will be created for all invoices
 */
export async function createTestInvoices(
  count: number,
  overrides: Partial<NewInvoice> = {},
  database: Database = db
): Promise<Invoice[]> {
  // If no companyId provided, create a test company to use for all invoices
  let companyId = overrides.companyId;
  if (!companyId) {
    const company = await createTestCompany();
    companyId = company.id;
  }

  const result: Invoice[] = [];

  for (let index = 0; index < count; index++) {
    const invoiceData = buildTestInvoiceData(
      { companyId },
      {
        invoiceNumber: `INV-TEST-${Date.now()}-${index}`,
        ...overrides,
      }
    );
    const results = await database.insert(invoices).values(invoiceData).returning();

    if (!results[0]) {
      throw new Error(`Failed to create test invoice ${index + 1}`);
    }

    // Type assertion needed: Drizzle returns type/status as string, but we use typed enums
    result.push(results[0] as Invoice);
  }

  return result;
}
