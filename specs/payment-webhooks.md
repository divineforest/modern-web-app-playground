# Payment Webhooks

## Overview

When a customer completes a Stripe Checkout payment, Stripe sends a webhook event to the system. The system verifies the event's authenticity, identifies the corresponding order, and marks it as paid — all processed reliably in the background so no webhook delivery is lost. The initial implementation supports Stripe only.

## Goals and Non-Goals

### Goals

- Receive and verify Stripe webhook events
- Mark orders as paid when payment succeeds
- Record payment metadata (Stripe Payment Intent ID, timestamp)
- Ensure reliable background processing
- Prevent duplicate processing of the same event

### Non-Goals

- Initiating payments or creating Stripe Checkout sessions
- Handling refunds, disputes, or subscription events
- Managing Stripe customer records
- Payment reconciliation or reporting
- Retry logic for failed payments (handled by Stripe)

## Webhook Reception

Incoming webhooks are verified for authenticity before any processing:

- Stripe signs each webhook with the `stripe-signature` header
- The system verifies this signature against the configured webhook secret, using the raw request body
- Invalid or missing signatures are rejected immediately (400)
- Valid webhooks return 200 right away, after queuing the event for background processing
- Internal errors return 500 so Stripe retries the delivery

## Event Processing

Not all Stripe events trigger order updates:

- Only `checkout.session.completed` events where `payment_status` is `paid` are processed
- The order reference is extracted from the Checkout Session's `client_reference_id` field
- Unhandled event types are acknowledged (200) but not processed
- Qualifying events are processed via a Temporal workflow for reliable execution and automatic retries

## Order Update

When a qualifying payment event is processed:

- The order is looked up by `orderNumber` matching the `client_reference_id`
- The order status is updated to `paid`
- The `paidAt` timestamp is recorded
- The Stripe Payment Intent ID is stored in `paymentTransactionId`
- If the order is already `paid`, the update is skipped (idempotent)
- If no matching order is found, a warning is logged and processing completes without error

## Reliability and Idempotency

Webhook deliveries can arrive more than once. The system handles this gracefully:

- The Stripe event ID is used as the Temporal workflow ID, deduplicating repeated deliveries at the infrastructure level
- Even without deduplication, the order update itself is idempotent — re-processing a paid order has no side effects

## Data Model

### Order Entity

```typescript
{
  // ... existing fields ...
  status: "draft" | "confirmed" | "processing" | "shipped" | "fulfilled" | "paid" | "cancelled";
  paidAt: Date | null;                  // Auto-set when status becomes "paid"
  paymentTransactionId: string | null;  // Payment provider transaction ID (indexed), for reconciliation
}
```

## Technical Requirements

### TR-1: Module Organization

- All payment webhook code lives in `apps/backend/src/modules/payment-webhooks/`
- Tests are colocated with source files

### TR-2: Configuration

- Requires `STRIPE_WEBHOOK_SECRET` environment variable

### TR-3: API Endpoint

```
POST /api/v2/webhooks/payments
```

**Headers:**

- `stripe-signature` (required): Stripe webhook signature for verification
- `content-type`: `application/json`

**Request Body:** Stripe event payload (verified via signature).

**Response (200 OK):**

```json
{
  "success": true,
  "eventId": "evt_1234567890"
}
```

**Response (200 OK, ignored event):**

```json
{
  "success": true,
  "message": "Event type not handled"
}
```

**Response (400 Bad Request):**

```json
{
  "success": false,
  "error": "Invalid webhook signature"
}
```

### Error Handling

| Scenario | Behavior |
|---|---|
| Invalid or missing signature | Return 400, do not process |
| Unhandled event type | Return 200, no processing |
| Order not found | Log warning, complete successfully |
| Order already paid | Skip update, complete successfully |
| Temporal unavailable | Return 500, Stripe will retry |

## Testing Strategy

- Stripe signature verification must be tested (valid, invalid, missing)
- Event filtering must be tested (handled vs. ignored event types)
- Order status update must be tested (happy path, already paid, order not found)
- Idempotency must be tested (duplicate event delivery)
- Webhook endpoint integration tests with mocked Stripe signature

## Future Enhancements

- 🚧 Handle `payment_intent.succeeded` as alternative event type
- 🚧 Handle refund events (`charge.refunded`)
- 🚧 Store full Stripe event payload for audit trail
- 🚧 Webhook event log table for debugging and replay
- 🚧 Support for partial payments
