import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  createInvoiceSchema,
  invoiceIdSchema,
  invoiceStatusSchema,
  invoiceTypeSchema,
  listInvoicesQuerySchema,
  updateInvoiceSchema,
} from '../domain/invoice.types.js';

const c = initContract();

/**
 * Invoice response schema
 * Represents the full invoice object returned by the API
 */
const invoiceResponseSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  companyId: z.string().uuid(),
  contactId: z.string().uuid().nullable(),
  type: invoiceTypeSchema,
  status: invoiceStatusSchema,
  invoiceNumber: z.string(),
  issueDate: z.string(), // DATE in postgres returns as string
  dueDate: z.string().nullable(), // DATE in postgres returns as string
  paidAt: z.date().nullable(),
  currency: z.string(),
  totalAmount: z.string(), // NUMERIC stored as string for precision
  description: z.string().nullable(),
});

/**
 * Error response schemas
 */
const validationErrorSchema = z.object({
  error: z.string(),
  details: z
    .union([z.string(), z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))])
    .optional(),
});

const notFoundErrorSchema = z.object({
  error: z.string(),
});

const unauthorizedErrorSchema = z.object({
  error: z.string(),
});

const internalErrorSchema = z.object({
  error: z.string(),
});

const conflictErrorSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
});

/**
 * Delete response schema
 */
const deleteResponseSchema = z.object({
  success: z.boolean(),
  id: z.string().uuid(),
});

/**
 * List response schema
 */
const listResponseSchema = z.object({
  invoices: z.array(invoiceResponseSchema),
});

/**
 * Invoices API Contract
 * Defines all endpoints for CRUD operations on invoices
 */
export const invoicesContract = c.router({
  /**
   * Create a new invoice
   */
  create: {
    method: 'POST',
    path: '/api/internal/invoices',
    responses: {
      201: invoiceResponseSchema,
      400: validationErrorSchema,
      409: conflictErrorSchema,
      500: internalErrorSchema,
    },
    body: createInvoiceSchema,
    summary: 'Create a new invoice',
    description: 'Creates a new invoice with the provided data',
  },

  /**
   * Get an invoice by ID
   */
  getById: {
    method: 'GET',
    path: '/api/internal/invoices/:id',
    responses: {
      200: invoiceResponseSchema,
      400: validationErrorSchema,
      401: unauthorizedErrorSchema,
      404: notFoundErrorSchema,
      500: internalErrorSchema,
    },
    pathParams: z.object({
      id: invoiceIdSchema,
    }),
    summary: 'Get an invoice by ID',
    description: 'Retrieves a single invoice by its unique identifier',
  },

  /**
   * List all invoices
   */
  list: {
    method: 'GET',
    path: '/api/internal/invoices',
    responses: {
      200: listResponseSchema,
      400: validationErrorSchema,
      401: unauthorizedErrorSchema,
      500: internalErrorSchema,
    },
    query: listInvoicesQuerySchema,
    summary: 'List all invoices',
    description: 'Retrieves all invoices with optional filtering by companyId, type, and status',
  },

  /**
   * Update an invoice by ID
   */
  update: {
    method: 'PATCH',
    path: '/api/internal/invoices/:id',
    responses: {
      200: invoiceResponseSchema,
      400: validationErrorSchema,
      401: unauthorizedErrorSchema,
      404: notFoundErrorSchema,
      409: conflictErrorSchema,
      500: internalErrorSchema,
    },
    pathParams: z.object({
      id: invoiceIdSchema,
    }),
    body: updateInvoiceSchema,
    summary: 'Update an invoice',
    description: 'Updates an existing invoice with partial data',
  },

  /**
   * Delete an invoice by ID
   */
  delete: {
    method: 'DELETE',
    path: '/api/internal/invoices/:id',
    responses: {
      200: deleteResponseSchema,
      400: validationErrorSchema,
      401: unauthorizedErrorSchema,
      404: notFoundErrorSchema,
      500: internalErrorSchema,
    },
    pathParams: z.object({
      id: invoiceIdSchema,
    }),
    summary: 'Delete an invoice',
    description: 'Permanently deletes an invoice from the database',
  },
});
