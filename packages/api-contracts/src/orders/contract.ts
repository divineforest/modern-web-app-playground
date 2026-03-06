import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  conflictErrorSchema,
  internalErrorSchema,
  notFoundErrorSchema,
  unauthorizedErrorSchema,
  validationErrorSchema,
} from '../shared/errors.js';
import {
  createOrderSchema,
  listOrdersQuerySchema,
  orderDeleteResponseSchema,
  orderIdSchema,
  orderResponseSchema,
  ordersListResponseSchema,
  orderWithItemsResponseSchema,
  updateOrderSchema,
} from './schemas.js';

const c = initContract();

export const ordersContract = c.router({
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

  listMyOrders: {
    method: 'GET',
    path: '/api/orders/me',
    responses: {
      200: z.object({ orders: z.array(orderWithItemsResponseSchema) }),
      401: unauthorizedErrorSchema,
      500: internalErrorSchema,
    },
    summary: 'List my orders',
    description: 'Retrieves all orders for the authenticated user, including order items',
  },

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

  list: {
    method: 'GET',
    path: '/api/orders',
    responses: {
      200: ordersListResponseSchema,
      400: validationErrorSchema,
      401: unauthorizedErrorSchema,
      500: internalErrorSchema,
    },
    query: listOrdersQuerySchema,
    summary: 'List all orders',
    description: 'Retrieves all orders with optional filtering by status',
  },

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

  delete: {
    method: 'DELETE',
    path: '/api/orders/:id',
    responses: {
      200: orderDeleteResponseSchema,
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

  getByOrderNumber: {
    method: 'GET',
    path: '/api/orders/by-number/:orderNumber',
    responses: {
      200: orderWithItemsResponseSchema,
      400: validationErrorSchema,
      401: unauthorizedErrorSchema,
      404: notFoundErrorSchema,
      500: internalErrorSchema,
    },
    pathParams: z.object({
      orderNumber: z.string().min(1, 'Order number is required'),
    }),
    summary: 'Get an order by order number',
    description: 'Retrieves a single order by its order number, including items',
  },
});
