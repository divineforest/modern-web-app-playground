import { eq } from 'drizzle-orm';
import type { Database } from '../../../db/index.js';
import { db, orders } from '../../../db/index.js';
import type { Order } from '../../orders/domain/order.entity.js';

/**
 * Find an order by order number
 * @param orderNumber Order number to search for
 * @param database Database instance (for dependency injection)
 * @returns Order or null if not found
 */
export async function findOrderByOrderNumber(
  orderNumber: string,
  database: Database = db
): Promise<Order | null> {
  const results = await database.select().from(orders).where(eq(orders.orderNumber, orderNumber));

  return (results[0] as Order | undefined) || null;
}

/**
 * Mark an order as paid
 * @param id Order ID
 * @param paymentTransactionId Payment provider transaction ID
 * @param database Database instance (for dependency injection)
 * @returns Updated order or null if not found
 */
export async function markOrderAsPaid(
  id: string,
  paymentTransactionId: string,
  database: Database = db
): Promise<Order | null> {
  const results = await database
    .update(orders)
    .set({
      status: 'paid',
      paidAt: new Date(),
      paymentTransactionId,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, id))
    .returning();

  return (results[0] as Order | undefined) || null;
}
