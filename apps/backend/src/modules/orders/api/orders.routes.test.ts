import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestOrder } from '../../../../tests/factories/orders.js';
import { buildTestApp } from '../../../app.js';
import { db } from '../../../db/index.js';

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

  // Test authentication token matching the configuration
  const authHeaders = {
    authorization: 'Bearer test_token_12345',
  };

  beforeEach(async () => {
    fastify = await buildTestApp();
  });

  afterEach(async () => {
    if (fastify) {
      await fastify.close();
    }
  });

  describe('POST /api/orders', () => {
    it('should create an order with valid data', async () => {
      // ARRANGE
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

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/orders',
        headers: authHeaders,
        payload: requestBody,
      });

      // ASSERT
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
      // ARRANGE
      const requestBody = {
        orderNumber: `ORD-${Date.now()}`,
        // Missing orderDate, currency, subtotal, totalAmount
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/orders',
        headers: authHeaders,
        payload: requestBody,
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
    });

    it('should return 409 for duplicate order number', async () => {
      // ARRANGE
      const orderNumber = `ORD-DUPLICATE-${Date.now()}`;
      await createTestOrder({ orderNumber }, db);

      const requestBody = {
        orderNumber, // Same number
        orderDate: '2024-01-15',
        currency: 'EUR',
        subtotal: 1500.0,
        totalAmount: 1500.0,
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/orders',
        headers: authHeaders,
        payload: requestBody,
      });

      // ASSERT
      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.payload) as ErrorResponse;
      expect(body.error).toContain('Duplicate');
    });

    describe('ACL', () => {
      it('should return 401 without authentication', async () => {
        // ARRANGE
        const requestBody = {
          orderNumber: `ORD-${Date.now()}`,
          orderDate: '2024-01-15',
          currency: 'EUR',
          subtotal: 1500.0,
          totalAmount: 1500.0,
        };

        // ACT
        const response = await fastify.inject({
          method: 'POST',
          url: '/api/orders',
          payload: requestBody,
        });

        // ASSERT
        expect(response.statusCode).toBe(401);
      });

      it('should return 401 with invalid token', async () => {
        // ARRANGE
        const requestBody = {
          orderNumber: `ORD-${Date.now()}`,
          orderDate: '2024-01-15',
          currency: 'EUR',
          subtotal: 1500.0,
          totalAmount: 1500.0,
        };

        // ACT
        const response = await fastify.inject({
          method: 'POST',
          url: '/api/orders',
          headers: {
            authorization: 'Bearer invalid_token',
          },
          payload: requestBody,
        });

        // ASSERT
        expect(response.statusCode).toBe(401);
        const body = JSON.parse(response.payload) as ErrorResponse;
        expect(body.message).toBe('Invalid authentication token');
      });
    });
  });

  describe('GET /api/orders/:id', () => {
    it('should get an order by ID', async () => {
      // ARRANGE
      const created = await createTestOrder({}, db);

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/orders/${created.id}`,
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as OrderResponse;
      expect(body.id).toBe(created.id);
      expect(body.orderNumber).toBe(created.orderNumber);
    });

    it('should return 404 for non-existent ID', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/orders/${nonExistentId}`,
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.payload) as ErrorResponse;
      expect(body.error).toBeDefined();
    });

    it('should return 400 for invalid UUID format', async () => {
      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/orders/invalid-uuid',
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
    });

    describe('ACL', () => {
      it('should return 401 without authentication', async () => {
        // ARRANGE
        const created = await createTestOrder({}, db);

        // ACT
        const response = await fastify.inject({
          method: 'GET',
          url: `/api/orders/${created.id}`,
        });

        // ASSERT
        expect(response.statusCode).toBe(401);
      });
    });
  });

  describe('GET /api/orders', () => {
    it('should list all orders', async () => {
      // ARRANGE
      await createTestOrder({}, db);
      await createTestOrder({}, db);

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/orders',
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as OrderListResponse;
      expect(body.orders).toBeDefined();
      expect(Array.isArray(body.orders)).toBe(true);
      expect(body.orders.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by status', async () => {
      // ARRANGE
      const draftOrder = await createTestOrder({ status: 'draft' }, db);
      const confirmedOrder = await createTestOrder({ status: 'confirmed' }, db);

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/orders?status=draft',
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload) as OrderListResponse;
      expect(body.orders.some((o) => o.id === draftOrder.id)).toBe(true);
      expect(body.orders.some((o) => o.id === confirmedOrder.id)).toBe(false);
    });

    it('should order by order date (newest first)', async () => {
      // ARRANGE
      const oldOrder = await createTestOrder({ orderDate: '2024-01-01' }, db);
      const newOrder = await createTestOrder({ orderDate: '2024-02-01' }, db);

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/orders',
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload) as OrderListResponse;
      const orderIds = body.orders.map((o) => o.id);
      const newIndex = orderIds.indexOf(newOrder.id);
      const oldIndex = orderIds.indexOf(oldOrder.id);
      expect(newIndex).toBeLessThan(oldIndex);
    });

    describe('ACL', () => {
      it('should return 401 without authentication', async () => {
        // ACT
        const response = await fastify.inject({
          method: 'GET',
          url: '/api/orders',
        });

        // ASSERT
        expect(response.statusCode).toBe(401);
      });
    });
  });

  describe('PATCH /api/orders/:id', () => {
    it('should update an order', async () => {
      // ARRANGE
      const created = await createTestOrder({ status: 'draft', notes: 'Original' }, db);

      // ACT
      const response = await fastify.inject({
        method: 'PATCH',
        url: `/api/orders/${created.id}`,
        headers: authHeaders,
        payload: {
          status: 'confirmed',
          notes: 'Updated notes',
        },
      });

      // ASSERT
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as OrderResponse;
      expect(body.id).toBe(created.id);
      expect(body.status).toBe('confirmed');
      expect(body.notes).toBe('Updated notes');
    });

    it('should return 404 for non-existent ID', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT
      const response = await fastify.inject({
        method: 'PATCH',
        url: `/api/orders/${nonExistentId}`,
        headers: authHeaders,
        payload: {
          status: 'confirmed',
        },
      });

      // ASSERT
      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.payload) as ErrorResponse;
      expect(body.error).toBeDefined();
    });

    it('should return 400 for invalid status value', async () => {
      // ARRANGE
      const created = await createTestOrder({}, db);

      // ACT
      const response = await fastify.inject({
        method: 'PATCH',
        url: `/api/orders/${created.id}`,
        headers: authHeaders,
        payload: {
          status: 'invalid_status',
        },
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
    });

    describe('ACL', () => {
      it('should return 401 without authentication', async () => {
        // ARRANGE
        const created = await createTestOrder({ status: 'draft' }, db);

        // ACT
        const response = await fastify.inject({
          method: 'PATCH',
          url: `/api/orders/${created.id}`,
          payload: {
            status: 'confirmed',
          },
        });

        // ASSERT
        expect(response.statusCode).toBe(401);
      });
    });
  });

  describe('DELETE /api/orders/:id', () => {
    it('should delete an order', async () => {
      // ARRANGE
      const created = await createTestOrder({}, db);

      // ACT
      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/orders/${created.id}`,
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as DeleteResponse;
      expect(body.success).toBe(true);
      expect(body.id).toBe(created.id);

      // Verify it's deleted
      const getResponse = await fastify.inject({
        method: 'GET',
        url: `/api/orders/${created.id}`,
        headers: authHeaders,
      });

      expect(getResponse.statusCode).toBe(404);
    });

    it('should return 404 for non-existent ID', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT
      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/orders/${nonExistentId}`,
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.payload) as ErrorResponse;
      expect(body.error).toBeDefined();
    });

    it('should return 400 for invalid UUID format', async () => {
      // ACT
      const response = await fastify.inject({
        method: 'DELETE',
        url: '/api/orders/invalid-uuid',
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
    });

    describe('ACL', () => {
      it('should return 401 without authentication', async () => {
        // ARRANGE
        const created = await createTestOrder({}, db);

        // ACT
        const response = await fastify.inject({
          method: 'DELETE',
          url: `/api/orders/${created.id}`,
        });

        // ASSERT
        expect(response.statusCode).toBe(401);
      });
    });
  });
});
