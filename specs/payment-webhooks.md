# Payment Webhooks

## Overview

This feature handles incoming payment provider webhook events to automatically mark orders as paid. The initial implementation supports Stripe. When a Stripe Checkout session completes with a successful payment, the system receives a webhook, verifies its authenticity using Stripe's signature mechanism, and updates the corresponding order. Events are processed reliably in the background to ensure no webhook delivery is lost.

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

## Functional Requirements

### FR-1: Receive Webhook

- The system SHALL expose a webhook endpoint at `POST /api/v2/webhooks/payments`
- The system SHALL verify the Stripe signature using the `stripe-signature` header and the configured webhook secret
- The system SHALL provide access to the raw request body, as Stripe signature verification requires it
- The system SHALL reject requests with invalid or missing signatures (400)
- The system SHALL return 200 immediately after queuing the event for background processing
- The system SHALL return 500 on internal errors so Stripe retries the delivery

### FR-2: Process Payment Event

- The system SHALL handle `checkout.session.completed` events where `payment_status` is `paid`
- The system SHALL extract the order reference from the Checkout Session's `client_reference_id` field
- The system SHALL ignore events that don't match the handled type (return 200, no processing)
- The system SHALL process qualifying events via a Temporal workflow for reliable execution and automatic retries

### FR-3: Update Order Status

- The system SHALL look up the order by `orderNumber` matching the `client_reference_id`
- The system SHALL update the order status to `paid`
- The system SHALL record `paidAt` timestamp when marking as paid
- The system SHALL store the Stripe Payment Intent ID in `paymentTransactionId`
- The system SHALL skip processing if the order is already in `paid` status (idempotent)
- The system SHALL log a warning and skip if no matching order is found

### FR-4: Idempotency

- The system SHALL use the Stripe event ID as the Temporal workflow ID to deduplicate webhook deliveries
- The system SHALL handle duplicate webhook deliveries gracefully (no side effects on replay)

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

- The system SHALL place all payment webhook code in `apps/backend/src/modules/payment-webhooks/`
- The system SHALL colocate tests with source files

### TR-2: Configuration

- The system SHALL require `STRIPE_WEBHOOK_SECRET` environment variable

## API Specification

### Receive Payment Event

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

## Error Handling

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
