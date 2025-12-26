import { z } from 'zod';

/**
 * Invoice type enum
 */
const invoiceTypeEnum = ['sales', 'purchase'] as const;
export type InvoiceType = (typeof invoiceTypeEnum)[number];

/**
 * Invoice status enum
 */
const invoiceStatusEnum = ['draft', 'sent', 'paid', 'overdue', 'cancelled'] as const;
export type InvoiceStatus = (typeof invoiceStatusEnum)[number];

/**
 * Validation schema for invoice type
 */
export const invoiceTypeSchema = z.enum(invoiceTypeEnum);

/**
 * Validation schema for invoice status
 */
export const invoiceStatusSchema = z.enum(invoiceStatusEnum);

/**
 * Validation schema for invoice ID
 */
export const invoiceIdSchema = z.string().uuid('Invalid invoice ID');

/**
 * Validation schema for company ID
 */
const invoiceCompanyIdSchema = z.string().uuid('Invalid company ID');

/**
 * Validation schema for contact ID
 */
const invoiceContactIdSchema = z.string().uuid('Invalid contact ID').nullable().optional();

/**
 * Validation schema for invoice number
 */
const invoiceNumberSchema = z.string().min(1, 'Invoice number is required');

/**
 * Validation schema for issue date
 * Note: stored as DATE in postgres, comes back as string
 */
const invoiceIssueDateSchema = z.string().min(1, 'Issue date is required');

/**
 * Validation schema for due date
 * Note: stored as DATE in postgres, comes back as string
 */
const invoiceDueDateSchema = z.string().nullable().optional();

/**
 * Validation schema for currency (ISO 4217 code)
 */
const invoiceCurrencySchema = z.string().length(3, 'Currency must be a 3-letter ISO code');

/**
 * Validation schema for total amount
 */
const invoiceTotalAmountSchema = z.coerce
  .number()
  .min(0, 'Total amount must be non-negative')
  .transform((val) => val.toFixed(2));

/**
 * Validation schema for description
 */
const invoiceDescriptionSchema = z.string().nullable().optional();

/**
 * Complete validation schema for creating an invoice
 */
export const createInvoiceSchema = z.object({
  companyId: invoiceCompanyIdSchema,
  contactId: invoiceContactIdSchema,
  type: invoiceTypeSchema,
  status: invoiceStatusSchema.default('draft'),
  invoiceNumber: invoiceNumberSchema,
  issueDate: invoiceIssueDateSchema,
  dueDate: invoiceDueDateSchema,
  currency: invoiceCurrencySchema,
  totalAmount: invoiceTotalAmountSchema,
  description: invoiceDescriptionSchema,
});

/**
 * Validation schema for updating an invoice (all fields optional)
 * Note: companyId is intentionally excluded as it should be immutable after creation
 */
export const updateInvoiceSchema = z.object({
  contactId: invoiceContactIdSchema,
  type: invoiceTypeSchema.optional(),
  status: invoiceStatusSchema.optional(),
  invoiceNumber: invoiceNumberSchema.optional(),
  issueDate: invoiceIssueDateSchema.optional(),
  dueDate: invoiceDueDateSchema,
  currency: invoiceCurrencySchema.optional(),
  totalAmount: invoiceTotalAmountSchema.optional(),
  description: invoiceDescriptionSchema,
});

/**
 * Validation schema for listing invoices query parameters
 */
export const listInvoicesQuerySchema = z.object({
  companyId: invoiceCompanyIdSchema.optional(),
  type: invoiceTypeSchema.optional(),
  status: invoiceStatusSchema.optional(),
});

/**
 * Type for create invoice input (before Zod transforms)
 * Uses z.input to get the type before transforms are applied
 */
export type CreateInvoiceInput = z.input<typeof createInvoiceSchema>;

/**
 * Type for create invoice output (after Zod transforms)
 * Used internally after validation
 */
export type CreateInvoiceOutput = z.infer<typeof createInvoiceSchema>;

/**
 * Type for update invoice input (before Zod transforms)
 */
export type UpdateInvoiceInput = z.input<typeof updateInvoiceSchema>;

/**
 * Type for update invoice output (after Zod transforms)
 */
export type UpdateInvoiceOutput = z.infer<typeof updateInvoiceSchema>;

/**
 * Type for list invoices query
 */
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
