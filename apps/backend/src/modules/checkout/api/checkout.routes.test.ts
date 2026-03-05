import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestOrderItem } from '../../../../tests/factories/order-items.js';
import { createTestOrder } from '../../../../tests/factories/orders.js';
import { createTestProduct } from '../../../../tests/factories/products.js';
import { buildTestApp } from '../../../app.js';
import { db, orderItems, orders, products } from '../../../db/index.js';
import type { Product } from '../../products/domain/product.entity.js';

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';
const TEST_TOKEN = process.env['API_BEARER_TOKENS']?.split(',')[0]?.trim() || 'test_token_12345';

const authHeaders = {
  authorization: `Bearer ${TEST_TOKEN}`,
  'x-user-id': TEST_USER_ID,
  'x-user-email': 'test@example.com',
  'x-user-name': 'Test User',
};

describe('Checkout Routes', () => {
  let fastify: FastifyInstance;
  let testProduct: Product;

  beforeEach(async () => {
    fastify = await buildTestApp();

    testProduct = await createTestProduct({
      status: 'active',
      name: 'Test Product',
      price: '50.00',
      currency: 'USD',
    });
  });

  afterEach(async () => {
    await db.delete(orderItems);
    await db.delete(orders);
    await db.delete(products);
    await fastify.close();
  });

  describe('POST /api/checkout', () => {
    it('should successfully checkout cart with valid addresses', async () => {
      const cart = await createTestOrder({
        status: 'cart',
        userId: TEST_USER_ID,
        subtotal: '50.00',
        totalAmount: '50.00',
        currency: 'USD',
      });

      await createTestOrderItem({
        orderId: cart.id,
        productId: testProduct.id,
        quantity: '1',
        unitPrice: '50.00',
        currency: 'USD',
        productName: testProduct.name,
        productSku: testProduct.sku,
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/checkout',
        headers: authHeaders,
        payload: {
          shippingAddress: {
            fullName: 'John Doe',
            addressLine1: '123 Main St',
            city: 'New York',
            postalCode: '10001',
            countryCode: 'US',
          },
          billingAddress: {
            fullName: 'John Doe',
            addressLine1: '456 Billing Ave',
            city: 'Boston',
            postalCode: '02101',
            countryCode: 'US',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('confirmed');
      expect(body.orderNumber).toMatch(/^ORD-\d{8}-\d{5}$/);
      expect(body.shippingAddress.fullName).toBe('John Doe');
      expect(body.billingAddress.fullName).toBe('John Doe');
      expect(body.items).toHaveLength(1);
      expect(body.items[0].productId).toBe(testProduct.id);
    });

    it('should use shipping address for billing when billingSameAsShipping is true', async () => {
      const cart = await createTestOrder({
        status: 'cart',
        userId: TEST_USER_ID,
        subtotal: '50.00',
        totalAmount: '50.00',
        currency: 'USD',
      });

      await createTestOrderItem({
        orderId: cart.id,
        productId: testProduct.id,
        quantity: '1',
        unitPrice: '50.00',
        currency: 'USD',
        productName: testProduct.name,
        productSku: testProduct.sku,
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/checkout',
        headers: authHeaders,
        payload: {
          shippingAddress: {
            fullName: 'John Doe',
            addressLine1: '123 Main St',
            city: 'New York',
            postalCode: '10001',
            countryCode: 'US',
          },
          billingSameAsShipping: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.shippingAddress).toEqual(body.billingAddress);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/checkout',
        payload: {
          shippingAddress: {
            fullName: 'John Doe',
            addressLine1: '123 Main St',
            city: 'New York',
            postalCode: '10001',
            countryCode: 'US',
          },
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 404 when no cart exists', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/checkout',
        headers: authHeaders,
        payload: {
          shippingAddress: {
            fullName: 'John Doe',
            addressLine1: '123 Main St',
            city: 'New York',
            postalCode: '10001',
            countryCode: 'US',
          },
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error).toContain('cart');
    });

    it('should return 422 when cart is empty', async () => {
      await createTestOrder({
        status: 'cart',
        userId: TEST_USER_ID,
        subtotal: '0.00',
        totalAmount: '0.00',
        currency: 'USD',
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/checkout',
        headers: authHeaders,
        payload: {
          shippingAddress: {
            fullName: 'John Doe',
            addressLine1: '123 Main St',
            city: 'New York',
            postalCode: '10001',
            countryCode: 'US',
          },
        },
      });

      expect(response.statusCode).toBe(422);
      const body = JSON.parse(response.payload);
      expect(body.error).toContain('empty');
    });

    it('should return 422 when product becomes inactive', async () => {
      const inactiveProduct = await createTestProduct({
        status: 'archived',
        name: 'Inactive Product',
        price: '30.00',
        currency: 'USD',
      });

      const cart = await createTestOrder({
        status: 'cart',
        userId: TEST_USER_ID,
        subtotal: '30.00',
        totalAmount: '30.00',
        currency: 'USD',
      });

      await createTestOrderItem({
        orderId: cart.id,
        productId: inactiveProduct.id,
        quantity: '1',
        unitPrice: '30.00',
        currency: 'USD',
        productName: inactiveProduct.name,
        productSku: inactiveProduct.sku,
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/checkout',
        headers: authHeaders,
        payload: {
          shippingAddress: {
            fullName: 'John Doe',
            addressLine1: '123 Main St',
            city: 'New York',
            postalCode: '10001',
            countryCode: 'US',
          },
        },
      });

      expect(response.statusCode).toBe(422);
      const body = JSON.parse(response.payload);
      expect(body.error).toContain('no longer available');
      expect(body.error).toContain('Inactive Product');
    });

    it('should be idempotent when order is already confirmed', async () => {
      const order = await createTestOrder({
        status: 'confirmed',
        userId: TEST_USER_ID,
        subtotal: '50.00',
        totalAmount: '50.00',
        currency: 'USD',
        shippingAddress: JSON.stringify({
          fullName: 'John Doe',
          addressLine1: '123 Main St',
          city: 'New York',
          postalCode: '10001',
          countryCode: 'US',
        }),
        billingAddress: JSON.stringify({
          fullName: 'John Doe',
          addressLine1: '123 Main St',
          city: 'New York',
          postalCode: '10001',
          countryCode: 'US',
        }),
      });

      await createTestOrderItem({
        orderId: order.id,
        productId: testProduct.id,
        quantity: '1',
        unitPrice: '50.00',
        currency: 'USD',
        productName: testProduct.name,
        productSku: testProduct.sku,
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/checkout',
        headers: authHeaders,
        payload: {
          shippingAddress: {
            fullName: 'Different Name',
            addressLine1: '999 New St',
            city: 'Chicago',
            postalCode: '60601',
            countryCode: 'US',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.orderNumber).toBe(order.orderNumber);
      expect(body.shippingAddress.fullName).toBe('John Doe');
    });

    it('should validate required address fields', async () => {
      const cart = await createTestOrder({
        status: 'cart',
        userId: TEST_USER_ID,
        subtotal: '50.00',
        totalAmount: '50.00',
        currency: 'USD',
      });

      await createTestOrderItem({
        orderId: cart.id,
        productId: testProduct.id,
        quantity: '1',
        unitPrice: '50.00',
        currency: 'USD',
        productName: testProduct.name,
        productSku: testProduct.sku,
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/checkout',
        headers: authHeaders,
        payload: {
          shippingAddress: {
            fullName: 'John Doe',
            addressLine1: '',
            city: 'New York',
            postalCode: '10001',
            countryCode: 'US',
          },
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
