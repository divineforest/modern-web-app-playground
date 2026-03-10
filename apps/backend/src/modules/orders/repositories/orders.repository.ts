import { and, desc, eq, ne, type SQL } from 'drizzle-orm';
import type { Database } from '../../../db/index.js';
import { db, orderItems, orders } from '../../../db/index.js';
import type { OrderItem } from '../../../db/schema.js';
import type { NewOrder, Order, UpdateOrder } from '../domain/order.entity.js';

/**
 * Filter options for listing orders
 */
export interface OrderFilters {
  status?: string;
}

/**
 * Create a new order
 * @param data Order data to insert
 * @param database Database instance (for dependency injection)
 * @returns Created order
 */
export async function createOrder(data: NewOrder, database: Database = db): Promise<Order> {
  const results = await database.insert(orders).values(data).returning();

  if (!results[0]) {
    throw new Error('Failed to create order');
  }

  // Type assertion needed: Drizzle returns status as string, but we use typed enum
  return results[0] as Order;
}

/**
 * Find an order by ID
 * @param id Order ID
 * @param database Database instance (for dependency injection)
 * @returns Order or null if not found
 */
export async function findOrderById(id: string, database: Database = db): Promise<Order | null> {
  const results = await database.select().from(orders).where(eq(orders.id, id));

  // Type assertion needed: Drizzle returns status as string, but we use typed enum
  return (results[0] as Order | undefined) || null;
}

function buildOrderFilterConditions(filters?: OrderFilters): SQL[] {
  const conditions: SQL[] = [];

  if (filters?.status) {
    conditions.push(eq(orders.status, filters.status));
  }

  return conditions;
}

/**
 * Find all orders with optional filtering
 * @param filters Optional filters (status)
 * @param database Database instance (for dependency injection)
 * @returns Array of orders ordered by order date (newest first)
 */
export async function findAllOrders(
  filters?: OrderFilters,
  database: Database = db
): Promise<Order[]> {
  const conditions = buildOrderFilterConditions(filters);

  // Build query with conditions
  const baseQuery = database.select().from(orders);
  const query = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

  // Order by order date (newest first)
  const results = await query.orderBy(desc(orders.orderDate));

  // Type assertion needed: Drizzle returns status as string, but we use typed enum
  return results as Order[];
}

/**
 * Update an order by ID
 * @param id Order ID
 * @param data Partial order data to update
 * @param database Database instance (for dependency injection)
 * @returns Updated order or null if not found
 */
export async function updateOrder(
  id: string,
  data: UpdateOrder,
  database: Database = db
): Promise<Order | null> {
  // Update the updatedAt timestamp
  const updateData = {
    ...data,
    updatedAt: new Date(),
  };

  const results = await database
    .update(orders)
    .set(updateData)
    .where(eq(orders.id, id))
    .returning();

  // Type assertion needed: Drizzle returns status as string, but we use typed enum
  return (results[0] as Order | undefined) || null;
}

/**
 * Delete an order by ID (hard delete)
 * @param id Order ID
 * @param database Database instance (for dependency injection)
 * @returns true if deleted, false if not found
 */
export async function deleteOrder(id: string, database: Database = db): Promise<boolean> {
  const result = await database.delete(orders).where(eq(orders.id, id)).returning();

  return result.length > 0;
}

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
 * Find all items for an order
 * @param orderId Order ID
 * @param database Database instance (for dependency injection)
 * @returns Array of order items
 */
export async function findOrderItems(
  orderId: string,
  database: Database = db
): Promise<OrderItem[]> {
  const results = await database.select().from(orderItems).where(eq(orderItems.orderId, orderId));

  return results;
}

/**
 * Find all orders for a specific user
 * @param userId User ID
 * @param database Database instance (for dependency injection)
 * @returns Array of orders for the user, excluding cart status, ordered by date (newest first)
 */
export async function findOrdersByUserId(
  userId: string,
  database: Database = db
): Promise<Order[]> {
  const results = await database
    .select()
    .from(orders)
    .where(and(eq(orders.userId, userId), ne(orders.status, 'cart')))
    .orderBy(desc(orders.orderDate));

  return results as Order[];
}
