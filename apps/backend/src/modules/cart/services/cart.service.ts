import { randomUUID } from 'node:crypto';
import type { Database } from '../../../db/index.js';
import { db } from '../../../db/index.js';
import { logger } from '../../../lib/logger.js';
import { findProductById } from '../../products/repositories/products.repository.js';
import type { CartIdentifier, CartItem, CartResponse } from '../domain/cart.types.js';
import {
  createCartOrder,
  deleteAllCartItems,
  deleteCartItem,
  deleteCartOrder,
  findCartByToken,
  findCartByUserId,
  findCartItems,
  reassignGuestCart,
  updateCartItemQuantity,
  updateCartTotals,
  upsertCartItem,
} from '../repositories/cart.repository.js';

/**
 * Custom errors
 */
export class CartNotFoundError extends Error {
  constructor(message = 'Cart not found') {
    super(message);
    this.name = 'CartNotFoundError';
  }
}

export class CartItemNotFoundError extends Error {
  constructor(itemId: string) {
    super(`Cart item ${itemId} not found`);
    this.name = 'CartItemNotFoundError';
  }
}

export class ProductNotFoundError extends Error {
  constructor(productId: string) {
    super(`Product ${productId} not found`);
    this.name = 'ProductNotFoundError';
  }
}

export class ProductNotAvailableError extends Error {
  constructor(productId: string) {
    super(`Product ${productId} is not available`);
    this.name = 'ProductNotAvailableError';
  }
}

export class CurrencyMismatchError extends Error {
  constructor(cartCurrency: string, productCurrency: string) {
    super(`Product currency ${productCurrency} does not match cart currency ${cartCurrency}`);
    this.name = 'CurrencyMismatchError';
  }
}

/**
 * Helper: Convert order items to cart items with computed line totals
 */
function formatCartItems(items: Awaited<ReturnType<typeof findCartItems>>): CartItem[] {
  return items.map((item) => {
    const quantity = Number.parseFloat(item.quantity);
    const unitPrice = Number.parseFloat(item.unitPrice);
    const lineTotal = (quantity * unitPrice).toFixed(2);

    return {
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      productSku: item.productSku,
      productImageUrl: item.productImageUrl,
      unitPrice: item.unitPrice,
      quantity: Math.floor(quantity),
      lineTotal,
      currency: item.currency,
    };
  });
}

/**
 * Get cart by identifier (user or guest)
 * Returns empty cart representation if no cart exists
 */
export async function getCart(
  identifier: CartIdentifier,
  database: Database = db
): Promise<CartResponse> {
  let cart = null;

  if (identifier.type === 'user') {
    cart = await findCartByUserId(identifier.userId, database);
  } else if (identifier.cartToken) {
    cart = await findCartByToken(identifier.cartToken, database);
  }

  if (!cart) {
    return {
      items: [],
      subtotal: '0.00',
      itemCount: 0,
      currency: null,
    };
  }

  const items = await findCartItems(cart.id, database);
  const formattedItems = formatCartItems(items);

  logger.info({ cartId: cart.id, itemCount: items.length }, 'Retrieved cart');

  const response: CartResponse = {
    items: formattedItems,
    subtotal: cart.subtotal,
    itemCount: items.length,
    currency: cart.currency,
  };

  if (cart.cartToken) {
    response.cartToken = cart.cartToken;
  }

  return response;
}

/**
 * Add item to cart
 * Creates cart if it doesn't exist
 * Upserts item (adds quantity if product already in cart)
 */
export async function addItemToCart(
  identifier: CartIdentifier,
  productId: string,
  quantity: number,
  database: Database = db
): Promise<CartResponse> {
  const product = await findProductById(productId, database);

  if (!product) {
    throw new ProductNotFoundError(productId);
  }

  if (product.status !== 'active') {
    throw new ProductNotAvailableError(productId);
  }

  let cart = null;
  let newCartToken: string | undefined;

  if (identifier.type === 'user') {
    cart = await findCartByUserId(identifier.userId, database);
  } else if (identifier.cartToken) {
    cart = await findCartByToken(identifier.cartToken, database);
  }

  if (!cart) {
    newCartToken = identifier.type === 'guest' ? randomUUID() : undefined;

    cart = await createCartOrder(
      {
        userId: identifier.type === 'user' ? identifier.userId : null,
        cartToken: newCartToken || null,
        currency: product.currency,
        orderNumber: `CART-${Date.now()}-${randomUUID().slice(0, 8)}`,
        orderDate: new Date().toISOString().split('T')[0] || '',
      },
      database
    );

    logger.info(
      { cartId: cart.id, userId: cart.userId, cartToken: cart.cartToken },
      'Created new cart'
    );
  } else {
    if (cart.currency !== product.currency) {
      throw new CurrencyMismatchError(cart.currency, product.currency);
    }
  }

  await upsertCartItem(
    cart.id,
    {
      productId: product.id,
      quantity,
      unitPrice: product.price,
      currency: product.currency,
      productName: product.name,
      productSku: product.sku,
      productImageUrl: product.imageUrl,
    },
    database
  );

  await updateCartTotals(cart.id, database);

  logger.info({ cartId: cart.id, productId, quantity }, 'Added item to cart');

  const updatedIdentifier: CartIdentifier = newCartToken
    ? { type: 'guest', cartToken: newCartToken }
    : identifier;

  const updatedCart = await getCart(updatedIdentifier, database);

  if (newCartToken) {
    return {
      ...updatedCart,
      newCartToken,
    };
  }

  return updatedCart;
}

