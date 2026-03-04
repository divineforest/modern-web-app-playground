import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '../../../db/index.js';
import { db, orderItems, orders } from '../../../db/index.js';
import type { OrderItem } from '../../../db/schema.js';

/**
 * Find cart (order with status='cart') by user ID
 * @param userId User ID
 * @param database Database instance
 * @returns Cart order or null if not found
 */
export async function findCartByUserId(userId: string, database: Database = db) {
  const results = await database
    .select()
    .from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.status, 'cart')))
    .limit(1);

  return results[0] || null;
}

/**
 * Find cart (order with status='cart') by cart token
 * @param cartToken Cart token
 * @param database Database instance
 * @returns Cart order or null if not found
 */
export async function findCartByToken(cartToken: string, database: Database = db) {
  const results = await database
    .select()
    .from(orders)
    .where(and(eq(orders.cartToken, cartToken), eq(orders.status, 'cart')))
    .limit(1);

  return results[0] || null;
}

/**
 * Create a new cart order
 * @param data Cart order data
 * @param database Database instance
 * @returns Created cart order
 */
export async function createCartOrder(
  data: {
    userId?: string | null;
    cartToken?: string | null;
    currency: string;
    orderNumber: string;
    orderDate: string;
  },
  database: Database = db
) {
  const results = await database
    .insert(orders)
    .values({
      status: 'cart',
      userId: data.userId || null,
      cartToken: data.cartToken || null,
      currency: data.currency,
      orderNumber: data.orderNumber,
      orderDate: data.orderDate,
      subtotal: '0.00',
      totalAmount: '0.00',
      taxAmount: '0.00',
      discountAmount: '0.00',
      shippingAmount: '0.00',
    })
    .returning();

  if (!results[0]) {
    throw new Error('Failed to create cart order');
  }

  return results[0];
}

/**
 * Find all items in a cart
 * @param orderId Order ID
 * @param database Database instance
 * @returns Array of order items
 */
export async function findCartItems(
  orderId: string,
  database: Database = db
): Promise<OrderItem[]> {
  const results = await database.select().from(orderItems).where(eq(orderItems.orderId, orderId));

  return results as OrderItem[];
}

/**
 * Upsert a cart item (insert or update quantity if product already in cart)
 * @param orderId Order ID
 * @param item Item data
 * @param database Database instance
 * @returns Upserted order item
 */
export async function upsertCartItem(
  orderId: string,
  item: {
    productId: string;
    quantity: number;
    unitPrice: string;
    currency: string;
    productName: string;
    productSku: string;
    productImageUrl: string | null;
  },
  database: Database = db
): Promise<OrderItem> {
  const results = await database
    .insert(orderItems)
    .values({
      orderId,
      productId: item.productId,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice,
      currency: item.currency,
      productName: item.productName,
      productSku: item.productSku,
      productImageUrl: item.productImageUrl,
    })
    .onConflictDoUpdate({
      target: [orderItems.orderId, orderItems.productId],
      set: {
        quantity: sql`${orderItems.quantity}::numeric + ${item.quantity}`,
        updatedAt: sql`now()`,
      },
    })
    .returning();

  if (!results[0]) {
    throw new Error('Failed to upsert cart item');
  }

  return results[0];
}

/**
 * Update cart item quantity
 * @param itemId Item ID
 * @param orderId Order ID (for security check)
 * @param quantity New quantity
 * @param database Database instance
 * @returns Updated order item or null if not found
 */
export async function updateCartItemQuantity(
  itemId: string,
  orderId: string,
  quantity: number,
  database: Database = db
): Promise<OrderItem | null> {
  const results = await database
    .update(orderItems)
    .set({
      quantity: quantity.toString(),
      updatedAt: sql`now()`,
    })
    .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId)))
    .returning();

  return results[0] || null;
}

/**
 * Delete a single cart item
 * @param itemId Item ID
 * @param orderId Order ID (for security check)
 * @param database Database instance
 * @returns Deleted order item or null if not found
 */
export async function deleteCartItem(
  itemId: string,
  orderId: string,
  database: Database = db
): Promise<OrderItem | null> {
  const results = await database
    .delete(orderItems)
    .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId)))
    .returning();

  return results[0] || null;
}

/**
 * Delete all items in a cart
 * @param orderId Order ID
 * @param database Database instance
 * @returns Number of deleted items
 */
export async function deleteAllCartItems(
  orderId: string,
  database: Database = db
): Promise<number> {
  const results = await database
    .delete(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .returning();

  return results.length;
}

/**
 * Delete cart order
 * @param orderId Order ID
 * @param database Database instance
 */
export async function deleteCartOrder(orderId: string, database: Database = db): Promise<void> {
  await database.delete(orders).where(eq(orders.id, orderId));
}

/**
 * Update cart totals based on items
 * @param orderId Order ID
 * @param database Database instance
 */
export async function updateCartTotals(orderId: string, database: Database = db): Promise<void> {
  const items = await findCartItems(orderId, database);

  const subtotal = items.reduce((sum, item) => {
    const lineTotal = Number.parseFloat(item.unitPrice) * Number.parseFloat(item.quantity);
    return sum + lineTotal;
  }, 0);

  await database
    .update(orders)
    .set({
      subtotal: subtotal.toFixed(2),
      totalAmount: subtotal.toFixed(2),
      updatedAt: sql`now()`,
    })
    .where(eq(orders.id, orderId));
}

/**
 * Reassign guest cart to authenticated user
 * @param orderId Order ID
 * @param userId User ID
 * @param database Database instance
 */
export async function reassignGuestCart(
  orderId: string,
  userId: string,
  database: Database = db
): Promise<void> {
  await database
    .update(orders)
    .set({
      userId,
      cartToken: null,
      updatedAt: sql`now()`,
    })
    .where(eq(orders.id, orderId));
}

/**
 * Move items from one cart to another (for merging)
 * @param fromOrderId Source order ID
 * @param toOrderId Destination order ID
 * @param database Database instance
 */
export async function moveItemsToUserCart(
  fromOrderId: string,
  toOrderId: string,
  database: Database = db
): Promise<void> {
  await database
    .update(orderItems)
    .set({
      orderId: toOrderId,
      updatedAt: sql`now()`,
    })
    .where(eq(orderItems.orderId, fromOrderId));
}
