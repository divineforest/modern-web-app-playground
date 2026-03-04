# Cart

## Overview

The cart feature enables customers to browse the product catalog and collect items before purchasing. A cart is modeled as an order in `cart` status, reusing the existing orders infrastructure and allowing a natural transition to checkout (a future feature).

Both guest and authenticated users can manage carts. Guests receive a server-generated cart token to identify their session. When a guest later authenticates, their guest cart can be merged into their user account's cart.

The feature introduces an `order items` table to track individual line items — designed as a general-purpose table reusable by orders and checkout later. Product prices are locked at the time an item is added to the cart, ensuring price consistency for the customer.

A Cart page on the web application provides the user-facing interface for viewing, updating, and removing items.

## Goals and Non-Goals

### Goals

- Allow guests and authenticated users to add products to a persistent, database-backed cart
- Provide API endpoints for full cart lifecycle (add, view, update quantity, remove items, clear cart)
- Introduce a general-purpose order items table
- Deliver a Cart page in the web application with quantity controls, item removal, and price totals
- Support merging a guest cart into an authenticated user's cart

### Non-Goals

- Checkout flow (payment, order confirmation) — will be specced separately
- Inventory or stock enforcement
- Multi-currency carts (mixed currencies within a single cart)
- Coupon, discount, or promotion logic
- Saved/wishlisted items
- Cart sharing or collaborative carts

## Functional Requirements

### FR-1: Cart Creation

- The system SHALL create a cart (order with `cart` status) automatically when a user adds their first item.
- The system SHALL generate a unique cart token (UUID v4) for guest carts and return it in the response.
- The system SHALL associate the cart with the authenticated user's ID when a bearer token is provided.
- The system SHALL NOT require authentication to create or manage a cart.

### FR-2: Add Item to Cart

- The system SHALL accept a product ID and quantity when adding an item.
- The system SHALL validate that the product exists and has `active` status.
- The system SHALL reject items from products whose currency differs from the cart's currency.
- The system SHALL set the cart's currency from the first item added if the cart has no currency yet.
- The system SHALL lock the unit price to the product's current price at the time of addition.
- The system SHALL snapshot the product name and SKU at the time of addition.
- If the product already exists in the cart, the system SHALL update the quantity (add to existing) rather than create a duplicate row.
- The quantity SHALL be a positive integer, minimum 1.

### FR-3: View Cart

- The system SHALL return the cart with all its items, including: product ID, product name, SKU, unit price, quantity, line total (unit price × quantity), and product image URL.
- The system SHALL return cart-level totals: subtotal (sum of all line totals) and item count.
- The system SHALL return an empty cart representation (zero items, zero totals) when no cart exists, rather than an error.

### FR-4: Update Item Quantity

- The system SHALL allow updating the quantity of an existing cart item.
- The quantity SHALL be a positive integer, minimum 1.
- Setting quantity to zero is not allowed; use remove instead.
- The system SHALL recalculate line totals and cart subtotal after updates.

### FR-5: Remove Item from Cart

- The system SHALL allow removing a single item from the cart by item ID.
- The system SHOULD delete the cart (order record) when the last item is removed.

### FR-6: Clear Cart

- The system SHALL allow clearing all items from a cart in a single operation.
- The system SHALL delete the cart order record when cleared.

### FR-7: Guest Cart Identification

- The system SHALL identify guest carts via a cart token passed in the `x-cart-token` request header.
- The system SHALL return the cart token in the response header when a new guest cart is created.
- The system SHALL return HTTP 404 if a guest provides an invalid or expired cart token.

### FR-8: Guest-to-User Cart Merge

- When an authenticated user has an existing guest cart token, the system SHALL provide an endpoint to merge the guest cart into the user's cart.
- If the user already has a cart, items from the guest cart SHALL be merged: matching products have their quantities summed; new products are added.
- After merge, the guest cart SHALL be deleted.
- If the user has no existing cart, the guest cart SHALL be reassigned to the user (update user ID, clear cart token).

### FR-9: Cart Page (Web Application)

