import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { addItemSchema, mergeCartSchema, updateItemSchema } from '../domain/cart.types.js';

const c = initContract();

/**
 * Cart item schema for API responses
 */
const cartItemSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  productName: z.string(),
  productSku: z.string(),
  productImageUrl: z.string().nullable(),
  unitPrice: z.string(),
  quantity: z.number().int(),
  lineTotal: z.string(),
  currency: z.string(),
});

/**
 * Cart response schema
 */
const cartResponseSchema = z.object({
  items: z.array(cartItemSchema),
  subtotal: z.string(),
  itemCount: z.number().int(),
  currency: z.string().nullable(),
  cartToken: z.string().optional(),
  newCartToken: z.string().optional(),
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

const unprocessableEntityErrorSchema = z.object({
  error: z.string(),
});

const internalErrorSchema = z.object({
  error: z.string(),
});

/**
 * Success response schema for delete operations
 */
const successResponseSchema = z.object({
  success: z.boolean(),
});

/**
 * Cart API Contract
 * Defines all endpoints for cart operations
 */
export const cartContract = c.router({
  /**
   * Get current cart with items
   */
  getCart: {
    method: 'GET',
    path: '/api/cart',
    responses: {
      200: cartResponseSchema,
      500: internalErrorSchema,
    },
    summary: 'Get current cart',
    description: 'Retrieves the current cart with all items. Returns empty cart if none exists.',
  },

  /**
   * Add item to cart
   */
  addItem: {
    method: 'POST',
    path: '/api/cart/items',
    responses: {
      200: cartResponseSchema,
      400: validationErrorSchema,
      404: notFoundErrorSchema,
      422: unprocessableEntityErrorSchema,
      500: internalErrorSchema,
    },
    body: addItemSchema,
    summary: 'Add item to cart',
    description: 'Adds a product to the cart. Creates cart if it does not exist.',
  },

  /**
   * Update item quantity
   */
  updateItem: {
    method: 'PATCH',
    path: '/api/cart/items/:itemId',
    responses: {
      200: cartResponseSchema,
      400: validationErrorSchema,
      404: notFoundErrorSchema,
      500: internalErrorSchema,
    },
    pathParams: z.object({
      itemId: z.string().uuid('Invalid item ID'),
    }),
    body: updateItemSchema,
    summary: 'Update item quantity',
    description: 'Updates the quantity of an existing cart item.',
  },

  /**
   * Remove item from cart
   */
  removeItem: {
    method: 'DELETE',
    path: '/api/cart/items/:itemId',
    responses: {
      200: cartResponseSchema,
      404: notFoundErrorSchema,
      500: internalErrorSchema,
    },
    pathParams: z.object({
      itemId: z.string().uuid('Invalid item ID'),
    }),
    summary: 'Remove item from cart',
    description: 'Removes a single item from the cart. Deletes cart if it was the last item.',
  },

  /**
   * Clear entire cart
   */
  clearCart: {
    method: 'DELETE',
    path: '/api/cart',
    responses: {
      200: successResponseSchema,
      500: internalErrorSchema,
    },
    summary: 'Clear cart',
    description: 'Removes all items from the cart and deletes the cart.',
  },

  /**
   * Merge guest cart into user cart
   */
  mergeCart: {
    method: 'POST',
    path: '/api/cart/merge',
    responses: {
      200: cartResponseSchema,
      400: validationErrorSchema,
      401: unauthorizedErrorSchema,
      404: notFoundErrorSchema,
      500: internalErrorSchema,
    },
    body: mergeCartSchema,
    summary: 'Merge guest cart',
    description: "Merges a guest cart into the authenticated user's cart.",
  },
});
