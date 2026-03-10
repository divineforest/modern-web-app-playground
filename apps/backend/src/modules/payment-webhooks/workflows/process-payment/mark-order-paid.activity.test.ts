import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestOrder } from '../../../../../tests/factories/orders.js';
import { db } from '../../../../db/index.js';
import { markOrderPaidActivity } from './index.js';
import type { PaymentWebhookInput } from './payment-webhook.workflow.js';

vi.mock('@temporalio/activity', () => ({
  Context: {
    current: vi.fn(() => ({
      log: {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
      },
    })),
  },
}));

describe('Mark Order Paid Activity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should mark order as paid when order exists', async () => {
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const order = await createTestOrder({ orderNumber, status: 'confirmed' }, db);

    const input: PaymentWebhookInput = {
      eventId: 'evt_test_123',
      clientReferenceId: orderNumber,
      paymentIntentId: 'pi_test_456',
    };

    await markOrderPaidActivity(input);

    const updatedOrder = await db.query.orders.findFirst({
      where: (orders, { eq }) => eq(orders.id, order.id),
    });

    expect(updatedOrder).toBeDefined();
    expect(updatedOrder?.status).toBe('paid');
    expect(updatedOrder?.paidAt).toBeInstanceOf(Date);
    expect(updatedOrder?.paymentTransactionId).toBe('pi_test_456');
  });

  it('should skip processing if order not found', async () => {
    const input: PaymentWebhookInput = {
      eventId: 'evt_test_123',
      clientReferenceId: 'NON-EXISTENT-ORDER',
      paymentIntentId: 'pi_test_456',
    };

    await expect(markOrderPaidActivity(input)).resolves.not.toThrow();
  });

  it('should skip processing if order already paid', async () => {
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const firstPaymentId = 'pi_test_first';
    const order = await createTestOrder(
      {
        orderNumber,
        status: 'paid',
        paidAt: new Date(),
        paymentTransactionId: firstPaymentId,
      },
      db
    );

    const input: PaymentWebhookInput = {
      eventId: 'evt_test_123',
      clientReferenceId: orderNumber,
      paymentIntentId: 'pi_test_second',
    };

    await markOrderPaidActivity(input);

    const unchangedOrder = await db.query.orders.findFirst({
      where: (orders, { eq }) => eq(orders.id, order.id),
    });

    expect(unchangedOrder).toBeDefined();
    expect(unchangedOrder?.status).toBe('paid');
    expect(unchangedOrder?.paymentTransactionId).toBe(firstPaymentId);
  });
});
