import type { Database } from '../../src/db/index.js';
import { db, orderItems } from '../../src/db/index.js';
import type { NewOrderItem, OrderItem } from '../../src/db/schema.js';

/**
 * Build test order item data with default values that can be overridden
 */
export function buildTestOrderItemData(overrides: Partial<NewOrderItem> = {}): NewOrderItem {
  if (!overrides.orderId) {
    throw new Error('orderId is required for order items');
  }

  if (!overrides.productId) {
    throw new Error('productId is required for order items');
  }

  return {
    orderId: overrides.orderId,
    productId: overrides.productId,
    quantity: overrides.quantity || '1',
    unitPrice: overrides.unitPrice || '10.00',
    currency: overrides.currency || 'EUR',
    productName: overrides.productName || 'Test Product',
    productSku: overrides.productSku || `SKU-${Date.now()}`,
    productImageUrl: overrides.productImageUrl !== undefined ? overrides.productImageUrl : null,
  };
}

/**
 * Create a test order item record in the database
 */
export async function createTestOrderItem(
  overrides: Partial<NewOrderItem> = {},
  database: Database = db
): Promise<OrderItem> {
  const itemData = buildTestOrderItemData(overrides);
  const results = await database.insert(orderItems).values(itemData).returning();

  if (!results[0]) {
    throw new Error('Failed to create test order item');
  }

  return results[0];
}

/**
 * Create multiple test order item records in the database
 */
export async function createTestOrderItems(
  count: number,
  overrides: Partial<NewOrderItem> = {},
  database: Database = db
): Promise<OrderItem[]> {
  const result: OrderItem[] = [];

  for (let index = 0; index < count; index++) {
    const itemData = buildTestOrderItemData({
      ...overrides,
      productSku: `SKU-${Date.now()}-${index}`,
    });
    const results = await database.insert(orderItems).values(itemData).returning();

    if (!results[0]) {
      throw new Error(`Failed to create test order item ${index + 1}`);
    }

    result.push(results[0]);
  }

  return result;
}
