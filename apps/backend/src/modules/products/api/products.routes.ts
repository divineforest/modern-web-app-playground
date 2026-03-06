import { productsContract } from '@mercado/api-contracts';
import { initServer } from '@ts-rest/fastify';
import type { FastifyInstance } from 'fastify';
import { createModuleLogger } from '../../../lib/logger.js';

const logger = createModuleLogger('products');
import {
  ProductNotFoundError,
  productsService,
  type SearchProductsQuery,
} from '../services/products.service.js';

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

  /**
   * Get a product by slug
   */
  getBySlug: async ({ params }) => {
    try {
      const product = await productsService.getBySlug(params.slug);

      return {
        status: 200 as const,
        body: product,
      };
    } catch (error) {
      if (error instanceof ProductNotFoundError) {
        return {
          status: 404 as const,
          body: {
            error: error.message,
          },
        };
      }

      logger.error({ error, slug: params.slug }, 'Unexpected error in get product by slug route');
      return {
        status: 500 as const,
        body: {
          error: 'Internal server error',
        },
      };
    }
  },

  /**
   * Search products
   */
  search: async ({ query }) => {
    try {
      const result = await productsService.search(query as SearchProductsQuery);

      return {
        status: 200 as const,
        body: result,
      };
    } catch (error) {
      logger.error({ error, query }, 'Unexpected error in search products route');
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
