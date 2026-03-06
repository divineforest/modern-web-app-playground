import type { Database } from '../../../db/index.js';
import { db } from '../../../db/index.js';
import {
  transformDatabaseError,
  ValidationError,
  type ValidationErrorDetails,
} from '../../../lib/error-transformers.js';
import { createModuleLogger } from '../../../lib/logger.js';

const logger = createModuleLogger('orders');
import type { Order, UpdateOrder } from '../domain/order.entity.js';
import type {
  CreateOrderInput,
  CreateOrderOutput,
  ListOrdersQuery,
  UpdateOrderInput,
  UpdateOrderOutput,
} from '../domain/order.types.js';
import { createOrderSchema, updateOrderSchema } from '../domain/order.types.js';
import {
  createOrder,
  deleteOrder,
  findAllOrders,
  findOrderById,
  findOrderByOrderNumber,
  findOrderItems,
  findOrdersByUserId,
  updateOrder,
} from '../repositories/orders.repository.js';

/**
 * Custom error for order not found
 */
export class OrderNotFoundError extends Error {
  constructor(id: string) {
    super(`Order with ID ${id} not found`);
    this.name = 'OrderNotFoundError';
  }
}

/**
 * Custom error for validation failures
 */
export class OrderValidationError extends ValidationError {
  constructor(message: string, details?: ValidationErrorDetails) {
    super(message, details);
    this.name = 'OrderValidationError';
  }
}

/**
 * Create a new order with validation
 * @param input Order input data (already validated by ts-rest, or raw input for direct calls)
 * @param database Database instance (for dependency injection)
 * @returns Created order
 * @throws OrderValidationError if validation fails
 */
export async function createOrderService(
  input: CreateOrderInput | CreateOrderOutput,
  database: Database = db
): Promise<Order> {
  try {
    // Validate/transform input - handles both raw input (number) and pre-parsed (string)
    const validatedData: CreateOrderOutput = createOrderSchema.parse(input);

    // Create the order - CreateOrderOutput is compatible with NewOrder
    const order = await createOrder(validatedData, database);

    logger.info({ orderId: order.id }, 'Order created successfully');

    return order;
  } catch (error) {
    // Re-throw existing validation errors
    if (error instanceof OrderValidationError) {
      throw error;
    }

    // Handle Zod validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      logger.warn({ error, input }, 'Order validation failed');
      throw new OrderValidationError('Validation failed', { zodError: error.message });
    }

    // Transform database errors to validation errors
    const dbError = transformDatabaseError(error);
    if (dbError) {
      logger.warn({ error, input }, 'Database constraint violation');
      throw new OrderValidationError(dbError.message, dbError.details);
    }

    // Log and re-throw unexpected errors
    logger.error({ error, input }, 'Failed to create order');
    throw error;
  }
}

/**
 * Get an order by ID
 * @param id Order ID
 * @param database Database instance (for dependency injection)
 * @returns Order
 * @throws OrderNotFoundError if not found
 */
export async function getOrderByIdService(id: string, database: Database = db): Promise<Order> {
  const order = await findOrderById(id, database);

  if (!order) {
    logger.warn({ orderId: id }, 'Order not found');
    throw new OrderNotFoundError(id);
  }

  return order;
}

/**
 * List all orders with optional filtering
 * @param query Query parameters for filtering
 * @param database Database instance (for dependency injection)
 * @returns Array of orders
 */
export async function listOrdersService(
  query: ListOrdersQuery = {},
  database: Database = db
): Promise<Order[]> {
  const filters: {
    status?: string;
  } = {};

  if (query.status) filters.status = query.status;

  const orders = await findAllOrders(filters, database);

  logger.info({ count: orders.length, filters }, 'Listed orders');

  return orders;
}

/**
 * Update an order by ID
 * @param id Order ID
 * @param input Partial order data to update (already validated by ts-rest, or raw input for direct calls)
 * @param database Database instance (for dependency injection)
 * @returns Updated order
 * @throws OrderNotFoundError if not found
 * @throws OrderValidationError if validation fails
 */
