import type { Database } from '../../../db/index.js';
import { db } from '../../../db/index.js';
import { logger } from '../../../lib/logger.js';
import type { Product } from '../domain/product.entity.js';
import type { ListProductsQuery, PaginationResult } from '../domain/product.types.js';
import {
  countProducts,
  countSearchResults,
  findAllProducts,
  findProductBySlug,
  type ProductFilters,
  searchProducts,
} from '../repositories/products.repository.js';

/**
 * Custom error for product not found
 */
export class ProductNotFoundError extends Error {
  constructor(slug: string) {
    super(`Product with slug ${slug} not found`);
    this.name = 'ProductNotFoundError';
  }
}

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
 * Get a product by slug
 * @param slug Product slug
 * @param database Database instance (for dependency injection)
 * @returns Product with costPrice excluded
 * @throws ProductNotFoundError if product not found
 */
export async function getBySlugService(
  slug: string,
  database: Database = db
): Promise<Omit<Product, 'costPrice'>> {
  const product = await findProductBySlug(slug, database);

  if (!product) {
    throw new ProductNotFoundError(slug);
  }

  logger.info({ slug, productId: product.id }, 'Retrieved product by slug');

  // Exclude costPrice from public response
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { costPrice, ...productWithoutCost } = product;
  return productWithoutCost;
}

/**
 * Search products query parameters
 */
export interface SearchProductsQuery {
  q: string;
  sort: 'relevance' | 'price_asc' | 'price_desc';
  page: number;
  limit: number;
}

/**
 * Search products using full-text search
 * @param query Search query parameters
 * @param database Database instance (for dependency injection)
 * @returns Paginated search results with costPrice excluded and pagination metadata
 */
export async function searchProductsService(
  query: SearchProductsQuery,
  database: Database = db
): Promise<ListProductsResult> {
  const { q, sort, page = 1, limit = 20 } = query;
  const offset = (page - 1) * limit;

  const [productRows, total] = await Promise.all([
    searchProducts({ query: q, sort, limit, offset }, database),
    countSearchResults(q, database),
  ]);

  const totalPages = Math.ceil(total / limit);

  logger.info({ count: productRows.length, total, page, limit, query: q }, 'Searched products');

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
    getBySlug: (slug: string) => getBySlugService(slug, database),
    search: (query: SearchProductsQuery) => searchProductsService(query, database),
  };
}

// Export a default service instance using the default database
export const productsService = createProductsService();
