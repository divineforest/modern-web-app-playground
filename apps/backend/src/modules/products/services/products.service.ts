import type { Database } from '../../../db/index.js';
import { db } from '../../../db/index.js';
import { logger } from '../../../lib/logger.js';
import type { Product } from '../domain/product.entity.js';
import type { ListProductsQuery, PaginationResult } from '../domain/product.types.js';
import {
  countProducts,
  findAllProducts,
  type ProductFilters,
} from '../repositories/products.repository.js';

export interface ListProductsResult {
  products: Omit<Product, 'costPrice'>[];
  pagination: PaginationResult;
}

/**
 * List products with optional filtering and pagination
 * @param query Query parameters for filtering and pagination
 * @param database Database instance (for dependency injection)
 * @returns Paginated products with costPrice excluded and pagination metadata
 */
export async function listProductsService(
  query: ListProductsQuery = { page: 1, limit: 20 },
  database: Database = db
): Promise<ListProductsResult> {
  const { status, category, page = 1, limit = 20 } = query;

  const filters: ProductFilters = {};
  if (status) filters.status = status;
  if (category) filters.category = category;

  const offset = (page - 1) * limit;

  const [productRows, total] = await Promise.all([
    findAllProducts(filters, { limit, offset }, database),
    countProducts(filters, database),
  ]);

  const totalPages = Math.ceil(total / limit);

  logger.info({ count: productRows.length, total, page, limit, filters }, 'Listed products');

  // Exclude costPrice from public response
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const products = productRows.map(({ costPrice, ...product }) => product);

  return {
    products,
    pagination: { total, page, limit, totalPages },
  };
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
