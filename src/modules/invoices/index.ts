/**
 * Invoices Module
 *
 * This module provides CRUD operations for managing invoices within the accounting system.
 * Invoices represent billing documents linked to companies, supporting both sales invoices
 * (issued to customers) and purchase invoices (received from suppliers).
 *
 * @module invoices
 *
 * ## Public API
 *
 * ### API Layer
 * - `invoicesContract` - ts-rest API contract definition
 * - `registerInvoicesRoutes` - Fastify route registration function
 *
 * ### Service Layer
 * - `invoicesService` - Default service instance
 * - `InvoiceNotFoundError` - Error thrown when invoice is not found
 * - `InvoiceValidationError` - Error thrown when validation fails
 *
 * ### Domain Types
 * - `Invoice` - Invoice entity type
 * - `NewInvoice` - Type for creating invoices
 * - `UpdateInvoice` - Type for updating invoices
 * - `InvoiceType` - Invoice type enum (sales, purchase)
 * - `InvoiceStatus` - Invoice status enum (draft, sent, paid, overdue, cancelled)
 * - `CreateInvoiceInput` - Input type for create operation
 * - `UpdateInvoiceInput` - Input type for update operation
 * - `ListInvoicesQuery` - Query parameters for listing
 */

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
