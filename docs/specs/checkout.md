# Checkout

## Overview

The checkout feature converts a cart into a confirmed order. An authenticated user with items in their cart provides shipping and billing addresses, then places the order. The system transitions the cart from `cart` status to `confirmed`, assigns a permanent order number, and records the addresses.

This is the first phase of the checkout flow — it does not include payment processing. Payment integration (Stripe Checkout) will be added as a future enhancement. The result of a successful checkout is a confirmed order visible on an order confirmation page.

The feature builds directly on the cart infrastructure: the cart (an order with `cart` status and associated order items) becomes the order itself, avoiding data duplication.

## Goals and Non-Goals

### Goals

- Allow authenticated users to check out their cart by providing shipping and billing addresses
- Transition the cart order from `cart` to `confirmed` status with a permanent order number
- Provide a checkout API endpoint that validates the cart and records addresses
- Deliver a Checkout page in the web application with address forms
- Deliver an Order Confirmation page showing the placed order details
- Enable the "Proceed to Checkout" button on the Cart page

### Non-Goals

- Payment processing (Stripe Checkout, payment forms) — future enhancement
- Guest checkout (unauthenticated users must sign in before checkout)
- Tax, shipping cost, or discount calculation (all remain zero for MVP)
- Address book or saved addresses
- Inventory/stock validation or reservation
- Order editing after checkout
- Email notifications (order confirmation email)
- Shipping method selection

## Functional Requirements

### FR-1: Checkout Eligibility

- The system SHALL require authentication to initiate checkout.
- The system SHALL reject checkout if the user has no cart or the cart is empty, returning an appropriate error.
- The system SHALL validate that all cart items still reference active products before completing checkout.
- If any product has become inactive since it was added to the cart, the system SHALL reject the checkout and indicate which items are no longer available.

### FR-2: Address Collection

- The system SHALL accept a shipping address and a billing address as part of the checkout request.
- Each address SHALL include the following fields: full name, address line 1, city, country code (ISO 3166-1 alpha-2), and postal code.
- Each address SHOULD accept optional fields: address line 2, state/province/region, and phone number.
- The system SHALL store the shipping address and billing address on the order.
- The system MAY accept a "billing same as shipping" flag; when true, the billing address SHALL be copied from the shipping address.

### FR-3: Order Placement

- The system SHALL transition the cart's status from `cart` to `confirmed`.
- The system SHALL replace the temporary cart order number (`CART-*`) with a permanent order number in the format `ORD-YYYYMMDD-XXXXX` where `XXXXX` is a zero-padded sequential number per day.
- The system SHALL set the order date to the current date at the time of checkout.
- The system SHALL clear the cart token on the order after checkout (it is no longer a cart).
- The system SHALL return the confirmed order details including the new order number.

### FR-4: Checkout Atomicity

- The entire checkout operation (product validation, order number generation, status transition, address storage) SHALL execute within a single database transaction.
- If any step fails, no changes SHALL be persisted.

### FR-5: Idempotency

- If the user submits checkout for an order that is already `confirmed` (e.g., double-click, network retry), the system SHALL return the existing confirmed order rather than an error.
- The system SHALL NOT allow checkout on orders in any status other than `cart` or `confirmed`.

### FR-6: Checkout Page (Web Application)

- The Checkout page SHALL be accessible at `/checkout`.
- The Checkout page SHALL display an order summary showing: each item's product name, quantity, unit price, and line total, plus the cart subtotal.
- The Checkout page SHALL present a shipping address form and a billing address form.
- The Checkout page SHALL provide a "Same as shipping address" checkbox for the billing address; when checked, the billing fields SHALL be auto-filled and disabled.
- The Checkout page SHALL validate required address fields client-side before submission.
- The Checkout page SHALL display a "Place Order" button that submits the checkout request.
- The "Place Order" button SHALL be disabled while the request is in flight to prevent double submission.
- On success, the Checkout page SHALL redirect to the Order Confirmation page.
- On validation errors, the Checkout page SHALL display field-level error messages.
- If the cart is empty or missing, the Checkout page SHALL redirect to the Cart page.

