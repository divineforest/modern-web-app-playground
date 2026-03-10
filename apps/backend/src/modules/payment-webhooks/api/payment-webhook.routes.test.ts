import type Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestApp } from '../../../app.js';

vi.mock('../../../shared/workflows/index.js', async () => {
  const actual = await vi.importActual<typeof import('../../../shared/workflows/index.js')>(
    '../../../shared/workflows/index.js'
  );
  return {
    ...actual,
    createTemporalClient: vi.fn(() =>
      Promise.resolve({
        workflow: {
          start: vi.fn(() =>
            Promise.resolve({
              workflowId: 'test-workflow-id',
            })
          ),
        },
      })
    ),
  };
});

const mockConstructEvent = vi.fn();

vi.mock('stripe', () => {
  class MockStripe {
    webhooks = {
      constructEvent: mockConstructEvent,
    };
  }

  return {
    default: MockStripe,
  };
});

describe('Payment Webhook Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 when stripe-signature header is missing', async () => {
    const app = await buildTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/webhooks/payments',
      payload: { test: 'data' },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      success: false,
      error: 'Invalid webhook signature',
    });

    await app.close();
  });

  it('should return 400 when signature verification fails', async () => {
    const app = await buildTestApp();

    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/webhooks/payments',
      headers: {
        'stripe-signature': 'invalid_signature',
      },
      payload: { test: 'data' },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      success: false,
      error: 'Invalid webhook signature',
    });

    await app.close();
  });

  it('should return 200 for unhandled event types', async () => {
    const app = await buildTestApp();

    const mockEvent: Stripe.Event = {
      id: 'evt_test_123',
      object: 'event',
      type: 'payment_intent.created',
      data: {
        object: {},
      },
    } as Stripe.Event;

    mockConstructEvent.mockReturnValue(mockEvent);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/webhooks/payments',
      headers: {
        'stripe-signature': 'valid_signature',
      },
      payload: { test: 'data' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      success: true,
      message: 'Event type not handled',
    });

    await app.close();
  });

  it('should return 200 when payment is not completed', async () => {
    const app = await buildTestApp();

    const mockEvent: Stripe.Event = {
      id: 'evt_test_123',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          payment_status: 'unpaid',
        } as Stripe.Checkout.Session,
      },
    } as Stripe.Event;

    mockConstructEvent.mockReturnValue(mockEvent);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/webhooks/payments',
      headers: {
        'stripe-signature': 'valid_signature',
      },
      payload: { test: 'data' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      success: true,
      message: 'Payment not completed',
    });

    await app.close();
  });

  it('should process valid checkout.session.completed event', async () => {
    const app = await buildTestApp();

    const mockEvent: Stripe.Event = {
      id: 'evt_test_123',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          payment_status: 'paid',
          client_reference_id: 'ORD-12345',
          payment_intent: 'pi_test_456',
        } as Stripe.Checkout.Session,
      },
    } as Stripe.Event;

    mockConstructEvent.mockReturnValue(mockEvent);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/webhooks/payments',
      headers: {
        'stripe-signature': 'valid_signature',
      },
      payload: { test: 'data' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      success: true,
      eventId: 'evt_test_123',
    });

    await app.close();
  });

  it('should handle missing client_reference_id gracefully', async () => {
    const app = await buildTestApp();

    const mockEvent: Stripe.Event = {
      id: 'evt_test_123',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          payment_status: 'paid',
          client_reference_id: null,
          payment_intent: 'pi_test_456',
        } as Stripe.Checkout.Session,
      },
    } as Stripe.Event;

    mockConstructEvent.mockReturnValue(mockEvent);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/webhooks/payments',
      headers: {
        'stripe-signature': 'valid_signature',
      },
      payload: { test: 'data' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      success: true,
      message: 'Missing client_reference_id',
    });

    await app.close();
  });
});
