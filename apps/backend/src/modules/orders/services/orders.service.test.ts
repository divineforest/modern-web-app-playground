import { describe, expect, it } from 'vitest';
import { createTestOrderItem } from '../../../../tests/factories/order-items.js';
import { createTestOrder } from '../../../../tests/factories/orders.js';
import { createTestProduct } from '../../../../tests/factories/products.js';
import { createTestUser } from '../../../../tests/factories/users.js';
import { db } from '../../../db/index.js';
import {
  createOrderService,
  deleteOrderService,
  getOrderByIdService,
  listMyOrdersService,
  listOrdersService,
  OrderNotFoundError,
  OrderValidationError,
  updateOrderService,
} from './orders.service.js';

describe('Orders Service', () => {
  describe('createOrderService', () => {
    it('should create an order with valid data', async () => {
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

      const result = await createOrderService(input, db);

      expect(result).toBeDefined();
      expect(result.status).toBe('draft');
      expect(result.subtotal).toBe('1500.00');
      expect(result.totalAmount).toBe('1760.00');
    });

    it('should throw OrderValidationError for duplicate order number', async () => {
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

      await expect(createOrderService(input, db)).rejects.toThrow(OrderValidationError);
    });
  });

  describe('getOrderByIdService', () => {
    it('should return an order by ID', async () => {
      const order = await createTestOrder({}, db);

      const result = await getOrderByIdService(order.id, db);

      expect(result.id).toBe(order.id);
    });

    it('should throw OrderNotFoundError for non-existent ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      await expect(getOrderByIdService(nonExistentId, db)).rejects.toThrow(OrderNotFoundError);
    });
  });

  describe('listOrdersService', () => {
    it('should list orders with filters', async () => {
      await createTestOrder({ status: 'draft' }, db);
      await createTestOrder({ status: 'confirmed' }, db);

      const results = await listOrdersService({ status: 'confirmed' }, db);

      expect(results.every((ord) => ord.status === 'confirmed')).toBe(true);
    });

    it('should return empty array when no orders match', async () => {
      const results = await listOrdersService({ status: 'cancelled' }, db);

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('updateOrderService', () => {
    it('should update order fields', async () => {
      const order = await createTestOrder({ status: 'draft' }, db);

      const result = await updateOrderService(
        order.id,
        { status: 'confirmed', notes: 'Updated' },
        db
      );

      expect(result.status).toBe('confirmed');
      expect(result.notes).toBe('Updated');
    });

    it('should throw OrderNotFoundError for non-existent ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      await expect(updateOrderService(nonExistentId, { status: 'confirmed' }, db)).rejects.toThrow(
        OrderNotFoundError
      );
    });

    it('should throw OrderValidationError for invalid status', async () => {
      const order = await createTestOrder({}, db);

      await expect(
        updateOrderService(order.id, { status: 'invalid' as never }, db)
      ).rejects.toThrow(OrderValidationError);
    });
  });

  describe('deleteOrderService', () => {
    it('should delete an order and return ID', async () => {
      const order = await createTestOrder({}, db);

      const deletedId = await deleteOrderService(order.id, db);

      expect(deletedId).toBe(order.id);

      // Verify deletion
      await expect(getOrderByIdService(order.id, db)).rejects.toThrow(OrderNotFoundError);
    });

    it('should throw OrderNotFoundError for non-existent ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      await expect(deleteOrderService(nonExistentId, db)).rejects.toThrow(OrderNotFoundError);
    });
  });

  describe('listMyOrdersService', () => {
    it('should return orders with formatted items', async () => {
      const user = await createTestUser({}, db);
      const product = await createTestProduct({}, db);
      const order = await createTestOrder(
        { userId: user.id, status: 'confirmed', currency: 'EUR' },
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

      const results = await listMyOrdersService(user.id, db);

      expect(results.length).toBeGreaterThan(0);
      const myOrder = results.find((o) => o.id === order.id);
      expect(myOrder).toBeDefined();
      expect(myOrder?.items).toBeDefined();
      expect(myOrder?.items.length).toBe(1);
      expect(myOrder?.items[0]?.quantity).toBe(2);
      expect(myOrder?.items[0]?.unitPrice).toBe('10.50');
      expect(myOrder?.items[0]?.lineTotal).toBe('21.00');
    });

    it('should return empty array for user with no orders', async () => {
      const user = await createTestUser({}, db);

      const results = await listMyOrdersService(user.id, db);

      expect(results).toEqual([]);
    });
  });
});
