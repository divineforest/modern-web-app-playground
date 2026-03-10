import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  internalErrorSchema,
  notFoundErrorSchema,
  unauthorizedErrorSchema,
  unprocessableEntityErrorSchema,
  validationErrorSchema,
} from '../shared/errors.js';
import { addItemSchema, cartResponseSchema, mergeCartSchema, updateItemSchema } from './schemas.js';

const c = initContract();

export const cartContract = c.router({
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
