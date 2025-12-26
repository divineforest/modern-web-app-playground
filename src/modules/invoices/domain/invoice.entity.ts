import type {
  Invoice as InvoiceSchema,
  NewInvoice as NewInvoiceSchema,
} from '../../../db/schema.js';
import type { InvoiceStatus, InvoiceType } from './invoice.types.js';

/**
 * Invoice entity
 * Represents a billing document linked to a company
 * We override the type and status fields to be specific enums instead of generic strings
 */
export type Invoice = Omit<InvoiceSchema, 'type' | 'status'> & {
  type: InvoiceType;
  status: InvoiceStatus;
};

/**
 * New Invoice entity for creation
 * We override the type and status fields to be specific enums instead of generic strings
 */
export type NewInvoice = Omit<NewInvoiceSchema, 'type' | 'status'> & {
  type: InvoiceType;
  status?: InvoiceStatus;
};

/**
 * Update Invoice entity for partial updates
 */
export type UpdateInvoice = Partial<Omit<NewInvoice, 'id' | 'createdAt' | 'companyId'>>;