### FR-7: Order Confirmation Page (Web Application)

- The Order Confirmation page SHALL be accessible at `/orders/:orderNumber/confirmation`.
- The page SHALL display: order number, order date, order status, shipping address, billing address, item list with quantities and prices, and the order total.
- The page SHALL include a "Continue Shopping" link back to the product catalog.
- If the order number is invalid or not found, the page SHALL display an appropriate error state.

### FR-8: Cart Page Update

- The "Proceed to Checkout" button on the Cart page SHALL be enabled and navigate to `/checkout`.
- The button SHALL only be visible to authenticated users.
- Unauthenticated users SHALL see a "Sign in to checkout" prompt instead.

## Technical Requirements

### TR-1: Address Storage

- Addresses SHALL be stored as JSON in the existing `shipping_address` and `billing_address` text columns on the `orders` table.
- Address JSON structure:

  | Field | Type | Required |
  |-------|------|----------|
  | full name | string | yes |
  | address line 1 | string | yes |
  | address line 2 | string | no |
  | city | string | yes |
  | state | string | no |
  | postal code | string | yes |
  | country code | string (ISO 3166-1 alpha-2) | yes |
  | phone | string | no |

- The system SHALL validate the address structure using a Zod schema in the API contract.

### TR-2: Order Number Generation

- The order number format SHALL be `ORD-YYYYMMDD-XXXXX` (e.g., `ORD-20260305-00001`).
- The sequential counter SHALL reset daily.
- The system SHALL use a database query to determine the next sequence number: count existing orders with `ORD-YYYYMMDD-` prefix + 1.
- The unique index on `order_number` SHALL prevent duplicates under concurrent checkouts.
- If a duplicate order number conflict occurs, the system SHALL retry with an incremented sequence number (up to 3 retries).

### TR-3: Checkout API Design

- The checkout endpoint SHALL be under `/api/checkout`.
- Authentication SHALL be required (bearer token).

  | Method | Path | Description |
  |--------|------|-------------|
  | POST | `/api/checkout` | Place order from current cart |

- Request body SHALL include: shipping address, billing address, and an optional billing same as shipping flag.
- Success response SHALL return the confirmed order with order number, status, addresses, items, and totals.

### TR-4: Order Retrieval for Confirmation

- The system SHALL provide an endpoint to retrieve a confirmed order by order number for the confirmation page.
- This MAY reuse the existing orders API (`GET /api/orders/:id`) or provide a dedicated route.
- The response SHALL include order items, which the existing orders GET endpoint may need to be extended to return.

### TR-5: Checkout Module Structure

- The checkout feature SHALL be implemented as a new module at `modules/checkout/`.
- The module SHALL follow the standard module structure: `api/`, `services/`, `domain/`.
- The checkout module SHALL depend on the cart module (to find and validate the cart) and the orders table (to update the order).
- The checkout module SHOULD reuse the cart repository for cart lookups and the orders repository for order updates where practical.

### TR-6: Cart Context Update (Web Application)

- After successful checkout, the cart context SHALL be cleared (item count reset to zero) so the header cart badge reflects the empty state.
- The cart token in `localStorage` SHALL be cleared after checkout since the cart no longer exists.

## Data Flow

### Checkout (Place Order)

1. **Authenticated user** sends `POST /api/checkout` with shipping address and billing address.
2. **Checkout API handler** validates the request payload (address schemas).
3. **Checkout service** begins a database transaction.
4. **Checkout service** loads the user's cart (order with `cart` status) by user ID.
5. If no cart or cart is empty, the service returns an error.
6. **Checkout service** loads all cart items and validates that each referenced product is still `active`.
7. If any product is inactive, the service returns a validation error listing the affected items.
8. **Checkout service** generates a permanent order number (`ORD-YYYYMMDD-XXXXX`).
9. **Checkout service** updates the order: status → `confirmed`, order number → generated number, order date → today, shipping address → provided JSON, billing address → provided JSON, cart token → null.
10. **Checkout service** commits the transaction.
11. **Checkout API handler** returns the confirmed order with items and new order number.

