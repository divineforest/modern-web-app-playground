import { and, count, desc, eq, type SQL } from 'drizzle-orm';
import type { Database } from '../../../db/index.js';
import { db, products } from '../../../db/index.js';
import type { Product } from '../domain/product.entity.js';

/**
 * Filter options for listing products
 */
export interface ProductFilters {
  status?: string;
  category?: string;
}

/**
 * Pagination options for listing products
 */
export interface ProductPagination {
  limit: number;
  offset: number;
}

function buildProductFilterConditions(filters?: ProductFilters): SQL[] {
  const conditions: SQL[] = [];

  if (filters?.status) {
    conditions.push(eq(products.status, filters.status));
  }

  if (filters?.category) {
    conditions.push(eq(products.category, filters.category));
  }

  return conditions;
}

/**
 * Count products matching the given filters
 * @param filters Optional filters (status, category)
 * @param database Database instance (for dependency injection)
 * @returns Total number of matching products
 */
export async function countProducts(
  filters?: ProductFilters,
  database: Database = db
): Promise<number> {
  const conditions = buildProductFilterConditions(filters);

  const baseQuery = database.select({ count: count() }).from(products);
  const query = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

  const [result] = await query;
  return result?.count ?? 0;
}

/**
 * Find products with optional filtering and pagination
 * @param filters Optional filters (status, category)
 * @param pagination Optional pagination (limit, offset)
 * @param database Database instance (for dependency injection)
 * @returns Array of products ordered by creation date (newest first)
 */
export async function findAllProducts(
  filters?: ProductFilters,
  pagination?: ProductPagination,
  database: Database = db
): Promise<Product[]> {
  const conditions = buildProductFilterConditions(filters);

  const baseQuery = database.select().from(products);
  const filteredQuery = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;
  const orderedQuery = filteredQuery.orderBy(desc(products.createdAt));
  const paginatedQuery = pagination
    ? orderedQuery.limit(pagination.limit).offset(pagination.offset)
    : orderedQuery;

  const results = await paginatedQuery;

  return results as Product[];
}

/**
 * Find a product by slug
 * @param slug Product slug
 * @param database Database instance (for dependency injection)
 * @returns Product or null if not found
 */
export async function findProductBySlug(
  slug: string,
  database: Database = db
): Promise<Product | null> {
  const results = await database.select().from(products).where(eq(products.slug, slug));
  return (results[0] as Product | undefined) || null;
}

/**
 * Find a product by ID
 * @param id Product ID
 * @param database Database instance (for dependency injection)
 * @returns Product or null if not found
 */
export async function findProductById(
  id: string,
  database: Database = db
): Promise<Product | null> {
  const results = await database.select().from(products).where(eq(products.id, id));
  return (results[0] as Product | undefined) || null;
}