export async function updateOrderService(
  id: string,
  input: UpdateOrderInput | UpdateOrderOutput,
  database: Database = db
): Promise<Order> {
  try {
    // Validate/transform input - handles both raw input (number) and pre-parsed (string)
    const validatedData: UpdateOrderOutput = updateOrderSchema.parse(input);

    // Update the order
    const order = await updateOrder(id, validatedData as UpdateOrder, database);

    if (!order) {
      logger.warn({ orderId: id }, 'Order not found for update');
      throw new OrderNotFoundError(id);
    }

    logger.info({ orderId: id }, 'Order updated successfully');

    return order;
  } catch (error) {
    // Re-throw existing domain errors
    if (error instanceof OrderNotFoundError || error instanceof OrderValidationError) {
      throw error;
    }

    // Handle Zod validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      logger.warn({ error, id, input }, 'Order update validation failed');
      throw new OrderValidationError('Validation failed', { zodError: error.message });
    }

    // Transform database errors to validation errors
    const dbError = transformDatabaseError(error);
    if (dbError) {
      logger.warn({ error, id, input }, 'Database constraint violation');
      throw new OrderValidationError(dbError.message, dbError.details);
    }

    // Log and re-throw unexpected errors
    logger.error({ error, id, input }, 'Failed to update order');
    throw error;
  }
}

/**
 * Delete an order by ID
 * @param id Order ID
 * @param database Database instance (for dependency injection)
 * @returns Deleted order ID
 * @throws OrderNotFoundError if not found
 */
export async function deleteOrderService(id: string, database: Database = db): Promise<string> {
  const deleted = await deleteOrder(id, database);

  if (!deleted) {
    logger.warn({ orderId: id }, 'Order not found for deletion');
    throw new OrderNotFoundError(id);
  }

  logger.info({ orderId: id }, 'Order deleted successfully');

  return id;
}

/**
 * Get an order by order number with items
 * @param orderNumber Order number
 * @param userId User ID to verify ownership
 * @param database Database instance (for dependency injection)
 * @returns Order with items
 * @throws OrderNotFoundError if not found or user doesn't own the order
 */
export async function getOrderByOrderNumber(
  orderNumber: string,
  userId: string,
  database: Database = db
) {
  const order = await findOrderByOrderNumber(orderNumber, database);

  if (!order) {
    logger.warn({ orderNumber }, 'Order not found');
    throw new OrderNotFoundError(orderNumber);
  }

  if (order.userId !== userId) {
    logger.warn({ orderNumber, userId, orderUserId: order.userId }, 'Order ownership mismatch');
    throw new OrderNotFoundError(orderNumber);
  }

  const items = await findOrderItems(order.id, database);

  const formattedItems = items.map((item) => ({
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    productSku: item.productSku,
    productImageUrl: item.productImageUrl,
    unitPrice: item.unitPrice,
    quantity: Math.floor(Number.parseFloat(item.quantity)),
    lineTotal: (Number.parseFloat(item.unitPrice) * Number.parseFloat(item.quantity)).toFixed(2),
    currency: item.currency,
  }));

  return {
    ...order,
    items: formattedItems,
  };
}

/**
 * List all orders for the authenticated user with items
 * @param userId User ID
 * @param database Database instance (for dependency injection)
 * @returns Array of orders with items
 */
export async function listMyOrdersService(userId: string, database: Database = db) {
  const orders = await findOrdersByUserId(userId, database);

  const ordersWithItems = await Promise.all(
    orders.map(async (order) => {
      const items = await findOrderItems(order.id, database);

      const formattedItems = items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        productImageUrl: item.productImageUrl,
        unitPrice: item.unitPrice,
        quantity: Math.floor(Number.parseFloat(item.quantity)),
        lineTotal: (Number.parseFloat(item.unitPrice) * Number.parseFloat(item.quantity)).toFixed(
          2
        ),
        currency: item.currency,
      }));

      return {
        ...order,
        items: formattedItems,
      };
    })
  );

  logger.info({ userId, count: ordersWithItems.length }, 'Listed user orders');

  return ordersWithItems;
}

/**
 * Orders service factory function for dependency injection
 * Returns an object with all order operations bound to a specific database
 */
function createOrdersService(database: Database = db) {
  return {
    create: (input: CreateOrderInput | CreateOrderOutput) => createOrderService(input, database),
    getById: (id: string) => getOrderByIdService(id, database),
    list: (query?: ListOrdersQuery) => listOrdersService(query, database),
    update: (id: string, input: UpdateOrderInput | UpdateOrderOutput) =>
      updateOrderService(id, input, database),
    delete: (id: string) => deleteOrderService(id, database),
    getByOrderNumber: (orderNumber: string, userId: string) =>
      getOrderByOrderNumber(orderNumber, userId, database),
    listMyOrders: (userId: string) => listMyOrdersService(userId, database),
  };
}

// Export a default service instance using the default database
export const ordersService = createOrdersService();
