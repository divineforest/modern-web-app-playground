import { initContract } from '@ts-rest/core';
import {
  internalErrorSchema,
  notFoundErrorSchema,
  unauthorizedErrorSchema,
  unprocessableEntityErrorSchema,
  validationErrorSchema,
} from '../shared/errors.js';
import { checkoutRequestSchema, checkoutResponseSchema } from './schemas.js';

const c = initContract();

export const checkoutContract = c.router({
  checkout: {
    method: 'POST',
    path: '/api/checkout',
    responses: {
      200: checkoutResponseSchema,
      400: validationErrorSchema,
      401: unauthorizedErrorSchema,
      404: notFoundErrorSchema,
      422: unprocessableEntityErrorSchema,
      500: internalErrorSchema,
    },
    body: checkoutRequestSchema,
    summary: 'Place order from current cart',
    description:
      'Converts the authenticated user cart into a confirmed order with shipping and billing addresses',
  },
});
