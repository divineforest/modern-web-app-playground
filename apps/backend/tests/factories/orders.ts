import type { Database } from '../../src/db/index.js';
import { db, orders } from '../../src/db/index.js';
import type { NewOrder, Order } from '../../src/modules/orders/domain/order.entity.js';

/**
 * Build test order data with default values that can be overridden
 */
export function buildTestOrderData(overrides: Partial<NewOrder> = {}): NewOrder {
  const now = new Date();
  const orderNumber =
    overrides.orderNumber || `ORD-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`;

  return {
    status: overrides.status || 'draft',
    orderNumber,
    referenceNumber: overrides.referenceNumber !== undefined ? overrides.referenceNumber : null,
    orderDate: overrides.orderDate || now.toISOString().split('T')[0] || '2024-01-01',
    expectedDeliveryDate:
      overrides.expectedDeliveryDate !== undefined ? overrides.expectedDeliveryDate : null,
    currency: overrides.currency || 'EUR',
    subtotal: overrides.subtotal || '1000.00',
    taxAmount: overrides.taxAmount || '0.00',
    discountAmount: overrides.discountAmount || '0.00',
    shippingAmount: overrides.shippingAmount || '0.00',
    totalAmount: overrides.totalAmount || '1000.00',
    shippingAddress: overrides.shippingAddress !== undefined ? overrides.shippingAddress : null,
    billingAddress: overrides.billingAddress !== undefined ? overrides.billingAddress : null,
    paymentTerms: overrides.paymentTerms !== undefined ? overrides.paymentTerms : null,
    notes: overrides.notes !== undefined ? overrides.notes : null,
    customerNotes: overrides.customerNotes !== undefined ? overrides.customerNotes : null,
    paidAt: overrides.paidAt !== undefined ? overrides.paidAt : null,
    paymentTransactionId:
      overrides.paymentTransactionId !== undefined ? overrides.paymentTransactionId : null,
    userId: overrides.userId !== undefined ? overrides.userId : null,
    cartToken: overrides.cartToken !== undefined ? overrides.cartToken : null,
  };
}

/**
 * Create a test order record in the database with default values that can be overridden
 */
export async function createTestOrder(
  overrides: Partial<NewOrder> = {},
  database: Database = db
): Promise<Order> {
  const orderData = buildTestOrderData(overrides);
  const results = await database.insert(orders).values(orderData).returning();

  if (!results[0]) {
    throw new Error('Failed to create test order');
  }

  // Type assertion needed: Drizzle returns status as string, but we use typed enum
  return results[0] as Order;
}

/**
 * Create multiple test order records in the database
 */
export async function createTestOrders(
  count: number,
  overrides: Partial<NewOrder> = {},
  database: Database = db
): Promise<Order[]> {
  const result: Order[] = [];

  for (let index = 0; index < count; index++) {
    const orderData = buildTestOrderData({
      orderNumber: `ORD-TEST-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${index}`,
      ...overrides,
    });
    const results = await database.insert(orders).values(orderData).returning();

    if (!results[0]) {
      throw new Error(`Failed to create test order ${index + 1}`);
    }

    // Type assertion needed: Drizzle returns status as string, but we use typed enum
    result.push(results[0] as Order);
  }

  return result;
}