### Checkout Page Flow (Web Application)

1. **Browser** navigates to `/checkout`.
2. **Checkout page** fetches the current cart via `GET /api/cart`.
3. If cart is empty or user is unauthenticated, redirect to `/cart`.
4. **User** fills in shipping and billing address forms.
5. **User** clicks "Place Order".
6. **Checkout page** sends `POST /api/checkout` with the address data.
7. On success, **browser** clears cart state (context + localStorage token) and redirects to `/orders/:orderNumber/confirmation`.
8. On failure, **Checkout page** displays validation errors inline.

### Order Confirmation Page Load

1. **Browser** navigates to `/orders/:orderNumber/confirmation`.
2. **Confirmation page** fetches the order details from the API.
3. **Confirmation page** renders order summary, addresses, and item list.

## Error Scenarios

| Scenario | Response |
|----------|----------|
| Unauthenticated user | HTTP 401 — "Authentication required" |
| No cart exists | HTTP 404 — "No active cart found" |
| Cart is empty | HTTP 422 — "Cart is empty" |
| Product became inactive | HTTP 422 — "The following items are no longer available: [product names]" |
| Invalid address (missing required fields) | HTTP 400 — validation error with field details |
| Invalid country code | HTTP 400 — "Invalid country code" |
| Order number generation conflict (exhausted retries) | HTTP 500 — "Unable to generate order number, please try again" |
| Order already confirmed (idempotent retry) | HTTP 200 — returns existing confirmed order |
| Order in non-checkout-eligible status | HTTP 422 — "Order cannot be checked out" |

## Security Considerations

- Authentication SHALL be required for all checkout operations.
- The system SHALL verify that the cart belongs to the authenticated user before proceeding.
- Address input SHALL be validated and sanitized via Zod schemas to prevent injection.
- The order confirmation page SHALL only display orders belonging to the authenticated user.

## Monitoring and Observability

- Log each successful checkout with user ID, order number, and item count.
- Log checkout failures with reason (empty cart, inactive products, address validation).
- 🚧 Track checkout conversion rate (carts created vs. orders placed).
- 🚧 Alert on elevated checkout failure rates.

## Testing and Validation

### Unit Tests

- Checkout service: successful checkout transitions cart to confirmed with correct order number
- Checkout service: rejects checkout when cart is empty
- Checkout service: rejects checkout when cart does not exist
- Checkout service: rejects checkout when product has become inactive
- Checkout service: idempotent behavior when order is already confirmed
- Checkout service: address validation (missing required fields, invalid country code)
- Checkout service: billing same as shipping copies address correctly
- Order number generation: sequential numbering within a day, daily reset

### Integration Tests

- Full API flow: add items to cart → checkout with addresses → verify order is confirmed
- Checkout with inactive product: add item → deactivate product → checkout fails
- Idempotency: checkout same cart twice → second call returns same order
- Concurrent checkouts: two simultaneous requests for different users → unique order numbers
- Unauthorized access: attempt to view another user's order confirmation → rejected

### Web Application Tests

- Checkout page renders order summary from cart
- Address forms validate required fields before submission
- "Same as shipping" checkbox copies and disables billing fields
- Successful checkout redirects to confirmation page
- Cart badge resets to zero after checkout
- Empty cart redirects to cart page
- Order confirmation page displays all order details

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Concurrent checkout for same user (double-click) | Duplicate orders or race condition | Database transaction + idempotency check (if already confirmed, return existing) |
| Product deactivated during checkout | Order placed with unavailable item | Validate product status inside the checkout transaction |
| Order number collision under high concurrency | Checkout failure | Retry with incremented sequence + unique index as safety net |
| Stale cart data shown on checkout page | User sees different prices than expected | Prices are locked at cart-add time; checkout page fetches fresh cart data |
| No payment means orders are confirmed but unpaid | Potential fulfillment of unpaid orders | Clearly display order status as "confirmed" (not "paid"); future payment feature will gate fulfillment |
