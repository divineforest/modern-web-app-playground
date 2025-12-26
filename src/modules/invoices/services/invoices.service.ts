import type { Database } from '../../../db/connection.js';
import { db } from '../../../db/connection.js';
import {
  transformDatabaseError,
  ValidationError,
  type ValidationErrorDetails,
} from '../../../lib/error-transformers.js';
import { logger } from '../../../lib/logger.js';
import type { Invoice, UpdateInvoice } from '../domain/invoice.entity.js';
import type {
  CreateInvoiceInput,
  CreateInvoiceOutput,
  ListInvoicesQuery,
  UpdateInvoiceInput,
  UpdateInvoiceOutput,
} from '../domain/invoice.types.js';
import { createInvoiceSchema, updateInvoiceSchema } from '../domain/invoice.types.js';
import {
  createInvoice,
  deleteInvoice,
  findAllInvoices,
  findInvoiceById,
  updateInvoice,
} from '../repositories/invoices.repository.js';

/**
 * Custom error for invoice not found
 */
export class InvoiceNotFoundError extends Error {
  constructor(id: string) {
    super(`Invoice with ID ${id} not found`);
    this.name = 'InvoiceNotFoundError';
  }
}

/**
 * Custom error for validation failures
 */
export class InvoiceValidationError extends ValidationError {
  constructor(message: string, details?: ValidationErrorDetails) {
    super(message, details);
    this.name = 'InvoiceValidationError';
  }
}

/**
 * Create a new invoice with validation
 * @param input Invoice input data (already validated by ts-rest, or raw input for direct calls)
 * @param database Database instance (for dependency injection)
 * @returns Created invoice
 * @throws InvoiceValidationError if validation fails
 */
export async function createInvoiceService(
  input: CreateInvoiceInput | CreateInvoiceOutput,
  database: Database = db
): Promise<Invoice> {
  try {
    // Validate/transform input - handles both raw input (number) and pre-parsed (string)
    const validatedData: CreateInvoiceOutput = createInvoiceSchema.parse(input);

    // Create the invoice - CreateInvoiceOutput is compatible with NewInvoice
    const invoice = await createInvoice(validatedData, database);

    logger.info({ invoiceId: invoice.id }, 'Invoice created successfully');

    return invoice;
  } catch (error) {
    // Re-throw existing validation errors
    if (error instanceof InvoiceValidationError) {
      throw error;
    }

    // Handle Zod validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      logger.warn({ error, input }, 'Invoice validation failed');
      throw new InvoiceValidationError('Validation failed', { zodError: error.message });
    }

    // Transform database errors to validation errors
    const dbError = transformDatabaseError(error);
    if (dbError) {
      logger.warn({ error, input }, 'Database constraint violation');
      throw new InvoiceValidationError(dbError.message, dbError.details);
    }

    // Log and re-throw unexpected errors
    logger.error({ error, input }, 'Failed to create invoice');
    throw error;
  }
}

/**
 * Get an invoice by ID
 * @param id Invoice ID
 * @param database Database instance (for dependency injection)
 * @returns Invoice
 * @throws InvoiceNotFoundError if not found
 */
export async function getInvoiceByIdService(id: string, database: Database = db): Promise<Invoice> {
  const invoice = await findInvoiceById(id, database);

  if (!invoice) {
    logger.warn({ invoiceId: id }, 'Invoice not found');
    throw new InvoiceNotFoundError(id);
  }

  return invoice;
}

/**
 * List all invoices with optional filtering
 * @param query Query parameters for filtering
 * @param database Database instance (for dependency injection)
 * @returns Array of invoices
 */
export async function listInvoicesService(
  query: ListInvoicesQuery = {},
  database: Database = db
): Promise<Invoice[]> {
  const filters: {
    companyId?: string;
    type?: string;
    status?: string;
  } = {};

  if (query.companyId) filters.companyId = query.companyId;
  if (query.type) filters.type = query.type;
  if (query.status) filters.status = query.status;

  const invoices = await findAllInvoices(filters, database);

  logger.info({ count: invoices.length, filters }, 'Listed invoices');

  return invoices;
}

