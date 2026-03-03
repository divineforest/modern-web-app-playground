import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { listProductsQuerySchema, productStatusSchema } from '../domain/product.types.js';

const c = initContract();

/**
 * Product response schema (excluding costPrice for public API)
 */
const productResponseSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  status: productStatusSchema,
  name: z.string(),
  slug: z.string(),
  sku: z.string(),
  description: z.string().nullable(),
  shortDescription: z.string().nullable(),
  category: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  imageUrl: z.string().nullable(),
  currency: z.string(),
  price: z.string(),
  compareAtPrice: z.string().nullable(),
  weight: z.string().nullable(),
  width: z.string().nullable(),
  height: z.string().nullable(),
  length: z.string().nullable(),
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

const internalErrorSchema = z.object({
  error: z.string(),
});

/**
 * List response schema
 */
const listResponseSchema = z.object({
  products: z.array(productResponseSchema),
});

/**
 * Products API Contract
 * Defines all endpoints for product operations
 */
export const productsContract = c.router({
  /**
   * List all products
   */
  list: {
    method: 'GET',
    path: '/api/products',
    responses: {
      200: listResponseSchema,
      400: validationErrorSchema,
      500: internalErrorSchema,
    },
    query: listProductsQuerySchema,
    summary: 'List all products',
    description: 'Retrieves all products with optional filtering by status and category',
  },
});
