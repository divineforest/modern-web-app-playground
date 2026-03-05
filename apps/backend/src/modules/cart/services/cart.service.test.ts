import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestProduct } from '../../../../tests/factories/products.js';
import { db, orderItems, orders, products } from '../../../db/index.js';
import type { Product } from '../../products/domain/product.entity.js';
import {
  addItemToCart,
  CartItemNotFoundError,
  CartNotFoundError,
  CurrencyMismatchError,
  clearCart,
  getCart,
  mergeGuestCart,
  ProductNotAvailableError,
  ProductNotFoundError,
  removeItemFromCart,
  updateItemQuantity,
} from './cart.service.js';

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';
const INVALID_UUID = '00000000-0000-0000-0000-000000000099';

describe('Cart Service', () => {
  let testProduct: Product;
  let testProduct2: Product;

  beforeEach(async () => {
    testProduct = await createTestProduct({
      status: 'active',
      name: 'Test Product 1',
      price: '25.00',
      currency: 'EUR',
    });

    testProduct2 = await createTestProduct({
      status: 'active',
      name: 'Test Product 2',
      price: '15.00',
      currency: 'EUR',
    });
  });

  afterEach(async () => {
    await db.delete(orderItems);
    await db.delete(orders);
    await db.delete(products);
  });

  describe('getCart', () => {
    it('should return empty cart when no cart exists for guest', async () => {
      const cart = await getCart({ type: 'guest', cartToken: INVALID_UUID }, db);

      expect(cart).toEqual({
        items: [],
        subtotal: '0.00',
        itemCount: 0,
        currency: null,
      });
    });

    it('should return empty cart when no cart exists for user', async () => {
      const cart = await getCart({ type: 'user', userId: INVALID_UUID }, db);

      expect(cart).toEqual({
        items: [],
        subtotal: '0.00',
        itemCount: 0,
        currency: null,
      });
    });

    it('should return cart with items for guest', async () => {
      const result = await addItemToCart({ type: 'guest' }, testProduct.id, 2, db);

      expect(result.newCartToken).toBeDefined();
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.quantity).toBe(2);

      if (!result.newCartToken) {
        throw new Error('Expected newCartToken to be defined');
      }

      const cart = await getCart({ type: 'guest', cartToken: result.newCartToken }, db);
      expect(cart.items).toHaveLength(1);
      expect(cart.subtotal).toBe('50.00');
      expect(cart.itemCount).toBe(1);
    });

    it('should return cart with items for user', async () => {
      const userId = TEST_USER_ID;
      await addItemToCart({ type: 'user', userId }, testProduct.id, 3, db);

      const cart = await getCart({ type: 'user', userId }, db);
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0]?.quantity).toBe(3);
      expect(cart.subtotal).toBe('75.00');
      expect(cart.itemCount).toBe(1);
    });
  });

  describe('addItemToCart', () => {
    it('should create a new guest cart when adding first item', async () => {
      const result = await addItemToCart({ type: 'guest' }, testProduct.id, 1, db);

      expect(result.newCartToken).toBeDefined();
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.productId).toBe(testProduct.id);
      expect(result.items[0]?.quantity).toBe(1);
      expect(result.items[0]?.unitPrice).toBe('25.00');
      expect(result.items[0]?.lineTotal).toBe('25.00');
      expect(result.subtotal).toBe('25.00');
      expect(result.currency).toBe('EUR');
    });

    it('should create a new user cart when adding first item', async () => {
      const userId = TEST_USER_ID;
      const result = await addItemToCart({ type: 'user', userId }, testProduct.id, 2, db);

      expect(result.newCartToken).toBeUndefined();
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.quantity).toBe(2);
      expect(result.subtotal).toBe('50.00');
    });

    it('should add quantity when product already in cart', async () => {
      const userId = TEST_USER_ID;
      await addItemToCart({ type: 'user', userId }, testProduct.id, 2, db);
      const result = await addItemToCart({ type: 'user', userId }, testProduct.id, 3, db);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.quantity).toBe(5);
      expect(result.subtotal).toBe('125.00');
    });

    it('should lock product price at time of addition', async () => {
      const userId = TEST_USER_ID;
      const result = await addItemToCart({ type: 'user', userId }, testProduct.id, 1, db);

      expect(result.items[0]?.unitPrice).toBe('25.00');

      await db.update(products).set({ price: '30.00' }).where(eq(products.id, testProduct.id));

      const cart = await getCart({ type: 'user', userId }, db);
      expect(cart.items[0]?.unitPrice).toBe('25.00');
    });

    it('should snapshot product name and SKU at time of addition', async () => {
      const userId = TEST_USER_ID;
      const result = await addItemToCart({ type: 'user', userId }, testProduct.id, 1, db);

      expect(result.items[0]?.productName).toBe(testProduct.name);
      expect(result.items[0]?.productSku).toBe(testProduct.sku);
    });

    it('should reject inactive product', async () => {
      const inactiveProduct = await createTestProduct({
        status: 'draft',
        name: 'Inactive Product',
      });

      await expect(addItemToCart({ type: 'guest' }, inactiveProduct.id, 1, db)).rejects.toThrow(
        ProductNotAvailableError
      );
    });

    it('should reject non-existent product', async () => {
      await expect(addItemToCart({ type: 'guest' }, INVALID_UUID, 1, db)).rejects.toThrow(
        ProductNotFoundError
      );
    });

    it('should reject product with different currency', async () => {
      const usdProduct = await createTestProduct({
        status: 'active',
        currency: 'USD',
        price: '30.00',
      });

      const userId = TEST_USER_ID;
      await addItemToCart({ type: 'user', userId }, testProduct.id, 1, db);

      await expect(addItemToCart({ type: 'user', userId }, usdProduct.id, 1, db)).rejects.toThrow(
        CurrencyMismatchError
      );
    });

    it('should set cart currency from first item', async () => {
      const userId = TEST_USER_ID;
      const result = await addItemToCart({ type: 'user', userId }, testProduct.id, 1, db);

      expect(result.currency).toBe('EUR');
    });
  });

  describe('updateItemQuantity', () => {
    it('should update item quantity', async () => {
      const userId = TEST_USER_ID;
      await addItemToCart({ type: 'user', userId }, testProduct.id, 2, db);

      const cart = await getCart({ type: 'user', userId }, db);
      const itemId = cart.items[0]?.id;
      expect(itemId).toBeDefined();

      if (!itemId) {
        throw new Error('Expected itemId to be defined');
      }

      const result = await updateItemQuantity({ type: 'user', userId }, itemId, 5, db);

      expect(result.items[0]?.quantity).toBe(5);
      expect(result.subtotal).toBe('125.00');
    });

    it('should recalculate totals after update', async () => {
      const userId = TEST_USER_ID;
      await addItemToCart({ type: 'user', userId }, testProduct.id, 2, db);

      const cart = await getCart({ type: 'user', userId }, db);
      const itemId = cart.items[0]?.id;

      if (!itemId) {
        throw new Error('Expected itemId to be defined');
      }

      await updateItemQuantity({ type: 'user', userId }, itemId, 10, db);
      const updatedCart = await getCart({ type: 'user', userId }, db);

      expect(updatedCart.subtotal).toBe('250.00');
    });

    it('should throw error if cart not found', async () => {
      await expect(
        updateItemQuantity({ type: 'guest', cartToken: INVALID_UUID }, 'item-id', 5, db)
      ).rejects.toThrow(CartNotFoundError);
    });

    it('should throw error if item not found', async () => {
      const userId = TEST_USER_ID;
      await addItemToCart({ type: 'user', userId }, testProduct.id, 1, db);

      await expect(
        updateItemQuantity({ type: 'user', userId }, INVALID_UUID, 5, db)
      ).rejects.toThrow(CartItemNotFoundError);
    });
  });

  describe('removeItemFromCart', () => {
    it('should remove item from cart', async () => {
      const userId = TEST_USER_ID;
      await addItemToCart({ type: 'user', userId }, testProduct.id, 1, db);
      await addItemToCart({ type: 'user', userId }, testProduct2.id, 2, db);

      let cart = await getCart({ type: 'user', userId }, db);
      expect(cart.items).toHaveLength(2);

      const itemToRemove = cart.items[0]?.id;
      if (!itemToRemove) {
        throw new Error('Expected itemToRemove to be defined');
      }

      await removeItemFromCart({ type: 'user', userId }, itemToRemove, db);

      cart = await getCart({ type: 'user', userId }, db);
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0]?.productId).toBe(testProduct2.id);
    });

    it('should delete cart when removing last item', async () => {
      const userId = TEST_USER_ID;
      await addItemToCart({ type: 'user', userId }, testProduct.id, 1, db);

      let cart = await getCart({ type: 'user', userId }, db);
      const itemId = cart.items[0]?.id;

      if (!itemId) {
        throw new Error('Expected itemId to be defined');
      }

      const result = await removeItemFromCart({ type: 'user', userId }, itemId, db);

      expect(result.items).toHaveLength(0);
      expect(result.subtotal).toBe('0.00');
      expect(result.itemCount).toBe(0);

      cart = await getCart({ type: 'user', userId }, db);
      expect(cart.items).toHaveLength(0);
    });

    it('should throw error if cart not found', async () => {
      await expect(
        removeItemFromCart({ type: 'guest', cartToken: INVALID_UUID }, 'item-id', db)
      ).rejects.toThrow(CartNotFoundError);
    });

    it('should throw error if item not found', async () => {
      const userId = TEST_USER_ID;
      await addItemToCart({ type: 'user', userId }, testProduct.id, 1, db);

      await expect(removeItemFromCart({ type: 'user', userId }, INVALID_UUID, db)).rejects.toThrow(
        CartItemNotFoundError
      );
    });
  });

  describe('clearCart', () => {
    it('should clear all items and delete cart', async () => {
      const userId = TEST_USER_ID;
      await addItemToCart({ type: 'user', userId }, testProduct.id, 1, db);
      await addItemToCart({ type: 'user', userId }, testProduct2.id, 2, db);

      let cart = await getCart({ type: 'user', userId }, db);
      expect(cart.items).toHaveLength(2);

      const result = await clearCart({ type: 'user', userId }, db);

      expect(result.items).toHaveLength(0);
      expect(result.subtotal).toBe('0.00');

      cart = await getCart({ type: 'user', userId }, db);
      expect(cart.items).toHaveLength(0);
    });

    it('should return empty cart if cart does not exist', async () => {
      const result = await clearCart({ type: 'guest', cartToken: INVALID_UUID }, db);

      expect(result.items).toHaveLength(0);
      expect(result.subtotal).toBe('0.00');
    });
  });

  describe('mergeGuestCart', () => {
    it('should reassign guest cart to user when user has no cart', async () => {
      const result = await addItemToCart({ type: 'guest' }, testProduct.id, 2, db);
      const guestCartToken = result.newCartToken;

      if (!guestCartToken) {
        throw new Error('Expected guestCartToken to be defined');
      }

      const userId = TEST_USER_ID;
      const mergedCart = await mergeGuestCart(userId, guestCartToken, db);

      expect(mergedCart.items).toHaveLength(1);
      expect(mergedCart.items[0]?.quantity).toBe(2);

      const guestCart = await getCart({ type: 'guest', cartToken: guestCartToken }, db);
      expect(guestCart.items).toHaveLength(0);

      const userCart = await getCart({ type: 'user', userId }, db);
      expect(userCart.items).toHaveLength(1);
    });

    it('should merge items when user already has a cart', async () => {
      const userId = TEST_USER_ID;
      await addItemToCart({ type: 'user', userId }, testProduct.id, 1, db);

      const guestResult = await addItemToCart({ type: 'guest' }, testProduct2.id, 2, db);
      const guestCartToken = guestResult.newCartToken;

      if (!guestCartToken) {
        throw new Error('Expected guestCartToken to be defined');
      }

      const mergedCart = await mergeGuestCart(userId, guestCartToken, db);

      expect(mergedCart.items).toHaveLength(2);
      expect(mergedCart.itemCount).toBe(2);
    });

    it('should sum quantities for matching products', async () => {
      const userId = TEST_USER_ID;
      await addItemToCart({ type: 'user', userId }, testProduct.id, 2, db);

      const guestResult = await addItemToCart({ type: 'guest' }, testProduct.id, 3, db);
      const guestCartToken = guestResult.newCartToken;

      if (!guestCartToken) {
        throw new Error('Expected guestCartToken to be defined');
      }

      const mergedCart = await mergeGuestCart(userId, guestCartToken, db);

      expect(mergedCart.items).toHaveLength(1);
      expect(mergedCart.items[0]?.quantity).toBe(5);
      expect(mergedCart.subtotal).toBe('125.00');
    });

    it('should delete guest cart after merge', async () => {
      const guestResult = await addItemToCart({ type: 'guest' }, testProduct.id, 1, db);
      const guestCartToken = guestResult.newCartToken;

      if (!guestCartToken) {
        throw new Error('Expected guestCartToken to be defined');
      }

      const userId = TEST_USER_ID;
      await mergeGuestCart(userId, guestCartToken, db);

      const guestCart = await getCart({ type: 'guest', cartToken: guestCartToken }, db);
      expect(guestCart.items).toHaveLength(0);
    });

    it('should throw error if guest cart not found', async () => {
      await expect(
        mergeGuestCart('user-id', '00000000-0000-0000-0000-000000000000', db)
      ).rejects.toThrow(CartNotFoundError);
    });
  });
});
