import { describe, expect, it } from 'vitest';
import { createTestOrder } from '../../../../tests/factories/orders.js';
import { db } from '../../../db/index.js';
import { findOrderByOrderNumber, markOrderAsPaid } from './orders-payment.repository.js';

describe('Orders Payment Repository', () => {
  describe('findOrderByOrderNumber', () => {
    it('should find an order by order number', async () => {
      const orderNumber = `ORD-${Date.now()}`;
      const order = await createTestOrder({ orderNumber }, db);

      const result = await findOrderByOrderNumber(orderNumber, db);

      expect(result).toBeDefined();
      expect(result?.id).toBe(order.id);
      expect(result?.orderNumber).toBe(orderNumber);
    });

    it('should return null when order number does not exist', async () => {
      const result = await findOrderByOrderNumber('NON-EXISTENT-ORDER', db);

      expect(result).toBeNull();
    });
  });

  describe('markOrderAsPaid', () => {
    it('should mark an order as paid', async () => {
      const order = await createTestOrder({ status: 'confirmed' }, db);
      const paymentTransactionId = 'pi_test_12345';

      const result = await markOrderAsPaid(order.id, paymentTransactionId, db);

      expect(result).toBeDefined();
      expect(result?.status).toBe('paid');
      expect(result?.paidAt).toBeInstanceOf(Date);
      expect(result?.paymentTransactionId).toBe(paymentTransactionId);
    });

    it('should return null when order does not exist', async () => {
      const result = await markOrderAsPaid('00000000-0000-0000-0000-000000000000', 'pi_test', db);

      expect(result).toBeNull();
    });

    it('should handle marking an already paid order', async () => {
      const firstPaymentId = 'pi_test_first';
      const secondPaymentId = 'pi_test_second';

      const order = await createTestOrder({ status: 'confirmed' }, db);

      await markOrderAsPaid(order.id, firstPaymentId, db);
      const result = await markOrderAsPaid(order.id, secondPaymentId, db);

      expect(result).toBeDefined();
      expect(result?.status).toBe('paid');
      expect(result?.paymentTransactionId).toBe(secondPaymentId);
    });
  });
});
