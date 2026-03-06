import { ordersContract } from '@mercado/api-contracts';
import { initServer } from '@ts-rest/fastify';
import type { FastifyInstance } from 'fastify';
import { logger } from '../../../lib/logger.js';
import {
  OrderNotFoundError,
  OrderValidationError,
  ordersService,
} from '../services/orders.service.js';

/**
 * Initialize ts-rest server for type-safe route handling
 */
const s = initServer();

/**
 * Orders route handlers
 */
const router = s.router(ordersContract, {
  /**
   * Create a new order
   */
  create: async ({ body }) => {
    try {
      const order = await ordersService.create(body);

      return {
        status: 201 as const,
        body: order,
      };
    } catch (error) {
      if (error instanceof OrderValidationError) {
        // Check if it's a duplicate order number error
        if (error.message.includes('Duplicate') || error.message.includes('already exists')) {
          return {
            status: 409 as const,
            body: {
              error: error.message,
              details: error.details as string | undefined,
            },
          };
        }
        return {
          status: 400 as const,
          body: {
            error: error.message,
            details: error.details,
          },
        };
      }

      logger.error({ error, body }, 'Unexpected error in create order route');
      return {
        status: 500 as const,
        body: {
          error: 'Internal server error',
        },
      };
    }
  },

  /**
   * List my orders
   */
  listMyOrders: async ({ request }) => {
    try {
      if (!request.user) {
        return {
          status: 401 as const,
          body: {
            error: 'Authentication required',
          },
        };
      }

      const orders = await ordersService.listMyOrders(request.user.id);

      return {
        status: 200 as const,
        body: {
          orders,
        },
      };
    } catch (error) {
      logger.error({ error, userId: request.user?.id }, 'Unexpected error in list my orders route');
      return {
        status: 500 as const,
        body: {
          error: 'Internal server error',
        },
      };
    }
  },

  /**
   * Get an order by ID
   */
  getById: async ({ params }) => {
    try {
      const order = await ordersService.getById(params.id);

      return {
        status: 200 as const,
        body: order,
      };
    } catch (error) {
      if (error instanceof OrderNotFoundError) {
        return {
          status: 404 as const,
          body: {
            error: error.message,
          },
        };
      }

      logger.error({ error, orderId: params.id }, 'Unexpected error in get order by ID route');
      return {
        status: 500 as const,
        body: {
          error: 'Internal server error',
        },
      };
    }
  },

  /**
   * List all orders
   */
  list: async ({ query }) => {
    try {
      const orders = await ordersService.list(query);

      return {
        status: 200 as const,
        body: {
          orders,
        },
      };
    } catch (error) {
      logger.error({ error, query }, 'Unexpected error in list orders route');
      return {
        status: 500 as const,
        body: {
          error: 'Internal server error',
        },
      };
    }
  },

  /**
   * Update an order by ID
   */
  update: async ({ params, body }) => {
    try {
      const order = await ordersService.update(params.id, body);

      return {
        status: 200 as const,
        body: order,
      };
    } catch (error) {
      if (error instanceof OrderNotFoundError) {
        return {
          status: 404 as const,
          body: {
            error: error.message,
          },
        };
      }

      if (error instanceof OrderValidationError) {
        // Check if it's a duplicate order number error
        if (error.message.includes('Duplicate') || error.message.includes('already exists')) {
          return {
            status: 409 as const,
            body: {
              error: error.message,
              details: error.details as string | undefined,
            },
          };
        }
        return {
          status: 400 as const,
          body: {
            error: error.message,
            details: error.details,
          },
        };
      }

      logger.error({ error, orderId: params.id, body }, 'Unexpected error in update order route');
      return {
        status: 500 as const,
        body: {
          error: 'Internal server error',
        },
      };
    }
  },

  /**
   * Delete an order by ID
   */
  delete: async ({ params }) => {
    try {
      const id = await ordersService.delete(params.id);

      return {
        status: 200 as const,
        body: {
          success: true,
          id,
        },
      };
    } catch (error) {
      if (error instanceof OrderNotFoundError) {
        return {
          status: 404 as const,
          body: {
            error: error.message,
          },
        };
      }

      logger.error({ error, orderId: params.id }, 'Unexpected error in delete order route');
      return {
        status: 500 as const,
        body: {
          error: 'Internal server error',
        },
      };
    }
  },

  /**
   * Get an order by order number
   */
  getByOrderNumber: async ({ request, params }) => {
    try {
      if (!request.user) {
        return {
          status: 401 as const,
          body: {
            error: 'Authentication required',
          },
        };
      }

      const order = await ordersService.getByOrderNumber(params.orderNumber, request.user.id);

      return {
        status: 200 as const,
        body: order,
      };
    } catch (error) {
      if (error instanceof OrderNotFoundError) {
        return {
          status: 404 as const,
          body: {
            error: error.message,
          },
        };
      }

      logger.error(
        { error, orderNumber: params.orderNumber },
        'Unexpected error in get order by number route'
      );
      return {
        status: 500 as const,
        body: {
          error: 'Internal server error',
        },
      };
    }
  },
});

/**
 * Register orders routes with Fastify
 * @param fastify Fastify instance
 */
export function registerOrdersRoutes(fastify: FastifyInstance) {
  return s.registerRouter(ordersContract, router, fastify, {
    logInitialization: true,
  });
}
