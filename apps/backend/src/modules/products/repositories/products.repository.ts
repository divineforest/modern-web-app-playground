import { and, count, desc, eq, sql, type SQL } from 'drizzle-orm';
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

/**
 * Search options for full-text product search
 */
export interface SearchOptions {
  query: string;
  sort: 'relevance' | 'price_asc' | 'price_desc';
  limit: number;
  offset: number;
}

/**
 * Search products using PostgreSQL full-text search
 * @param options Search options (query, sort, limit, offset)
 * @param database Database instance (for dependency injection)
 * @returns Array of matching products (active status only)
 */
export async function searchProducts(
  options: SearchOptions,
  database: Database = db
): Promise<Product[]> {
  const { query, sort, limit, offset } = options;

  const searchQuery = sql`phraseto_tsquery('english', ${query})`;
  const searchCondition = sql`${products.searchVector} @@ ${searchQuery}`;

  let orderBy: SQL;
  if (sort === 'relevance') {
    orderBy = sql`ts_rank(${products.searchVector}, ${searchQuery}) DESC`;
  } else if (sort === 'price_asc') {
    orderBy = sql`${products.currency} ASC, ${products.price} ASC, ${products.name} ASC`;
  } else {
    orderBy = sql`${products.currency} ASC, ${products.price} DESC, ${products.name} ASC`;
  }

  const results = await database
    .select()
    .from(products)
    .where(and(eq(products.status, 'active'), searchCondition))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return results as Product[];
}

/**
 * Count products matching the search query
 * @param query Search query string
 * @param database Database instance (for dependency injection)
 * @returns Total number of matching products (active status only)
 */
export async function countSearchResults(query: string, database: Database = db): Promise<number> {
  const searchQuery = sql`phraseto_tsquery('english', ${query})`;
  const searchCondition = sql`${products.searchVector} @@ ${searchQuery}`;

  const [result] = await database
    .select({ count: count() })
    .from(products)
    .where(and(eq(products.status, 'active'), searchCondition));

  return result?.count ?? 0;
}
