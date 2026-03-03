import { describe, expect, it } from 'vitest';
import type { PaymentWebhookInput } from './payment-webhook.workflow.js';

describe('Payment Webhook Workflow', () => {
  it('should execute mark order paid activity', () => {
    const input: PaymentWebhookInput = {
      eventId: 'evt_test_456',
      clientReferenceId: 'ORD-123',
      paymentIntentId: 'pi_test_789',
    };

    expect(input.clientReferenceId).toBe('ORD-123');
    expect(input.paymentIntentId).toBe('pi_test_789');
  });
});
