import { initServer } from '@ts-rest/fastify';
import type { FastifyInstance } from 'fastify';
import { logger } from '../../../lib/logger.js';
import { productsService } from '../services/products.service.js';
import { productsContract } from './products.contracts.js';

/**
 * Initialize ts-rest server for type-safe route handling
 */
const s = initServer();

/**
 * Products route handlers
 */
const router = s.router(productsContract, {
  /**
   * List all products
   */
  list: async ({ query }) => {
    try {
      const result = await productsService.list(query);

      return {
        status: 200 as const,
        body: result,
      };
    } catch (error) {
      logger.error({ error, query }, 'Unexpected error in list products route');
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
 * Register products routes with Fastify
 * @param fastify Fastify instance
 */
export function registerProductsRoutes(fastify: FastifyInstance) {
  return s.registerRouter(productsContract, router, fastify, {
    logInitialization: true,
  });
}
