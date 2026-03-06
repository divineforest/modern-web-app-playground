import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  internalErrorSchema,
  notFoundErrorSchema,
  validationErrorSchema,
} from '../shared/errors.js';
import {
  listProductsQuerySchema,
  productResponseSchema,
  productsListResponseSchema,
  searchProductsQuerySchema,
} from './schemas.js';

const c = initContract();

export const productsContract = c.router({
  list: {
    method: 'GET',
    path: '/api/products',
    responses: {
      200: productsListResponseSchema,
      400: validationErrorSchema,
      500: internalErrorSchema,
    },
    query: listProductsQuerySchema,
    summary: 'List all products',
    description: 'Retrieves all products with optional filtering by status and category',
  },

  getBySlug: {
    method: 'GET',
    path: '/api/products/by-slug/:slug',
    responses: {
      200: productResponseSchema,
      404: notFoundErrorSchema,
      500: internalErrorSchema,
    },
    pathParams: z.object({
      slug: z.string(),
    }),
    summary: 'Get a product by slug',
    description: 'Retrieves a single product by its URL-friendly slug',
  },

  search: {
    method: 'GET',
    path: '/api/products/search',
    responses: {
      200: productsListResponseSchema,
      400: validationErrorSchema,
      500: internalErrorSchema,
    },
    query: searchProductsQuerySchema,
    summary: 'Search products',
    description: 'Search products by keywords in name and description with full-text search',
  },
});
