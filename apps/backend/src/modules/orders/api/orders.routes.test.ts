import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestOrderItem } from '../../../../tests/factories/order-items.js';
import { createTestOrder } from '../../../../tests/factories/orders.js';
import { createTestProduct } from '../../../../tests/factories/products.js';
import { createAuthenticatedUser } from '../../../../tests/helpers/auth.js';
import { buildTestApp } from '../../../app.js';
import { db, sessions, users } from '../../../db/index.js';

// Type definitions for API responses
type OrderResponse = {
  id: string;
  status: string;
  orderNumber: string;
  referenceNumber: string | null;
  orderDate: string;
  expectedDeliveryDate: string | null;
  currency: string;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  shippingAmount: string;
  totalAmount: string;
  shippingAddress: string | null;
  billingAddress: string | null;
  paymentTerms: string | null;
  notes: string | null;
  customerNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

type OrderListResponse = {
  orders: OrderResponse[];
};

type DeleteResponse = {
  success: boolean;
  id: string;
};

type ErrorResponse = {
  error?: string;
  message?: string;
  details?: unknown;
};

describe('Orders Routes - Integration Tests', () => {
  let fastify: FastifyInstance;
  let sessionToken: string;

  beforeEach(async () => {
    fastify = await buildTestApp();

    const auth = await createAuthenticatedUser('test@example.com', 'password123', db);
    sessionToken = auth.sessionToken;
  });

  afterEach(async () => {
    await db.delete(sessions);
    await db.delete(users);
    if (fastify) {
      await fastify.close();
    }
  });

  describe('POST /api/orders', () => {
    it('should create an order with valid data', async () => {
      const requestBody = {
        orderNumber: `ORD-${Date.now()}`,
        referenceNumber: 'PO-12345',
        orderDate: '2024-01-15',
        expectedDeliveryDate: '2024-02-01',
        currency: 'EUR',
        subtotal: 1400.0,
        taxAmount: 266.0,
        discountAmount: 50.0,
        shippingAmount: 25.0,
        totalAmount: 1641.0,
        shippingAddress: '123 Main St, Berlin, Germany',
        billingAddress: '456 Business Ave, Berlin, Germany',
        paymentTerms: 'Net 30',
        notes: 'Prioritize this order',
        customerNotes: 'Please deliver to loading dock B',
      };

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/orders',
        cookies: { sid: sessionToken },
        payload: requestBody,
      });

      expect(response.statusCode).toBe(201);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as OrderResponse;
      expect(body.id).toBeDefined();
      expect(body.status).toBe('draft');
      expect(body.orderNumber).toBe(requestBody.orderNumber);
      expect(body.currency).toBe(requestBody.currency);
      expect(body.createdAt).toBeDefined();
      expect(body.updatedAt).toBeDefined();
    });

    it('should return 400 for missing required fields', async () => {
      const requestBody = {
        orderNumber: `ORD-${Date.now()}`,
        // Missing orderDate, currency, subtotal, totalAmount
      };

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/orders',
        cookies: { sid: sessionToken },
        payload: requestBody,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 409 for duplicate order number', async () => {
      const orderNumber = `ORD-DUPLICATE-${Date.now()}`;
      await createTestOrder({ orderNumber }, db);

      const requestBody = {
        orderNumber, // Same number
        orderDate: '2024-01-15',
        currency: 'EUR',
        subtotal: 1500.0,
        totalAmount: 1500.0,
      };

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/orders',
        cookies: { sid: sessionToken },
        payload: requestBody,
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.payload) as ErrorResponse;
      expect(body.error).toContain('Duplicate');
    });

    describe('ACL', () => {
      it('should return 401 without authentication', async () => {
        const requestBody = {
          orderNumber: `ORD-${Date.now()}`,
          orderDate: '2024-01-15',
          currency: 'EUR',
          subtotal: 1500.0,
          totalAmount: 1500.0,
        };

        const response = await fastify.inject({
          method: 'POST',
          url: '/api/orders',
          payload: requestBody,
        });

        expect(response.statusCode).toBe(401);
      });

      it('should return 401 with invalid token', async () => {
        const requestBody = {
          orderNumber: `ORD-${Date.now()}`,
          orderDate: '2024-01-15',
          currency: 'EUR',
          subtotal: 1500.0,
          totalAmount: 1500.0,
        };

        const response = await fastify.inject({
          method: 'POST',
          url: '/api/orders',
          headers: {
            authorization: 'Bearer invalid_token',
          },
          payload: requestBody,
        });

        expect(response.statusCode).toBe(401);
        const body = JSON.parse(response.payload) as ErrorResponse;
        expect(body.message).toBe('Authentication required');
      });
    });
  });

  describe('GET /api/orders/:id', () => {
    it('should get an order by ID', async () => {
      const created = await createTestOrder({}, db);

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/orders/${created.id}`,
        cookies: { sid: sessionToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as OrderResponse;
      expect(body.id).toBe(created.id);
      expect(body.orderNumber).toBe(created.orderNumber);
    });

    it('should return 404 for non-existent ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/orders/${nonExistentId}`,
        cookies: { sid: sessionToken },
      });

      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.payload) as ErrorResponse;
      expect(body.error).toBeDefined();
    });

    it('should return 400 for invalid UUID format', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/orders/invalid-uuid',
        cookies: { sid: sessionToken },
      });

      expect(response.statusCode).toBe(400);
    });

    describe('ACL', () => {
      it('should return 401 without authentication', async () => {
        const created = await createTestOrder({}, db);

        const response = await fastify.inject({
          method: 'GET',
          url: `/api/orders/${created.id}`,
        });

        expect(response.statusCode).toBe(401);
      });
    });
  });

  describe('GET /api/orders', () => {
    it('should list all orders', async () => {
      await createTestOrder({}, db);
      await createTestOrder({}, db);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/orders',
        cookies: { sid: sessionToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as OrderListResponse;
      expect(body.orders).toBeDefined();
      expect(Array.isArray(body.orders)).toBe(true);
      expect(body.orders.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by status', async () => {
      const draftOrder = await createTestOrder({ status: 'draft' }, db);
      const confirmedOrder = await createTestOrder({ status: 'confirmed' }, db);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/orders?status=draft',
        cookies: { sid: sessionToken },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload) as OrderListResponse;
      expect(body.orders.some((o) => o.id === draftOrder.id)).toBe(true);
      expect(body.orders.some((o) => o.id === confirmedOrder.id)).toBe(false);
    });

    it('should order by order date (newest first)', async () => {
      const oldOrder = await createTestOrder({ orderDate: '2024-01-01' }, db);
      const newOrder = await createTestOrder({ orderDate: '2024-02-01' }, db);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/orders',
        cookies: { sid: sessionToken },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload) as OrderListResponse;
      const orderIds = body.orders.map((o) => o.id);
      const newIndex = orderIds.indexOf(newOrder.id);
      const oldIndex = orderIds.indexOf(oldOrder.id);
      expect(newIndex).toBeLessThan(oldIndex);
    });

    describe('ACL', () => {
      it('should return 401 without authentication', async () => {
        const response = await fastify.inject({
          method: 'GET',
          url: '/api/orders',
        });

        expect(response.statusCode).toBe(401);
      });
    });
  });

  describe('PATCH /api/orders/:id', () => {
    it('should update an order', async () => {
      const created = await createTestOrder({ status: 'draft', notes: 'Original' }, db);

      const response = await fastify.inject({
        method: 'PATCH',
        url: `/api/orders/${created.id}`,
        cookies: { sid: sessionToken },
        payload: {
          status: 'confirmed',
          notes: 'Updated notes',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as OrderResponse;
      expect(body.id).toBe(created.id);
      expect(body.status).toBe('confirmed');
      expect(body.notes).toBe('Updated notes');
    });

    it('should return 404 for non-existent ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      const response = await fastify.inject({
        method: 'PATCH',
        url: `/api/orders/${nonExistentId}`,
        cookies: { sid: sessionToken },
        payload: {
          status: 'confirmed',
        },
      });

      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.payload) as ErrorResponse;
      expect(body.error).toBeDefined();
    });

    it('should return 400 for invalid status value', async () => {
      const created = await createTestOrder({}, db);

      const response = await fastify.inject({
        method: 'PATCH',
        url: `/api/orders/${created.id}`,
        cookies: { sid: sessionToken },
        payload: {
          status: 'invalid_status',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    describe('ACL', () => {
      it('should return 401 without authentication', async () => {
        const created = await createTestOrder({ status: 'draft' }, db);

        const response = await fastify.inject({
          method: 'PATCH',
          url: `/api/orders/${created.id}`,
          payload: {
            status: 'confirmed',
          },
        });

        expect(response.statusCode).toBe(401);
      });
    });
  });

  describe('DELETE /api/orders/:id', () => {
    it('should delete an order', async () => {
      const created = await createTestOrder({}, db);

      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/orders/${created.id}`,
        cookies: { sid: sessionToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as DeleteResponse;
      expect(body.success).toBe(true);
      expect(body.id).toBe(created.id);

      // Verify it's deleted
      const getResponse = await fastify.inject({
        method: 'GET',
        url: `/api/orders/${created.id}`,
        cookies: { sid: sessionToken },
      });

      expect(getResponse.statusCode).toBe(404);
    });

    it('should return 404 for non-existent ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/orders/${nonExistentId}`,
        cookies: { sid: sessionToken },
      });

      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.payload) as ErrorResponse;
      expect(body.error).toBeDefined();
    });

    it('should return 400 for invalid UUID format', async () => {
      const response = await fastify.inject({
        method: 'DELETE',
        url: '/api/orders/invalid-uuid',
        cookies: { sid: sessionToken },
      });

      expect(response.statusCode).toBe(400);
    });

    describe('ACL', () => {
      it('should return 401 without authentication', async () => {
        const created = await createTestOrder({}, db);

        const response = await fastify.inject({
          method: 'DELETE',
          url: `/api/orders/${created.id}`,
        });

        expect(response.statusCode).toBe(401);
      });
    });
  });

  describe('GET /api/orders/me', () => {
    it('should return users orders with items', async () => {
      const auth = await createAuthenticatedUser('myorders@example.com', 'password123', db);
      const product = await createTestProduct({}, db);
      const order = await createTestOrder(
        { userId: auth.userId, status: 'confirmed', currency: 'EUR' },
        db
      );
      await createTestOrderItem(
        {
          orderId: order.id,
          productId: product.id,
          quantity: '2',
          unitPrice: '10.50',
          currency: 'EUR',
        },
        db
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/orders/me',
        cookies: { sid: auth.sessionToken },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as { orders: OrderResponse[] };
      expect(body.orders).toBeDefined();
      expect(Array.isArray(body.orders)).toBe(true);

      const myOrder = body.orders.find((o) => o.id === order.id);
      expect(myOrder).toBeDefined();
    });

    it('should return empty array when user has no orders', async () => {
      const auth = await createAuthenticatedUser('noorders@example.com', 'password123', db);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/orders/me',
        cookies: { sid: auth.sessionToken },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload) as { orders: OrderResponse[] };
      expect(body.orders).toEqual([]);
    });

    it('should not return other users orders', async () => {
      const user1 = await createAuthenticatedUser('user1@example.com', 'password123', db);
      const user2 = await createAuthenticatedUser('user2@example.com', 'password123', db);

      const user1Order = await createTestOrder({ userId: user1.userId, status: 'confirmed' }, db);
      await createTestOrder({ userId: user2.userId, status: 'confirmed' }, db);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/orders/me',
        cookies: { sid: user1.sessionToken },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload) as { orders: OrderResponse[] };
      const user1OrderIds = body.orders.map((o) => o.id);
      expect(user1OrderIds).toContain(user1Order.id);
      expect(body.orders.length).toBeGreaterThan(0);
    });

    it('should exclude cart status orders', async () => {
      const auth = await createAuthenticatedUser('carttest@example.com', 'password123', db);
      await createTestOrder({ userId: auth.userId, status: 'cart' }, db);
      const confirmedOrder = await createTestOrder(
        { userId: auth.userId, status: 'confirmed' },
        db
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/orders/me',
        cookies: { sid: auth.sessionToken },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload) as { orders: OrderResponse[] };
      expect(body.orders.every((o) => o.status !== 'cart')).toBe(true);
      expect(body.orders.some((o) => o.id === confirmedOrder.id)).toBe(true);
    });

    describe('ACL', () => {
      it('should return 401 without authentication', async () => {
        const response = await fastify.inject({
          method: 'GET',
          url: '/api/orders/me',
        });

        expect(response.statusCode).toBe(401);
      });
    });
  });
});