- The Cart page SHALL display a list of cart items showing: product image, product name, SKU, unit price, quantity, and line total.
- The Cart page SHALL provide increment/decrement controls to adjust item quantity.
- The Cart page SHALL provide a remove button for each item.
- The Cart page SHALL display a cart summary section with subtotal and total item count.
- The Cart page SHALL display an empty state with a message and a link to continue shopping when the cart has no items.
- The Cart page SHALL include a "Proceed to checkout" button (disabled until checkout is implemented).
- The Cart page SHALL persist the cart token in `localStorage` for guest users.
- The Cart page SHALL show optimistic updates for quantity changes and removals, reverting on failure.

## Technical Requirements

### TR-1: Order Status Extension

- The system SHALL add `cart` to the allowed order statuses.
- The `orders_status_check` constraint SHALL be updated to include `cart`.
- A database migration SHALL be generated for this change.

### TR-2: Order Table Extensions

- The `orders` table SHALL gain the following nullable columns:
  - `user_id` (UUID) — references the authenticated user who owns the cart/order
  - `cart_token` (UUID) — unique identifier for guest carts
- The system SHALL create a unique index on `cart_token` (filtered to non-null values).
- The system SHALL create an index on `user_id` for efficient user cart lookup.

### TR-3: Order Items Table

- The system SHALL create an `order_items` table with the following columns:

  | Column | Type | Constraints |
  |--------|------|-------------|
  | id | UUID | PK, default random |
  | order id | UUID | NOT NULL, FK to orders |
  | product id | UUID | NOT NULL, FK to products |
  | quantity | integer | NOT NULL, CHECK > 0 |
  | unit price | numeric(15,2) | NOT NULL |
  | currency | varchar(3) | NOT NULL |
  | product name | text | NOT NULL |
  | product sku | text | NOT NULL |
  | product image url | text | nullable |
  | created at | timestamptz | NOT NULL, default now |
  | updated at | timestamptz | NOT NULL, default now |

- The system SHALL create a unique index on (order id, product id) to prevent duplicate product rows.
- The system SHALL create an index on order id for efficient item retrieval.

### TR-4: Cart API Design

- Cart endpoints SHALL be under `/api/cart`.
- Guest identification SHALL use the `x-cart-token` request header.
- Authenticated users SHALL be identified by their bearer token; the `x-cart-token` header is ignored when authenticated.
- API contracts SHALL be defined via ts-rest.

  | Method | Path | Description |
  |--------|------|-------------|
  | GET | `/api/cart` | Get current cart with items |
  | POST | `/api/cart/items` | Add item to cart |
  | PATCH | `/api/cart/items/:itemId` | Update item quantity |
  | DELETE | `/api/cart/items/:itemId` | Remove item from cart |
  | DELETE | `/api/cart` | Clear entire cart |
  | POST | `/api/cart/merge` | Merge guest cart into user cart (auth required) |

### TR-5: Price Calculation

- Line totals SHALL be calculated as `unit_price × quantity`.
- Cart subtotal SHALL be calculated as the sum of all line totals.
- All monetary calculations SHALL use the `numeric(15,2)` precision to avoid floating-point errors.
- The `orders.subtotal` and `orders.total_amount` columns SHALL be updated whenever cart items change.

### TR-6: Cart Module Structure

- The cart feature SHALL be implemented as a new module at `modules/cart/`.
- The module SHALL follow the standard module structure: `api/`, `services/`, `repositories/`, `domain/`.
- The cart module SHALL depend on the orders and products tables but MAY reuse the orders repository for order-level operations.

### TR-7: Cart Token Security

- Cart tokens SHALL be UUID v4 values, cryptographically random.
- The system SHALL NOT expose other users' carts through token enumeration.
- Cart token lookup SHALL be constant-time (indexed) to prevent timing attacks.

## Data Flow

### Adding an Item to Cart (Guest)

1. **Guest** sends `POST /api/cart/items` with product ID, quantity, and optionally `x-cart-token` header.
2. **Cart API handler** validates the request payload.
3. **Cart service** checks for an existing cart via the cart token (if provided).
4. If no cart exists, **cart service** creates a new order with `cart` status and generates a cart token.
5. **Cart service** fetches the product from the **products table** to validate it exists, is active, and capture current price/name/SKU.
6. **Cart service** validates currency compatibility (first item sets the cart currency, subsequent items must match).
7. **Cart service** inserts or updates the order item in the **order items table** (upsert on order id + product id).
8. **Cart service** recalculates and updates the order's subtotal and total amount.
9. **Cart API handler** returns the updated cart with the cart token in the `x-cart-token` response header.

