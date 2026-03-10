import type { Database } from '../../src/db/index.js';
import { db, products } from '../../src/db/index.js';
import type { NewProduct, Product } from '../../src/modules/products/domain/product.entity.js';

/**
 * Build test product data with default values that can be overridden
 */
export function buildTestProductData(overrides: Partial<NewProduct> = {}): NewProduct {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const name = overrides.name ?? `Test Product ${suffix}`;
  const slug = overrides.slug ?? `test-product-${suffix}`;
  const sku = overrides.sku ?? `SKU-${suffix}`;

  return {
    status: overrides.status ?? 'draft',
    name,
    slug,
    sku,
    description: overrides.description !== undefined ? overrides.description : null,
    shortDescription: overrides.shortDescription !== undefined ? overrides.shortDescription : null,
    category: overrides.category !== undefined ? overrides.category : null,
    tags: overrides.tags !== undefined ? overrides.tags : null,
    imageUrl: overrides.imageUrl !== undefined ? overrides.imageUrl : null,
    currency: overrides.currency ?? 'EUR',
    price: overrides.price ?? '10.00',
    compareAtPrice: overrides.compareAtPrice !== undefined ? overrides.compareAtPrice : null,
    costPrice: overrides.costPrice !== undefined ? overrides.costPrice : null,
    weight: overrides.weight !== undefined ? overrides.weight : null,
    width: overrides.width !== undefined ? overrides.width : null,
    height: overrides.height !== undefined ? overrides.height : null,
    length: overrides.length !== undefined ? overrides.length : null,
  };
}

/**
 * Create a test product record in the database with default values that can be overridden
 */
export async function createTestProduct(
  overrides: Partial<NewProduct> = {},
  database: Database = db
): Promise<Product> {
  const productData = buildTestProductData(overrides);
  const results = await database.insert(products).values(productData).returning();

  if (!results[0]) {
    throw new Error('Failed to create test product');
  }

  return results[0] as Product;
}

/**
 * Create multiple test product records in the database
 */
export async function createTestProducts(
  count: number,
  overrides: Partial<NewProduct> = {},
  database: Database = db
): Promise<Product[]> {
  const result: Product[] = [];

  for (let index = 0; index < count; index++) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${index}`;
    const productData = buildTestProductData({
      name: `Test Product ${suffix}`,
      slug: `test-product-${suffix}`,
      sku: `SKU-${suffix}`,
      ...overrides,
    });
    const results = await database.insert(products).values(productData).returning();

    if (!results[0]) {
      throw new Error(`Failed to create test product ${index + 1}`);
    }

    result.push(results[0] as Product);
  }

  return result;
}
