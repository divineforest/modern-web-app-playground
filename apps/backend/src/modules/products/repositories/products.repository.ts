import { and, desc, eq, type SQL } from 'drizzle-orm';
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
 * Find all products with optional filtering
 * @param filters Optional filters (status, category)
 * @param database Database instance (for dependency injection)
 * @returns Array of products ordered by creation date (newest first)
 */
export async function findAllProducts(
  filters?: ProductFilters,
  database: Database = db
): Promise<Product[]> {
  const conditions = buildProductFilterConditions(filters);

  const baseQuery = database.select().from(products);
  const query = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

  const results = await query.orderBy(desc(products.createdAt));

  return results as Product[];
}
