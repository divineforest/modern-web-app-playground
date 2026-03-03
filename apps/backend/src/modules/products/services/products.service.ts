import type { Database } from '../../../db/index.js';
import { db } from '../../../db/index.js';
import { logger } from '../../../lib/logger.js';
import type { Product } from '../domain/product.entity.js';
import type { ListProductsQuery } from '../domain/product.types.js';
import { findAllProducts } from '../repositories/products.repository.js';

/**
 * List all products with optional filtering
 * @param query Query parameters for filtering
 * @param database Database instance (for dependency injection)
 * @returns Array of products with costPrice excluded
 */
export async function listProductsService(
  query: ListProductsQuery = {},
  database: Database = db
): Promise<Omit<Product, 'costPrice'>[]> {
  const filters: {
    status?: string;
    category?: string;
  } = {};

  if (query.status) filters.status = query.status;
  if (query.category) filters.category = query.category;

  const products = await findAllProducts(filters, database);

  logger.info({ count: products.length, filters }, 'Listed products');

  // Exclude costPrice from public response
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return products.map(({ costPrice, ...product }) => product);
}

/**
 * Products service factory function for dependency injection
 * Returns an object with all product operations bound to a specific database
 */
function createProductsService(database: Database = db) {
  return {
    list: (query?: ListProductsQuery) => listProductsService(query, database),
  };
}

// Export a default service instance using the default database
export const productsService = createProductsService();
