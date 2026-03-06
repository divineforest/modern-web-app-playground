import { describe, expect, it } from 'vitest';
import { createTestOrder } from '../../../../tests/factories/orders.js';
import { createTestUser } from '../../../../tests/factories/users.js';
import { db } from '../../../db/index.js';
import {
  createOrder,
  deleteOrder,
  findAllOrders,
  findOrderById,
  findOrdersByUserId,
  updateOrder,
} from './orders.repository.js';

describe('Orders Repository', () => {
  describe('createOrder', () => {
    it('should create an order with valid data', async () => {
      // ARRANGE
      const orderData = {
        status: 'draft' as const,
        orderNumber: `ORD-${Date.now()}`,
        orderDate: '2024-01-15',
        currency: 'EUR',
        subtotal: '1500.00',
        taxAmount: '285.00',
        discountAmount: '50.00',
        shippingAmount: '25.00',
        totalAmount: '1760.00',
      };

      // ACT
      const result = await createOrder(orderData, db);

      // ASSERT
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.status).toBe('draft');
      expect(result.orderNumber).toBe(orderData.orderNumber);
      expect(result.currency).toBe('EUR');
      expect(result.subtotal).toBe('1500.00');
      expect(result.totalAmount).toBe('1760.00');
    });

    it('should set default status to draft when not provided', async () => {
      // ARRANGE
      const orderData = {
        orderNumber: `ORD-${Date.now()}`,
        orderDate: '2024-01-15',
        currency: 'USD',
        subtotal: '2500.00',
        totalAmount: '2500.00',
      };

      // ACT
      const result = await createOrder(orderData, db);

      // ASSERT
      expect(result.status).toBe('draft');
    });
  });

  describe('findOrderById', () => {
    it('should find an existing order', async () => {
      // ARRANGE
      const order = await createTestOrder({}, db);

      // ACT
      const result = await findOrderById(order.id, db);

      // ASSERT
      expect(result).toBeDefined();
      expect(result?.id).toBe(order.id);
      expect(result?.orderNumber).toBe(order.orderNumber);
    });

    it('should return null for non-existent order', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT
      const result = await findOrderById(nonExistentId, db);

      // ASSERT
      expect(result).toBeNull();
    });
  });

  describe('findAllOrders', () => {
    it('should return all orders ordered by order date (newest first)', async () => {
      // ARRANGE
      const order1 = await createTestOrder({ orderDate: '2024-01-01' }, db);
      const order2 = await createTestOrder({ orderDate: '2024-02-01' }, db);

      // ACT
      const results = await findAllOrders({}, db);

      // ASSERT
      expect(results.length).toBeGreaterThanOrEqual(2);
      const order2Index = results.findIndex((o) => o.id === order2.id);
      const order1Index = results.findIndex((o) => o.id === order1.id);
      // Newest first
      expect(order2Index).toBeLessThan(order1Index);
    });

    it('should filter by status', async () => {
      // ARRANGE
      await createTestOrder({ status: 'draft' }, db);
      await createTestOrder({ status: 'confirmed' }, db);

      // ACT
      const results = await findAllOrders({ status: 'confirmed' }, db);

      // ASSERT
      expect(results.every((ord) => ord.status === 'confirmed')).toBe(true);
    });
  });

  describe('updateOrder', () => {
    it('should update order fields', async () => {
      // ARRANGE
      const order = await createTestOrder({ status: 'draft' }, db);

      // ACT
      const result = await updateOrder(
        order.id,
        { status: 'confirmed', notes: 'Updated notes' },
        db
      );

      // ASSERT
      expect(result).toBeDefined();
      expect(result?.status).toBe('confirmed');
      expect(result?.notes).toBe('Updated notes');
    });

    it('should return null for non-existent order', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT
      const result = await updateOrder(nonExistentId, { status: 'confirmed' }, db);

      // ASSERT
      expect(result).toBeNull();
    });

    it('should update updatedAt timestamp', async () => {
      // ARRANGE
      const order = await createTestOrder({}, db);
      const originalUpdatedAt = order.updatedAt;

      // Wait a moment to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      // ACT
      const result = await updateOrder(order.id, { notes: 'New notes' }, db);

      // ASSERT
      expect(result?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('deleteOrder', () => {
    it('should delete an existing order', async () => {
      // ARRANGE
      const order = await createTestOrder({}, db);

      // ACT
      const deleted = await deleteOrder(order.id, db);

      // ASSERT
      expect(deleted).toBe(true);

      const result = await findOrderById(order.id, db);
      expect(result).toBeNull();
    });

    it('should return false for non-existent order', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT
      const deleted = await deleteOrder(nonExistentId, db);

      // ASSERT
      expect(deleted).toBe(false);
    });
  });

  describe('findOrdersByUserId', () => {
    it('should return orders for the given user', async () => {
      // ARRANGE
      const user = await createTestUser({}, db);
      const order1 = await createTestOrder({ userId: user.id, status: 'confirmed' }, db);
      const order2 = await createTestOrder({ userId: user.id, status: 'fulfilled' }, db);

      // ACT
      const results = await findOrdersByUserId(user.id, db);

      // ASSERT
      const orderIds = results.map((o) => o.id);
      expect(orderIds).toContain(order1.id);
      expect(orderIds).toContain(order2.id);
      expect(results.every((o) => o.userId === user.id)).toBe(true);
    });

    it('should exclude orders with status cart', async () => {
      // ARRANGE
      const user = await createTestUser({}, db);
      await createTestOrder({ userId: user.id, status: 'cart' }, db);
      const confirmedOrder = await createTestOrder({ userId: user.id, status: 'confirmed' }, db);

      // ACT
      const results = await findOrdersByUserId(user.id, db);

      // ASSERT
      expect(results.every((o) => o.status !== 'cart')).toBe(true);
      expect(results.some((o) => o.id === confirmedOrder.id)).toBe(true);
    });

    it('should not return other users orders', async () => {
      // ARRANGE
      const user1 = await createTestUser({}, db);
      const user2 = await createTestUser({}, db);
      await createTestOrder({ userId: user1.id, status: 'confirmed' }, db);
      const user2Order = await createTestOrder({ userId: user2.id, status: 'confirmed' }, db);

      // ACT
      const results = await findOrdersByUserId(user2.id, db);

      // ASSERT
      expect(results.every((o) => o.userId === user2.id)).toBe(true);
      expect(results.some((o) => o.id === user2Order.id)).toBe(true);
    });

    it('should order by order date descending', async () => {
      // ARRANGE
      const user = await createTestUser({}, db);
      const oldOrder = await createTestOrder(
        { userId: user.id, status: 'confirmed', orderDate: '2024-01-01' },
        db
      );
      const newOrder = await createTestOrder(
        { userId: user.id, status: 'confirmed', orderDate: '2024-02-01' },
        db
      );

      // ACT
      const results = await findOrdersByUserId(user.id, db);

      // ASSERT
      const newIndex = results.findIndex((o) => o.id === newOrder.id);
      const oldIndex = results.findIndex((o) => o.id === oldOrder.id);
      expect(newIndex).toBeLessThan(oldIndex);
    });

    it('should return empty array when user has no orders', async () => {
      // ARRANGE
      const user = await createTestUser({}, db);

      // ACT
      const results = await findOrdersByUserId(user.id, db);

      // ASSERT
      expect(results).toEqual([]);
    });
  });
});
