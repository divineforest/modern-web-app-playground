# My Orders Page

## Overview

This feature introduces a "My Orders" page for registered users in the Mercado web application. The page displays a chronological list of all orders placed by the authenticated user, with an expandable/collapsible detail view for each order. Users can see order status, items, totals, delivery information, and payment details without navigating away from the page.

The primary beneficiary is the end user who wants to track their purchase history, review order details, and check order statuses. This is a view-only feature — users cannot modify or cancel orders from this page.

This feature builds on the existing orders API and authentication system. The backend orders endpoint will be enhanced to filter orders by user and include order items. The frontend will render a new `/orders` page accessible only to authenticated users.

## Goals and Non-Goals

### Goals

- Display all orders placed by the authenticated user after registration
- Show basic order information in a list view: order number, date, total amount, and status
- Provide an expandable/collapsible detail view for each order with comprehensive information
- Include items, totals breakdown, delivery address, payment method, and order timeline in the detail view
- Show an empty state with a call-to-action when the user has no orders
- Require authentication to access the page

### Non-Goals

- Guest order history (orders placed before registration)
- Order cancellation, modification, or reordering functionality
- Filtering orders by status or date range
- Sorting options beyond chronological order (most recent first)
- Pagination or infinite scroll (load all orders at once)
- Order tracking integration with shipping providers
- Invoice or receipt download
- Email notifications or order status updates

## Functional Requirements

### FR-1: Orders List Display

- The system SHALL display all orders for the authenticated user in reverse chronological order (most recent first).
- The system SHALL exclude orders with status 'cart' from the list.
- The system SHALL exclude orders placed as a guest (orders with no user ID association).
- Each order in the list SHALL display: order number, order date, total amount with currency, and status.
- The system SHALL render the order status with appropriate visual styling (color or badge) to distinguish between statuses.

### FR-2: Order Detail View

- Each order in the list SHALL be expandable and collapsible.
- When expanded, the detail view SHALL display:
  - List of order items with: product name, product image, quantity, unit price, and line total
  - Totals breakdown: subtotal, tax amount, shipping amount, discount amount (if applicable), and total amount
  - Delivery address (if available)
  - Payment method or payment transaction ID (if available)
  - Order timeline: order date, expected delivery date (if available), paid date (if available)
- The detail view SHALL NOT allow editing or modification of any order data.
- Only one order SHALL be expanded at a time; expanding a new order SHALL collapse the previously expanded order.

### FR-3: Empty State

- When the user has no orders, the system SHALL display an empty state message: "You haven't placed any orders yet".
- The empty state SHALL include a call-to-action button labeled "Browse Products" that navigates to the product catalog page.

### FR-4: Authentication and Access Control

- The My Orders page SHALL be accessible at `/orders`.
- The page SHALL require authentication; unauthenticated users SHALL be redirected to `/login`.
- After login, the user SHALL be redirected back to `/orders`.

### FR-5: Order Status Display

- The system SHALL display all order statuses: pending (if status is 'draft'), confirmed, processing, shipped, fulfilled, paid, cancelled, and failed (if applicable).
- Each status SHALL have a distinct visual representation (color, icon, or badge).

## Technical Requirements

### TR-1: Backend — New User Orders Endpoint

A new endpoint `GET /api/orders/me` SHALL be created to retrieve orders for the authenticated user:

- The endpoint SHALL implicitly filter orders by the authenticated user's ID from the session context.
- The endpoint SHALL exclude orders with `status = 'cart'`.
- The endpoint SHALL include order items in the response (join with `order_items` and `products` tables).
- The endpoint SHALL sort results by `order_date` descending (most recent first).
- The endpoint SHALL return an array of orders, each matching the `orderWithItemsResponseSchema` structure.
- The endpoint SHALL return an empty array if the user has no orders.
- The endpoint SHALL require authentication; unauthenticated requests SHALL return HTTP 401.

**Rationale:** A dedicated `/me` endpoint is cleaner than adding query parameters to the existing `/api/orders` list endpoint, which is currently used for admin or broader order management. This approach provides better separation of concerns and clearer intent.

### TR-2: API Contract Updates

The `ordersContract` in `packages/api-contracts/src/orders/contract.ts` SHALL be updated with a new `listMyOrders` endpoint:

- Method: `GET`
- Path: `/api/orders/me`
- Requires authentication
- Response: `200: z.object({ orders: z.array(orderWithItemsResponseSchema) })`
- Error responses: `401: unauthorizedErrorSchema`, `500: internalErrorSchema`
- Summary: "List my orders"
- Description: "Retrieves all orders for the authenticated user, including order items"

### TR-3: Web Application — My Orders Page

- The My Orders page SHALL be implemented as a React component at `apps/web/src/pages/orders-page.tsx`.
- The page SHALL use TanStack Query to fetch orders from the backend API.
- The page SHALL use Material-UI components for consistent styling.
- The page SHALL implement an accordion or expansion panel pattern for expandable order details.
- The page SHALL be registered in the React Router configuration at `/orders`.
- The route SHALL be protected with authentication (redirect to `/login` if unauthenticated).

### TR-4: Order Item Display

- Product images in the order detail view SHALL use the `productImageUrl` field from `order_items`.
- If `productImageUrl` is null, the system SHALL display a placeholder image.
- Item quantities and prices SHALL be formatted according to the order's currency.

### TR-5: Error Handling

- If the backend API request fails, the page SHALL display an error message: "Unable to load your orders. Please try again later."
- The page SHALL include a retry button that refetches the data.
- If the user's session expires while on the page, the system SHALL redirect to `/login` with a return URL of `/orders`.

