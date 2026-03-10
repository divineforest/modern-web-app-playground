import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestProduct } from '../../../../tests/factories/products.js';
import { createAuthenticatedUser } from '../../../../tests/helpers/auth.js';
import { buildTestApp } from '../../../app.js';
import { db, orderItems, orders, products, sessions, users } from '../../../db/index.js';
import type { Product } from '../../products/domain/product.entity.js';

describe('Cart Routes', () => {
  let fastify: FastifyInstance;
  let testProduct: Product;
  let testProduct2: Product;

  beforeEach(async () => {
    fastify = await buildTestApp();

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
    await db.delete(sessions);
    await db.delete(users);
    await db.delete(products);
    await fastify.close();
  });

  describe('GET /api/cart', () => {
    it('should return empty cart when no cart exists', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/cart',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toEqual({
        items: [],
        subtotal: '0.00',
        itemCount: 0,
        currency: null,
      });
    });

    it('should return cart with items for guest', async () => {
      const addResponse = await fastify.inject({
        method: 'POST',
        url: '/api/cart/items',
        payload: {
          productId: testProduct.id,
          quantity: 2,
        },
      });

      const cartCookie = addResponse.cookies.find((c) => c.name === 'cart_token');
      expect(cartCookie).toBeDefined();

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/cart',
        cookies: {
          cart_token: cartCookie?.value || '',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.items).toHaveLength(1);
      expect(body.items[0].quantity).toBe(2);
      expect(body.subtotal).toBe('50.00');
    });
  });

  describe('POST /api/cart/items', () => {
    it('should create cart and add item for guest', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/cart/items',
        payload: {
          productId: testProduct.id,
          quantity: 1,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.newCartToken).toBeDefined();
      expect(body.items).toHaveLength(1);
      expect(body.items[0].productId).toBe(testProduct.id);
      expect(body.items[0].quantity).toBe(1);
      expect(body.items[0].unitPrice).toBe('25.00');
      expect(body.items[0].lineTotal).toBe('25.00');
      expect(body.subtotal).toBe('25.00');
      expect(body.currency).toBe('EUR');
    });

    it('should add item to existing guest cart', async () => {
      const firstResponse = await fastify.inject({
        method: 'POST',
        url: '/api/cart/items',
        payload: {
          productId: testProduct.id,
          quantity: 1,
        },
      });

      const cartCookie = firstResponse.cookies.find((c) => c.name === 'cart_token');
      const cartToken = cartCookie?.value || '';

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/cart/items',
        cookies: {
          cart_token: cartToken,
        },
        payload: {
          productId: testProduct2.id,
          quantity: 2,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.items).toHaveLength(2);
      expect(body.itemCount).toBe(2);
    });

    it('should sum quantities when adding duplicate product', async () => {
      const firstResponse = await fastify.inject({
        method: 'POST',
        url: '/api/cart/items',
        payload: {
          productId: testProduct.id,
          quantity: 2,
        },
      });

      const firstBody = JSON.parse(firstResponse.payload);
      const cartToken = firstBody.newCartToken;

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/cart/items',
        cookies: {
          cart_token: cartToken,
        },
        payload: {
          productId: testProduct.id,
          quantity: 3,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.items).toHaveLength(1);
      expect(body.items[0].quantity).toBe(5);
      expect(body.subtotal).toBe('125.00');
    });

    it('should return 404 for non-existent product', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/cart/items',
        payload: {
          productId: randomUUID(),
          quantity: 1,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Product not found');
    });

    it('should return 422 for inactive product', async () => {
      const inactiveProduct = await createTestProduct({
        status: 'draft',
        name: 'Inactive Product',
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/cart/items',
        payload: {
          productId: inactiveProduct.id,
          quantity: 1,
        },
      });

      expect(response.statusCode).toBe(422);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Product is not available');
    });

    it('should return 422 for currency mismatch', async () => {
      const usdProduct = await createTestProduct({
        status: 'active',
        currency: 'USD',
        price: '30.00',
      });

      const firstResponse = await fastify.inject({
        method: 'POST',
        url: '/api/cart/items',
        payload: {
          productId: testProduct.id,
          quantity: 1,
        },
      });

      const firstBody = JSON.parse(firstResponse.payload);
      const cartToken = firstBody.newCartToken;

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/cart/items',
        cookies: {
          cart_token: cartToken,
        },
        payload: {
          productId: usdProduct.id,
          quantity: 1,
        },
      });

      expect(response.statusCode).toBe(422);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Product currency does not match cart currency');
    });

    it('should return 400 for invalid quantity', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/cart/items',
        payload: {
          productId: testProduct.id,
          quantity: 0,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('PATCH /api/cart/items/:itemId', () => {
    it('should update item quantity', async () => {
      const addResponse = await fastify.inject({
        method: 'POST',
        url: '/api/cart/items',
        payload: {
          productId: testProduct.id,
          quantity: 2,
        },
      });

      const addBody = JSON.parse(addResponse.payload);
      const cartCookie = addResponse.cookies.find((c) => c.name === 'cart_token');
      const cartToken = cartCookie?.value || '';
      const itemId = addBody.items[0]?.id;

      expect(itemId).toBeDefined();

      const response = await fastify.inject({
        method: 'PATCH',
        url: `/api/cart/items/${itemId}`,
        cookies: {
          cart_token: cartToken,
        },
        payload: {
          quantity: 5,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.items[0].quantity).toBe(5);
      expect(body.subtotal).toBe('125.00');
    });

    it('should return 404 for non-existent item', async () => {
      const addResponse = await fastify.inject({
        method: 'POST',
        url: '/api/cart/items',
        payload: {
          productId: testProduct.id,
          quantity: 1,
        },
      });

      const cartCookie = addResponse.cookies.find((c) => c.name === 'cart_token');
      const cartToken = cartCookie?.value || '';

      const response = await fastify.inject({
        method: 'PATCH',
        url: `/api/cart/items/${randomUUID()}`,
        cookies: {
          cart_token: cartToken,
        },
        payload: {
          quantity: 5,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 for non-existent cart', async () => {
      const response = await fastify.inject({
        method: 'PATCH',
        url: `/api/cart/items/${randomUUID()}`,
        headers: {
          'x-cart-token': randomUUID(),
        },
        payload: {
          quantity: 5,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/cart/items/:itemId', () => {
    it('should remove item from cart', async () => {
      const addResponse1 = await fastify.inject({
        method: 'POST',
        url: '/api/cart/items',
        payload: {
          productId: testProduct.id,
          quantity: 1,
        },
      });

      const cartCookie = addResponse1.cookies.find((c) => c.name === 'cart_token');
      const cartToken = cartCookie?.value || '';

      await fastify.inject({
        method: 'POST',
        url: '/api/cart/items',
        cookies: {
          cart_token: cartToken,
        },
        payload: {
          productId: testProduct2.id,
          quantity: 2,
        },
      });

      const cartResponse = await fastify.inject({
        method: 'GET',
        url: '/api/cart',
        cookies: {
          cart_token: cartToken,
        },
      });

      const cartBody = JSON.parse(cartResponse.payload);
      const itemToRemove = cartBody.items[0]?.id;
      expect(itemToRemove).toBeDefined();

      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/cart/items/${itemToRemove}`,
        cookies: {
          cart_token: cartToken,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.items).toHaveLength(1);
      expect(body.items[0].productId).toBe(testProduct2.id);
    });

    it('should delete cart when removing last item', async () => {
      const addResponse = await fastify.inject({
        method: 'POST',
        url: '/api/cart/items',
        payload: {
          productId: testProduct.id,
          quantity: 1,
        },
      });

      const addBody = JSON.parse(addResponse.payload);
      const cartCookie = addResponse.cookies.find((c) => c.name === 'cart_token');
      const cartToken = cartCookie?.value || '';
      const itemId = addBody.items[0]?.id;

      expect(itemId).toBeDefined();

      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/cart/items/${itemId}`,
        cookies: {
          cart_token: cartToken,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.items).toHaveLength(0);
      expect(body.subtotal).toBe('0.00');

      const cartResponse = await fastify.inject({
        method: 'GET',
        url: '/api/cart',
        cookies: {
          cart_token: cartToken,
        },
      });

      const cartBody = JSON.parse(cartResponse.payload);
      expect(cartBody.items).toHaveLength(0);
    });

    it('should return 404 for non-existent item', async () => {
      const addResponse = await fastify.inject({
        method: 'POST',
        url: '/api/cart/items',
        payload: {
          productId: testProduct.id,
          quantity: 1,
        },
      });

      const cartCookie = addResponse.cookies.find((c) => c.name === 'cart_token');
      const cartToken = cartCookie?.value || '';

      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/cart/items/${randomUUID()}`,
        cookies: {
          cart_token: cartToken,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/cart/merge', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/cart/merge',
        payload: {
          cartToken: randomUUID(),
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Authentication required');
    });

    it('should return 404 for non-existent guest cart', async () => {
      const auth = await createAuthenticatedUser('merge-test@example.com', 'password123', db);

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/cart/merge',
        cookies: {
          sid: auth.sessionToken,
        },
        payload: {
          cartToken: randomUUID(),
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Guest cart not found');
    });
  });
});
