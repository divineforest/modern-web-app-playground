import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  createOrderSchema,
  listOrdersQuerySchema,
  orderIdSchema,
  orderStatusSchema,
  updateOrderSchema,
} from '../domain/order.types.js';

const c = initContract();

/**
 * Order response schema
 * Represents the full order object returned by the API
 */
const orderResponseSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  status: orderStatusSchema,
  orderNumber: z.string(),
  referenceNumber: z.string().nullable(),
  orderDate: z.string(), // DATE in postgres returns as string
  expectedDeliveryDate: z.string().nullable(), // DATE in postgres returns as string
  currency: z.string(),
  subtotal: z.string(), // NUMERIC stored as string for precision
  taxAmount: z.string(), // NUMERIC stored as string for precision
  discountAmount: z.string(), // NUMERIC stored as string for precision
  shippingAmount: z.string(), // NUMERIC stored as string for precision
  totalAmount: z.string(), // NUMERIC stored as string for precision
  shippingAddress: z.string().nullable(),
  billingAddress: z.string().nullable(),
  paymentTerms: z.string().nullable(),
  notes: z.string().nullable(),
  customerNotes: z.string().nullable(),
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
  orders: z.array(orderResponseSchema),
});

/**
 * Orders API Contract
 * Defines all endpoints for CRUD operations on orders
 */
export const ordersContract = c.router({
  /**
   * Create a new order
   */
  create: {
    method: 'POST',
    path: '/api/orders',
    responses: {
      201: orderResponseSchema,
      400: validationErrorSchema,
      409: conflictErrorSchema,
      500: internalErrorSchema,
    },
    body: createOrderSchema,
    summary: 'Create a new order',
    description: 'Creates a new order with the provided data',
  },

  /**
   * Get an order by ID
   */
  getById: {
    method: 'GET',
    path: '/api/orders/:id',
    responses: {
      200: orderResponseSchema,
      400: validationErrorSchema,
      401: unauthorizedErrorSchema,
      404: notFoundErrorSchema,
      500: internalErrorSchema,
    },
    pathParams: z.object({
      id: orderIdSchema,
    }),
    summary: 'Get an order by ID',
    description: 'Retrieves a single order by its unique identifier',
  },

  /**
   * List all orders
   */
  list: {
    method: 'GET',
    path: '/api/orders',
    responses: {
      200: listResponseSchema,
      400: validationErrorSchema,
      401: unauthorizedErrorSchema,
      500: internalErrorSchema,
    },
    query: listOrdersQuerySchema,
    summary: 'List all orders',
    description: 'Retrieves all orders with optional filtering by status',
  },

  /**
   * Update an order by ID
   */
  update: {
    method: 'PATCH',
    path: '/api/orders/:id',
    responses: {
      200: orderResponseSchema,
      400: validationErrorSchema,
      401: unauthorizedErrorSchema,
      404: notFoundErrorSchema,
      409: conflictErrorSchema,
      500: internalErrorSchema,
    },
    pathParams: z.object({
      id: orderIdSchema,
    }),
    body: updateOrderSchema,
    summary: 'Update an order',
    description: 'Updates an existing order with partial data',
  },

  /**
   * Delete an order by ID
   */
  delete: {
    method: 'DELETE',
    path: '/api/orders/:id',
    responses: {
      200: deleteResponseSchema,
      400: validationErrorSchema,
      401: unauthorizedErrorSchema,
      404: notFoundErrorSchema,
      500: internalErrorSchema,
    },
    pathParams: z.object({
      id: orderIdSchema,
    }),
    summary: 'Delete an order',
    description: 'Permanently deletes an order from the database',
  },
});
