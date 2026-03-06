import { eq, like, sql } from 'drizzle-orm';
import type { Database } from '../../../db/index.js';
import { db, orders } from '../../../db/index.js';
import { createModuleLogger } from '../../../lib/logger.js';
import {
  findCartByToken,
  findCartItems,
  findOrderByUserId,
} from '../../cart/repositories/cart.repository.js';
import { findProductById } from '../../products/repositories/products.repository.js';
import type { Address, CheckoutRequest } from '../domain/checkout.types.js';

const logger = createModuleLogger('checkout');

export class CartNotFoundError extends Error {
  constructor(message = 'No active cart found') {
    super(message);
    this.name = 'CartNotFoundError';
  }
}

export class EmptyCartError extends Error {
  constructor(message = 'Cart is empty') {
    super(message);
    this.name = 'EmptyCartError';
  }
}

export class InactiveProductError extends Error {
  public readonly productNames: string[];

  constructor(productNames: string[]) {
    const formattedNames = productNames.join(', ');
    super(`The following items are no longer available: ${formattedNames}`);
    this.name = 'InactiveProductError';
    this.productNames = productNames;
  }
}

export class OrderNumberGenerationError extends Error {
  constructor(message = 'Unable to generate order number, please try again') {
    super(message);
    this.name = 'OrderNumberGenerationError';
  }
}

export class OrderNotCheckoutEligibleError extends Error {
  constructor(status: string) {
    super(`Order cannot be checked out (current status: ${status})`);
    this.name = 'OrderNotCheckoutEligibleError';
  }
}

async function generateOrderNumber(database: Database, retryAttempt = 0): Promise<string> {
  const today = new Date().toISOString().split('T')?.[0] || '';
  const formattedDate = today.replace(/-/g, '');
  const prefix = `ORD-${formattedDate}-`;

  const existingOrders = await database
    .select({ orderNumber: orders.orderNumber })
    .from(orders)
    .where(like(orders.orderNumber, `${prefix}%`));

  const sequenceNumber = existingOrders.length + 1 + retryAttempt;
  const paddedSequence = sequenceNumber.toString().padStart(5, '0');

  return `${prefix}${paddedSequence}`;
}

export async function checkout(
  userId: string,
  request: CheckoutRequest,
  cartToken?: string,
  database: Database = db
) {
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await database.transaction(async (tx) => {
        let cart = null;

        // Try to find cart by cart token first (for guest carts)
        if (cartToken) {
          cart = await findCartByToken(cartToken, tx as unknown as Database);
        }

        // If not found by token, try by user ID
        if (!cart) {
          cart = await findOrderByUserId(userId, tx as unknown as Database);
        }

        if (!cart) {
          throw new CartNotFoundError();
        }

        if (cart.status === 'confirmed') {
          const cartItems = await findCartItems(cart.id, tx as unknown as Database);
          const formattedItems = cartItems.map((item) => ({
            id: item.id,
            productId: item.productId,
            productName: item.productName,
            productSku: item.productSku,
            productImageUrl: item.productImageUrl,
            unitPrice: item.unitPrice,
            quantity: Math.floor(Number.parseFloat(item.quantity)),
            lineTotal: (
              Number.parseFloat(item.unitPrice) * Number.parseFloat(item.quantity)
            ).toFixed(2),
            currency: item.currency,
          }));

          const shippingAddress = cart.shippingAddress
            ? (JSON.parse(cart.shippingAddress) as Address)
            : null;
          const billingAddress = cart.billingAddress
            ? (JSON.parse(cart.billingAddress) as Address)
            : null;

          if (!shippingAddress || !billingAddress) {
            throw new Error('Confirmed order missing address data');
          }

          return {
            id: cart.id,
            orderNumber: cart.orderNumber,
            status: cart.status,
            orderDate: cart.orderDate,
            currency: cart.currency,
            subtotal: cart.subtotal,
            taxAmount: cart.taxAmount || '0.00',
            discountAmount: cart.discountAmount || '0.00',
            shippingAmount: cart.shippingAmount || '0.00',
            totalAmount: cart.totalAmount,
            shippingAddress,
            billingAddress,
            items: formattedItems,
            createdAt: cart.createdAt,
            updatedAt: cart.updatedAt,
          };
        }

        if (cart.status !== 'cart') {
          throw new OrderNotCheckoutEligibleError(cart.status);
        }

        const cartItems = await findCartItems(cart.id, tx as unknown as Database);

        if (cartItems.length === 0) {
          throw new EmptyCartError();
        }

        const inactiveProducts: string[] = [];
        for (const item of cartItems) {
          const product = await findProductById(item.productId, tx as unknown as Database);
          if (!product || product.status !== 'active') {
            inactiveProducts.push(item.productName);
          }
        }

        if (inactiveProducts.length > 0) {
          throw new InactiveProductError(inactiveProducts);
        }

        const orderNumber = await generateOrderNumber(tx as unknown as Database, attempt);

        const billingAddress = request.billingSameAsShipping
          ? request.shippingAddress
          : request.billingAddress || request.shippingAddress;

        const today = new Date().toISOString().split('T')?.[0] || '';

        const updatedOrders = await tx
          .update(orders)
          .set({
            status: 'confirmed',
            orderNumber,
            orderDate: today,
            shippingAddress: JSON.stringify(request.shippingAddress),
            billingAddress: JSON.stringify(billingAddress),
            userId,
            cartToken: null,
            updatedAt: sql`now()`,
          })
          .where(eq(orders.id, cart.id))
          .returning();

        const updatedOrder = updatedOrders[0];

        if (!updatedOrder) {
          throw new Error('Failed to update order');
        }

        const formattedItems = cartItems.map((item) => ({
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

        logger.info(
          {
            userId,
            orderId: updatedOrder.id,
            orderNumber: updatedOrder.orderNumber,
            itemCount: cartItems.length,
          },
          'Checkout completed successfully'
        );

        return {
          id: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
          status: updatedOrder.status,
          orderDate: updatedOrder.orderDate,
          currency: updatedOrder.currency,
          subtotal: updatedOrder.subtotal,
          taxAmount: updatedOrder.taxAmount || '0.00',
          discountAmount: updatedOrder.discountAmount || '0.00',
          shippingAmount: updatedOrder.shippingAmount || '0.00',
          totalAmount: updatedOrder.totalAmount,
          shippingAddress: request.shippingAddress,
          billingAddress,
          items: formattedItems,
          createdAt: updatedOrder.createdAt,
          updatedAt: updatedOrder.updatedAt,
        };
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('duplicate key') &&
        error.message.includes('idx_orders_order_number')
      ) {
        logger.warn({ attempt, userId }, 'Order number collision, retrying');
        continue;
      }
      throw error;
    }
  }

  throw new OrderNumberGenerationError();
}

export const checkoutService = {
  checkout,
};