/**
 * Update item quantity in cart
 */
export async function updateItemQuantity(
  identifier: CartIdentifier,
  itemId: string,
  quantity: number,
  database: Database = db
): Promise<CartResponse> {
  let cart = null;

  if (identifier.type === 'user') {
    cart = await findCartByUserId(identifier.userId, database);
  } else if (identifier.cartToken) {
    cart = await findCartByToken(identifier.cartToken, database);
  }

  if (!cart) {
    throw new CartNotFoundError();
  }

  const updatedItem = await updateCartItemQuantity(itemId, cart.id, quantity, database);

  if (!updatedItem) {
    throw new CartItemNotFoundError(itemId);
  }

  await updateCartTotals(cart.id, database);

  logger.info({ cartId: cart.id, itemId, quantity }, 'Updated cart item quantity');

  return getCart(identifier, database);
}

/**
 * Remove item from cart
 * Deletes cart if it was the last item
 */
export async function removeItemFromCart(
  identifier: CartIdentifier,
  itemId: string,
  database: Database = db
): Promise<CartResponse> {
  let cart = null;

  if (identifier.type === 'user') {
    cart = await findCartByUserId(identifier.userId, database);
  } else if (identifier.cartToken) {
    cart = await findCartByToken(identifier.cartToken, database);
  }

  if (!cart) {
    throw new CartNotFoundError();
  }

  const deletedItem = await deleteCartItem(itemId, cart.id, database);

  if (!deletedItem) {
    throw new CartItemNotFoundError(itemId);
  }

  const remainingItems = await findCartItems(cart.id, database);

  if (remainingItems.length === 0) {
    await deleteCartOrder(cart.id, database);
    logger.info({ cartId: cart.id }, 'Deleted empty cart after removing last item');

    return {
      items: [],
      subtotal: '0.00',
      itemCount: 0,
      currency: null,
    };
  }

  await updateCartTotals(cart.id, database);

  logger.info({ cartId: cart.id, itemId }, 'Removed item from cart');

  return getCart(identifier, database);
}

/**
 * Merge guest cart into authenticated user's cart
 * If user has no cart, reassign guest cart to user
 * If user has a cart, merge items (sum quantities for matching products)
 */
export async function mergeGuestCart(
  userId: string,
  guestCartToken: string,
  database: Database = db
): Promise<CartResponse> {
  const guestCart = await findCartByToken(guestCartToken, database);

  if (!guestCart) {
    throw new CartNotFoundError('Guest cart not found');
  }

  const userCart = await findCartByUserId(userId, database);

  if (!userCart) {
    await reassignGuestCart(guestCart.id, userId, database);
    logger.info({ cartId: guestCart.id, userId }, 'Reassigned guest cart to user');

    return getCart({ type: 'user', userId }, database);
  }

  const guestItems = await findCartItems(guestCart.id, database);

  for (const guestItem of guestItems) {
    await upsertCartItem(
      userCart.id,
      {
        productId: guestItem.productId,
        quantity: Math.floor(Number.parseFloat(guestItem.quantity)),
        unitPrice: guestItem.unitPrice,
        currency: guestItem.currency,
        productName: guestItem.productName,
        productSku: guestItem.productSku,
        productImageUrl: guestItem.productImageUrl,
      },
      database
    );
  }

  await deleteAllCartItems(guestCart.id, database);
  await deleteCartOrder(guestCart.id, database);
  await updateCartTotals(userCart.id, database);

  logger.info(
    { userCartId: userCart.id, guestCartId: guestCart.id, userId },
    'Merged guest cart into user cart'
  );

  return getCart({ type: 'user', userId }, database);
}

/**
 * Service factory for dependency injection
 */
function createCartService(database: Database = db) {
  return {
    getCart: (identifier: CartIdentifier) => getCart(identifier, database),
    addItem: (identifier: CartIdentifier, productId: string, quantity: number) =>
      addItemToCart(identifier, productId, quantity, database),
    updateItemQuantity: (identifier: CartIdentifier, itemId: string, quantity: number) =>
      updateItemQuantity(identifier, itemId, quantity, database),
    removeItem: (identifier: CartIdentifier, itemId: string) =>
      removeItemFromCart(identifier, itemId, database),
    mergeGuestCart: (userId: string, guestCartToken: string) =>
      mergeGuestCart(userId, guestCartToken, database),
  };
}

export const cartService = createCartService();
