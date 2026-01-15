// ============================================================================
// API LAYER EXPORTS
// ============================================================================

export { invoicesContract } from './api/invoices.contracts.js';
export { registerInvoicesRoutes } from './api/invoices.routes.js';

// ============================================================================
// DOMAIN EXPORTS
// ============================================================================

export type { Invoice, NewInvoice, UpdateInvoice } from './domain/invoice.entity.js';
export type {
  CreateInvoiceInput,
  InvoiceStatus,
  InvoiceType,
  ListInvoicesQuery,
  UpdateInvoiceInput,
} from './domain/invoice.types.js';

// ============================================================================
// SERVICE EXPORTS
// ============================================================================

export {
  InvoiceNotFoundError,
  InvoiceValidationError,
  invoicesService,
} from './services/invoices.service.js';