/**
 * Update an invoice by ID
 * @param id Invoice ID
 * @param input Partial invoice data to update (already validated by ts-rest, or raw input for direct calls)
 * @param database Database instance (for dependency injection)
 * @returns Updated invoice
 * @throws InvoiceNotFoundError if not found
 * @throws InvoiceValidationError if validation fails
 */
export async function updateInvoiceService(
  id: string,
  input: UpdateInvoiceInput | UpdateInvoiceOutput,
  database: Database = db
): Promise<Invoice> {
  try {
    // Validate/transform input - handles both raw input (number) and pre-parsed (string)
    const validatedData: UpdateInvoiceOutput = updateInvoiceSchema.parse(input);

    // Get the current invoice to check status changes
    const currentInvoice = await findInvoiceById(id, database);
    if (!currentInvoice) {
      logger.warn({ invoiceId: id }, 'Invoice not found for update');
      throw new InvoiceNotFoundError(id);
    }

    // Automatically set paidAt when status changes to 'paid'
    const updateData: Record<string, unknown> = { ...validatedData };
    if (validatedData.status === 'paid' && currentInvoice.status !== 'paid') {
      // Auto-set paidAt timestamp
      updateData['paidAt'] = new Date();
      logger.info({ invoiceId: id }, 'Auto-setting paidAt timestamp');
    }

    // Clear paidAt when status changes from 'paid' to something else
    if (
      validatedData.status &&
      validatedData.status !== 'paid' &&
      currentInvoice.status === 'paid'
    ) {
      updateData['paidAt'] = null;
      logger.info({ invoiceId: id }, 'Clearing paidAt timestamp');
    }

    // Update the invoice
    const invoice = await updateInvoice(id, updateData as UpdateInvoice, database);

    if (!invoice) {
      logger.warn({ invoiceId: id }, 'Invoice not found for update');
      throw new InvoiceNotFoundError(id);
    }

    logger.info({ invoiceId: id }, 'Invoice updated successfully');

    return invoice;
  } catch (error) {
    // Re-throw existing domain errors
    if (error instanceof InvoiceNotFoundError || error instanceof InvoiceValidationError) {
      throw error;
    }

    // Handle Zod validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      logger.warn({ error, id, input }, 'Invoice update validation failed');
      throw new InvoiceValidationError('Validation failed', { zodError: error.message });
    }

    // Transform database errors to validation errors
    const dbError = transformDatabaseError(error);
    if (dbError) {
      logger.warn({ error, id, input }, 'Database constraint violation');
      throw new InvoiceValidationError(dbError.message, dbError.details);
    }

    // Log and re-throw unexpected errors
    logger.error({ error, id, input }, 'Failed to update invoice');
    throw error;
  }
}

/**
 * Delete an invoice by ID
 * @param id Invoice ID
 * @param database Database instance (for dependency injection)
 * @returns Deleted invoice ID
 * @throws InvoiceNotFoundError if not found
 */
export async function deleteInvoiceService(id: string, database: Database = db): Promise<string> {
  const deleted = await deleteInvoice(id, database);

  if (!deleted) {
    logger.warn({ invoiceId: id }, 'Invoice not found for deletion');
    throw new InvoiceNotFoundError(id);
  }

  logger.info({ invoiceId: id }, 'Invoice deleted successfully');

  return id;
}

/**
 * Invoices service factory function for dependency injection
 * Returns an object with all invoice operations bound to a specific database
 */
function createInvoicesService(database: Database = db) {
  return {
    create: (input: CreateInvoiceInput | CreateInvoiceOutput) =>
      createInvoiceService(input, database),
    getById: (id: string) => getInvoiceByIdService(id, database),
    list: (query?: ListInvoicesQuery) => listInvoicesService(query, database),
    update: (id: string, input: UpdateInvoiceInput | UpdateInvoiceOutput) =>
      updateInvoiceService(id, input, database),
    delete: (id: string) => deleteInvoiceService(id, database),
  };
}

// Export a default service instance using the default database
export const invoicesService = createInvoicesService();
