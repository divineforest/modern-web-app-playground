import { describe, expect, it } from 'vitest';
import { createTestOrder } from '../../../../tests/factories/orders.js';
import { db } from '../../../db/index.js';
import {
  createOrderService,
  deleteOrderService,
  getOrderByIdService,
  listOrdersService,
  OrderNotFoundError,
  OrderValidationError,
  updateOrderService,
} from './orders.service.js';

describe('Orders Service', () => {
  describe('createOrderService', () => {
    it('should create an order with valid data', async () => {
      // ARRANGE
      const input = {
        status: 'draft' as const,
        orderNumber: `ORD-${Date.now()}`,
        orderDate: '2024-01-15',
        currency: 'EUR',
        subtotal: 1500,
        taxAmount: 285,
        discountAmount: 50,
        shippingAmount: 25,
        totalAmount: 1760,
      };

      // ACT
      const result = await createOrderService(input, db);

      // ASSERT
      expect(result).toBeDefined();
      expect(result.status).toBe('draft');
      expect(result.subtotal).toBe('1500.00');
      expect(result.totalAmount).toBe('1760.00');
    });

    it('should throw OrderValidationError for duplicate order number', async () => {
      // ARRANGE
      const orderNumber = `ORD-DUPLICATE-${Date.now()}`;
      await createTestOrder({ orderNumber }, db);

      const input = {
        status: 'draft' as const,
        orderNumber, // Same number
        orderDate: '2024-01-15',
        currency: 'EUR',
        subtotal: 1500,
        totalAmount: 1500,
      };

      // ACT & ASSERT
      await expect(createOrderService(input, db)).rejects.toThrow(OrderValidationError);
    });
  });

  describe('getOrderByIdService', () => {
    it('should return an order by ID', async () => {
      // ARRANGE
      const order = await createTestOrder({}, db);

      // ACT
      const result = await getOrderByIdService(order.id, db);

      // ASSERT
      expect(result.id).toBe(order.id);
    });

    it('should throw OrderNotFoundError for non-existent ID', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT & ASSERT
      await expect(getOrderByIdService(nonExistentId, db)).rejects.toThrow(OrderNotFoundError);
    });
  });

  describe('listOrdersService', () => {
    it('should list orders with filters', async () => {
      // ARRANGE
      await createTestOrder({ status: 'draft' }, db);
      await createTestOrder({ status: 'confirmed' }, db);

      // ACT
      const results = await listOrdersService({ status: 'confirmed' }, db);

      // ASSERT
      expect(results.every((ord) => ord.status === 'confirmed')).toBe(true);
    });

    it('should return empty array when no orders match', async () => {
      // ACT
      const results = await listOrdersService({ status: 'cancelled' }, db);

      // ASSERT
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('updateOrderService', () => {
    it('should update order fields', async () => {
      // ARRANGE
      const order = await createTestOrder({ status: 'draft' }, db);

      // ACT
      const result = await updateOrderService(
        order.id,
        { status: 'confirmed', notes: 'Updated' },
        db
      );

      // ASSERT
      expect(result.status).toBe('confirmed');
      expect(result.notes).toBe('Updated');
    });

    it('should throw OrderNotFoundError for non-existent ID', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT & ASSERT
      await expect(updateOrderService(nonExistentId, { status: 'confirmed' }, db)).rejects.toThrow(
        OrderNotFoundError
      );
    });

    it('should throw OrderValidationError for invalid status', async () => {
      // ARRANGE
      const order = await createTestOrder({}, db);

      // ACT & ASSERT
      await expect(
        updateOrderService(order.id, { status: 'invalid' as never }, db)
      ).rejects.toThrow(OrderValidationError);
    });
  });

  describe('deleteOrderService', () => {
    it('should delete an order and return ID', async () => {
      // ARRANGE
      const order = await createTestOrder({}, db);

      // ACT
      const deletedId = await deleteOrderService(order.id, db);

      // ASSERT
      expect(deletedId).toBe(order.id);

      // Verify deletion
      await expect(getOrderByIdService(order.id, db)).rejects.toThrow(OrderNotFoundError);
    });

    it('should throw OrderNotFoundError for non-existent ID', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT & ASSERT
      await expect(deleteOrderService(nonExistentId, db)).rejects.toThrow(OrderNotFoundError);
    });
  });
});