### TR-6: Loading State

- While fetching orders, the page SHALL display a loading indicator (e.g., skeleton screens or spinner).
- The loading state SHALL not block the page header or navigation.

### TR-7: Data Consistency and Edge Cases

- If an order has no items (data inconsistency), the backend SHALL return the order with an empty `items` array.
- The frontend SHALL display such orders with a message: "No items found for this order."
- If an order has an unexpected or invalid status value, the backend SHALL include it in the response; the frontend SHALL display the raw status string.

### TR-8: Cache and Refresh Strategy

- The frontend SHALL use TanStack Query's default stale time (data considered fresh for a short period).
- The page SHALL refetch orders when the user navigates back to `/orders` after leaving (automatic background refetch).
- The page SHALL NOT auto-refresh orders while the user is viewing the page (no polling).

### TR-9: Database Schema Verification

- No database schema changes are required; the existing `orders` and `order_items` tables have all necessary fields.
- The existing index on `order_items.order_id` is sufficient for the join query performance.

## Data Flow

### Loading My Orders Page

1. **User** navigates to `/orders` in the web application.
2. **React Router** checks authentication; if not authenticated, redirects to `/login`.
3. **Orders Page Component** mounts and triggers a TanStack Query request to the backend.
4. **Frontend API Client** sends `GET /api/orders/me` with the session cookie.
5. **Backend Session Plugin** validates the session cookie and attaches the user to the request context.
6. **Orders API Handler** retrieves `request.user.id` from the authenticated context.
7. **Orders Service** queries the database for orders where `orders.user_id = request.user.id` AND `orders.status != 'cart'`, ordered by `order_date DESC`.
8. **Orders Repository** joins with `order_items` and `products` tables to include item details.
9. **Orders Service** formats the response and returns the orders array with items.
10. **Frontend** receives the response and renders the orders list.

### Expanding an Order

1. **User** clicks on an order card to expand it.
2. **Orders Page Component** updates local state to mark the order as expanded and collapses any previously expanded order.
3. **Component** renders the order detail view with items, totals, address, payment info, and timeline.

### Empty State Flow

1. **User** navigates to `/orders`.
2. **Orders Page Component** fetches orders; the backend returns an empty array.
3. **Component** detects the empty array and renders the empty state message and CTA button.
4. **User** clicks "Browse Products".
5. **Component** navigates to `/products` (or the product catalog route).

## Security Considerations

- The My Orders page SHALL only display orders belonging to the authenticated user; orders belonging to other users SHALL NOT be accessible.
- The backend endpoint SHALL enforce user-specific filtering based on the authenticated session, not on a client-provided user ID parameter.
- The backend SHALL reject requests without a valid session cookie with HTTP 401.
- Order data SHALL NOT include sensitive payment details beyond a masked payment transaction ID or payment method type.

## Monitoring and Observability

- Log each request to the My Orders endpoint with user ID and result count.
- 🚧 Track page load time and API response time as frontend performance metrics.
- 🚧 Alert on elevated error rates for the My Orders endpoint (e.g., > 5% errors in 10 minutes).

## Error Scenarios

| Scenario | Response |
|----------|----------|
| User not authenticated | Redirect to `/login` with return URL `/orders` |
| Session expired while on page | HTTP 401 from API → redirect to `/login` |
| Backend API failure | Display error message with retry button |
| Network error | Display error message with retry button |
| No orders found | Display empty state with CTA |
| Order with no items (data inconsistency) | Display order with message "No items found for this order" |
| Order with unexpected status | Display raw status string |
| Invalid order data (missing required fields) | Log error, skip invalid order, display valid orders |

## Testing and Validation

### Unit Tests

- Orders service: filtering by user ID excludes other users' orders
- Orders service: orders with status 'cart' are excluded
- Orders service: results are sorted by order date descending
- Orders repository: join with order items returns complete item data

### Integration Tests

- `GET /api/orders/me` with valid session returns user's orders with items
- `GET /api/orders/me` with no session returns HTTP 401
- `GET /api/orders/me` with valid session but no orders returns empty array
- Orders for different users are isolated (user A cannot see user B's orders)

### Web Application Tests (Playwright)

- My Orders page redirects to login when unauthenticated
- After login, user is redirected back to `/orders`
- Orders list displays correct order number, date, total, and status
- Clicking an order expands the detail view
- Expanded order shows items, totals, address, and payment info
- Expanding a second order collapses the first
- Empty state displays when user has no orders
- "Browse Products" button navigates to product catalog
- Error message displays on API failure
- Retry button refetches data after error

### Manual QA

- Verify order status badges have distinct colors
- Verify product images display correctly or fall back to placeholder
- Verify currency formatting for amounts
- Verify date formatting is consistent with the application locale
- Verify page is responsive on mobile and desktop

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Loading all orders at once causes slow page load for users with many orders | Poor user experience | Accept for MVP; add pagination in a future iteration if users report issues |
| Users expect to cancel or modify orders from this page | Feature gap | Clearly communicate that this is a view-only page; add cancellation in a future iteration |
| Order items join query is slow for large datasets | Slow API response | Add database index on `order_items.order_id` (already exists); monitor query performance |
| Session expiry while viewing orders causes confusion | User friction | Handle 401 gracefully with redirect to login and return URL |
| Guest orders (pre-registration) are not displayed | User confusion if they expect to see all orders | Document in non-goals; consider associating guest orders with user email in a future iteration |