### Adding an Item to Cart (Authenticated User)

1. **Authenticated user** sends `POST /api/cart/items` with product ID and quantity (bearer token in `Authorization` header).
2. **Cart API handler** extracts user ID from the auth context.
3. **Cart service** looks up existing cart by user ID.
4. Steps 4–9 follow the same flow as the guest path, but the order is associated with user ID instead of a cart token.

### Merging Guest Cart into User Cart

1. **Authenticated user** sends `POST /api/cart/merge` with the guest cart token in the request body.
2. **Cart service** loads the guest cart and the user's existing cart.
3. If the user has no cart, **cart service** reassigns the guest cart: sets user ID, clears cart token.
4. If the user has a cart, **cart service** iterates guest cart items:
   - Matching products: sum quantities in the user's cart item.
   - New products: move items to the user's cart.
5. **Cart service** recalculates the user's cart totals.
6. **Cart service** deletes the guest cart order and its remaining items.
7. **Cart API handler** returns the merged user cart.

### Cart Page Load (Web Application)

1. **Browser** checks `localStorage` for a cart token (guest) or relies on auth cookie/token.
2. **Browser** sends `GET /api/cart` with appropriate identification.
3. **Cart API** returns cart data (items, totals) or empty cart representation.
4. **Cart page** renders item list, quantity controls, and summary.
5. User interactions (quantity change, remove) trigger optimistic UI updates followed by API calls.
6. On API failure, the **Cart page** reverts the optimistic update and shows an error notification.

## Error Scenarios

| Scenario | Response |
|----------|----------|
| Product not found | HTTP 404 — "Product not found" |
| Product not active | HTTP 422 — "Product is not available" |
| Currency mismatch (item vs cart) | HTTP 422 — "Product currency does not match cart currency" |
| Invalid quantity (≤ 0 or non-integer) | HTTP 400 — validation error |
| Cart item not found | HTTP 404 — "Cart item not found" |
| Invalid cart token | HTTP 404 — "Cart not found" |
| Merge without authentication | HTTP 401 — "Authentication required" |
| Merge with invalid guest token | HTTP 404 — "Guest cart not found" |

## Security Considerations

- Cart tokens SHALL be cryptographically random UUIDs to prevent guessing.
- Guest cart endpoints SHALL NOT leak information about other carts (no enumeration).
- The merge endpoint SHALL require authentication to prevent unauthorized cart takeover.
- Input validation (product ID format, quantity range) SHALL be enforced at the API contract level via Zod schemas.

## Monitoring and Observability

- 🚧 Track cart creation rate, item addition rate, and cart abandonment rate.
- Log cart merge operations with user ID and guest token for audit purposes.
- 🚧 Alert on unusual cart creation spikes (potential abuse).

## Testing and Validation

### Unit Tests

- Cart service: item addition (new cart, existing cart, duplicate product upsert)
- Cart service: quantity update, item removal, cart clearing
- Cart service: currency validation (first item sets currency, mismatch rejected)
- Cart service: price locking (price snapshotted from product, not recalculated)
- Cart service: guest-to-user merge (no existing user cart, existing user cart with overlapping items)

### Integration Tests

- Full API flow: create guest cart → add items → update quantity → remove item → clear
- Full API flow: authenticated user cart lifecycle
- Merge flow: guest cart + user cart with overlapping products
- Edge cases: adding inactive product, currency mismatch, invalid cart token

### Web Application Tests

- Cart page renders items correctly
- Quantity controls update the API and UI
- Remove button removes item and updates totals
- Empty cart state displays correctly
- Cart token persisted in and loaded from localStorage

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cart token brute-force | Unauthorized access to guest carts | UUID v4 has 122 bits of entropy; rate-limit cart endpoints |
| Stale price snapshots | Customer sees different price on product page vs cart | Display "price at time of adding" clearly; 🚧 consider price refresh option |
| Orphaned guest carts filling the database | Storage growth, query performance | 🚧 Implement cart expiration (deferred) |
| Cart merge race condition | Duplicate items or lost quantities | Run merge within a database transaction with row-level locking |
| Product deleted after added to cart | Broken references in cart items | FK constraint prevents hard delete; product archival leaves cart items displayable |
