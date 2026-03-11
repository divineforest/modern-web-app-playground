# Add to Cart from Product List Page

## Overview

Today, the product list page (`/`) is a read-only browsing surface: each product card links to the detail page, and cart interaction requires a full navigation. This creates unnecessary friction for customers who already know what they want and simply need to add items without leaving the catalog.

This feature introduces inline cart controls on every product card in the list grid. When a product is not yet in the cart, the card shows a quantity picker and an "Add to Cart" button. Once the product is in the cart, those controls are replaced by compact inline +/− quantity buttons and a live quantity display — the same pattern used by Amazon and similar shop sites. Reducing quantity to zero removes the item from the cart.

The change is frontend-only. All required API endpoints (`addItem`, `updateItem`, `removeItem`) already exist. The existing React Query `['cart']` cache, `CartProvider`, and `CartSidebar` all remain unchanged and continue to reflect cart state reactively.

## Goals and Non-Goals

### Goals

- Display a quantity picker and "Add to Cart" button on each product card when the product is not in the cart
- Replace those controls with inline +/− quantity controls (and a live quantity display) when the product is already in the cart
- Decrementing quantity to zero SHALL remove the item from the cart
- Optimistic UI updates for all quantity changes and removals, with rollback on error
- Disable all mutation buttons while any mutation for that specific product is in flight
- Keep the existing `CardActionArea` navigation link functional — clicking the image or product name still navigates to the detail page
- The `CartSidebar` continues to update reactively without any changes

### Non-Goals

- Cart controls on the search results page (`/search`) — separate feature
- Modifying the product detail page cart controls — those remain unchanged
- Any new backend API endpoints or schema changes
- Showing a per-card success snackbar (the `CartSidebar` updating is sufficient feedback)
- Support for batch-adding multiple distinct products in one API call
- Stock / inventory enforcement (not present elsewhere in the app)

## Functional Requirements

### FR-1: "Not in Cart" State

- When a product is not present in the current cart (no cart item with a matching product ID), each product card SHALL display a quantity picker and an "Add to Cart" button below the price section.
- The quantity picker SHALL default to 1 on mount and SHALL allow the customer to increment or decrement the pending quantity before adding.
- The quantity picker minimum SHALL be 1; decrementing below 1 SHALL be disabled.
- The quantity picker maximum SHOULD be unconstrained in the UI (no inventory enforcement).
- Clicking "Add to Cart" SHALL call `addItem` with the selected product ID and the current pending quantity.
- On successful `addItem`, the card SHALL transition immediately to the "In cart" state (FR-2), and the pending quantity SHALL reset to 1.
- While the `addItem` mutation is pending, the "Add to Cart" button and both quantity picker buttons SHALL be disabled and the button text SHALL read "Adding…".

### FR-2: "In Cart" State

- When a product is present in the cart (a cart item with matching product ID exists), the quantity picker + "Add to Cart" button SHALL be replaced by inline +/− controls showing the current cart quantity.
- The displayed quantity SHALL reflect the authoritative value from the cart cache, so it stays in sync with changes made from the Cart page, the sidebar, or other browser tabs after cache revalidation.
- Clicking "+" SHALL call `updateItem` with quantity incremented by 1.
- Clicking "−" SHALL decrement the cart quantity by 1. If the resulting quantity would be 0, the system SHALL call `removeItem` instead of `updateItem`, and the card SHALL transition to the "Not in cart" state (FR-1).
- Clicking "−" when quantity is already 1 SHALL trigger removal (quantity → 0 path), not a disabled state.
- While a mutation is pending for this card's item, both "+" and "−" buttons SHALL be disabled.
- Optimistic updates SHALL apply for both `updateItem` and `removeItem`, following the same pattern used in the Cart page.

### FR-3: Cart State Lookup

- The component SHALL derive its state (in cart vs. not in cart, current quantity, item ID) by looking up the product ID in the items array from the `['cart']` query cache.
- The cart query SHALL NOT be initiated a second time — it SHALL reuse the query already established by `CartProvider` on mount (React Query deduplicates by key).
- While the cart query is loading, the cart control area on each card SHALL render a compact loading indicator in place of the controls.
- If the cart query returns an error, the cart control area SHALL render the "Not in cart" state as a safe fallback.

### FR-4: Card Layout Preservation

- Adding cart controls SHALL NOT break the uniform grid layout of product cards.
- The cart controls SHALL be placed inside the card's content area, below the price display.
- The `CardActionArea` wrapping the image and text SHALL remain intact so clicking the image or product name still navigates to `/products/{slug}`.
- Cart controls MUST be rendered outside the `CardActionArea` to prevent cart button clicks from triggering navigation.
- On small screens (xs, sm), the controls SHALL remain visible (more important at these breakpoints since the sidebar is hidden).

### FR-5: Error Handling

- On `addItem` failure, the card SHALL revert to its pre-mutation state and display an inline error message or a dismissible snackbar. The pending quantity SHALL be preserved so the customer can retry without re-entering it.
- On `updateItem` or `removeItem` failure, the optimistic update SHALL be rolled back and an error notification SHALL be displayed (consistent with the Cart page behavior).
- Error states SHALL be per-card — one card's mutation failure SHALL NOT affect other cards.

## Technical Requirements

### TR-1: New Component — Cart Controls for Product Card

- A new component SHALL be created responsible for rendering the correct cart interaction state for a single product.
- The component SHALL accept: `productId` (UUID string), `productName` (string, for accessibility labels).
- The component SHALL derive all cart state internally by subscribing to `tsr.cart.getCart.useQuery({ queryKey: ['cart'] })` and performing a `find` on `items` by product ID. React Query deduplication ensures no extra network request fires.
- The component SHALL own the `addItem`, `updateItem`, and `removeItem` mutations directly (not lifted to `ProductsPage`), so each card's mutation state is isolated.
- The component SHALL own a local pending quantity state (integer, default 1) for the "not in cart" quantity picker.
- Optimistic updates for `updateItem` and `removeItem` SHALL mirror the Cart page implementation: `onMutate` snapshots the previous cache value and applies the optimistic change; `onError` restores the snapshot; `onSettled` calls `invalidateQueries({ queryKey: ['cart'] })`.

### TR-2: Integration into the Products Page

- `ProductsPage` (`apps/web/src/pages/products.tsx`) SHALL render the new cart controls component for each product card, placed after the price display within `CardContent`.
- The `CardActionArea` SHALL be restructured to cover only the image and text content, not the controls row. One accepted pattern: `CardActionArea` wraps only the upper portion of the card, and the controls are rendered as a sibling below it.
- The card layout SHALL remain visually cohesive (consistent border, background) after the restructure.

### TR-3: Optimistic Update Shape

- For `updateItem`, the optimistic cache update SHALL recompute `lineTotal` as `(parseFloat(unitPrice) * newQuantity).toFixed(2)`, matching the pattern in `apps/web/src/pages/cart.tsx`.
- For `removeItem`, the optimistic cache update SHALL filter the target item out of `items`.
- Both SHALL cancel in-flight `['cart']` queries before applying the optimistic value (`queryClient.cancelQueries`), and SHALL call `invalidateQueries({ queryKey: ['cart'] })` in `onSettled`.

### TR-4: Mutation Isolation Between Cards

- Each card's component instance SHALL own its own mutation hook instances.
- A mutation pending on card A SHALL NOT disable controls on card B.
- The loading/disabled state check within a card SHALL reference only that card's own mutation `.isPending` flags and the cart query loading state.

### TR-5: Accessibility

- The "Add to Cart" button SHALL have `aria-label="Add [product name] to cart"`.
- The "−" button SHALL have `aria-label="Remove one [product name] from cart"` when quantity is 1, and `aria-label="Decrease quantity of [product name]"` otherwise.
- The "+" button SHALL have `aria-label="Increase quantity of [product name]"`.
- The quantity display SHALL use `aria-live="polite"` so screen readers announce changes.

## Data Flow

### Adding a New Item (Product Not in Cart)

1. **Customer** views the product list page. **CartProvider** has already populated the `['cart']` cache on mount.
2. Each **ProductCardCartControls** subscribes to `tsr.cart.getCart.useQuery({ queryKey: ['cart'] })` — React Query deduplicates; no new request fires.
3. **ProductCardCartControls** finds no matching item for this product ID — renders quantity picker (default 1) and "Add to Cart" button.
4. Customer optionally adjusts pending quantity, then clicks "Add to Cart".
5. **ProductCardCartControls** calls `addItem` with `{ productId, quantity }`. Buttons disabled; button text reads "Adding…".
6. **Cart API** processes the request, returns updated `CartResponse`.
7. `addItem.onSuccess` fires: `queryClient.invalidateQueries({ queryKey: ['cart'] })`.
8. **React Query** refetches `GET /api/cart`; updated response stored in `['cart']` cache.
9. All **ProductCardCartControls** on the page re-render: the product just added transitions to "in cart" state with inline +/− controls.
10. **CartSidebar** also re-renders reactively, showing the new item and updated subtotal.

### Incrementing Quantity (Product Already in Cart)

1. Customer clicks "+" on a product card already in the cart.
2. **ProductCardCartControls** reads `cartItem.quantity` from the `['cart']` cache.
3. `onMutate`: cancels in-flight `['cart']` queries, snapshots the current cache, applies optimistic update (increments quantity, recomputes line total for that item).
4. **ProductCardCartControls** calls `updateItem` with `{ params: { itemId }, body: { quantity: currentQuantity + 1 } }`.
5. **Cart API** processes the update, returns the updated `CartResponse`.
6. `onSettled` calls `invalidateQueries({ queryKey: ['cart'] })` — authoritative values replace the optimistic snapshot.
7. **CartSidebar** and all other cards reflect the final server state.

### Decrementing to Zero (Remove from Cart)

1. Customer clicks "−" on a card whose current cart quantity is 1.
2. **ProductCardCartControls** detects `currentQuantity - 1 === 0`, routes to `removeItem` instead of `updateItem`.
3. `onMutate`: snapshots cache, applies optimistic update (filters item out of `items`).
4. **ProductCardCartControls** calls `removeItem` with `{ params: { itemId } }`.
5. `onSettled` invalidates the `['cart']` cache.
6. The card transitions back to the "not in cart" state with pending quantity reset to 1.

### Mutation Failure and Rollback

1. Any mutation fails with a non-2xx response.
2. `onError` for `updateItem`/`removeItem` restores the cached snapshot, reverting the optimistic UI.
3. For `addItem` there is no optimistic update to roll back — the button simply returns to its enabled state with the pending quantity preserved.
4. An error notification (inline alert or dismissible snackbar) is shown on the affected card.

## Security Considerations

- No new API endpoints are introduced. All calls go through the existing `addItem`, `updateItem`, and `removeItem` endpoints, which enforce input validation (UUID format, quantity ≥ 1) via Zod at the contract layer.
- The component reads cart state from the client-side React Query cache. Cart data is always scoped to the current session by the server via the `sid` or `cart_token` cookie — no cross-user data exposure is possible.
- Button disabling during pending mutations is a UX safeguard only. The server-side cart API is the authoritative guard against concurrent mutations.
- Optimistic `lineTotal` values are display-only estimates, immediately replaced by server-authoritative values after cache revalidation. No client-computed price is persisted.

## Monitoring and Observability

- No new server-side metrics are required — the feature uses existing cart API endpoints already covered by any existing request logging.
- Client-side: mutation error rates can be monitored via browser error tracking if the project adds it in the future (🚧 not in scope here).

## Error Scenarios

| Scenario | Handling |
|----------|----------|
| `addItem` fails (network or server error) | Button re-enables; card stays in "not in cart" state; pending quantity preserved; inline error shown |
| `updateItem` fails | Optimistic update rolled back; previous quantity restored; error notification shown |
| `removeItem` fails | Optimistic removal rolled back; item re-appears at its previous quantity; error notification shown |
| Cart query fails on page load | Each card renders "not in cart" fallback; customer can still attempt `addItem`; cache recovers on next refetch |
| Cart query is loading | Cart controls area shows a small inline `CircularProgress`; no interaction possible until resolved |
| Product appears in cart from another tab | React Query background refetch (on window focus) updates `['cart']` cache; cards update without manual refresh |
| Concurrent "+"/"-" clicks before mutation settles | Buttons disabled during pending mutation; second click is ignored at the UI level |

## Testing and Validation

### Unit / Component Tests

- Cart controls renders quantity picker and "Add to Cart" button when product is not in the cart
- Cart controls renders inline +/− controls with correct quantity when product is in the cart
- Clicking "Add to Cart" calls `addItem` with the correct product ID and pending quantity
- Clicking "+" calls `updateItem` with `currentQuantity + 1`
- Clicking "−" when quantity is 2 calls `updateItem` with quantity 1
- Clicking "−" when quantity is 1 calls `removeItem`, not `updateItem`
- Buttons are disabled while `addItem.isPending` is true
- Buttons are disabled while `updateItem.isPending` or `removeItem.isPending` is true
- On `addItem` success, pending quantity resets to 1
- On `updateItem` failure, optimistic cache update is rolled back
- On `removeItem` failure, item re-appears in the cart controls
- Loading indicator shown while the cart query is in flight
- Fallback to "not in cart" state when cart query errors

### Integration Tests

- Product list page loads → product not in cart → add → card switches to "in cart" state → CartSidebar updates
- Increment and decrement quantity from the product list → cart totals in sidebar update correctly
- Decrement to zero → item removed from cart → card returns to "not in cart"
- Multiple cards: mutation on card A does not disable or affect card B
- Optimistic update: quantity display changes immediately on click before server responds

### End-to-End Tests (Playwright)

- Navigate to `/` → product cards display "Add to Cart" controls for products not in cart
- Add a product from the list page → card transitions to inline +/− controls → sidebar shows new item
- Increment quantity from a list card → sidebar shows updated quantity and line total
- Decrement to zero from a list card → item removed from sidebar, card returns to "Add to Cart"
- Navigate to `/cart` after adding from list → item present with correct quantity
- Simulate API failure (intercept network request) → error shown on card, quantity unchanged

### Manual QA Checklist

- All product cards on page 1 show correct cart state on load
- Paginating to page 2 shows correct cart state for those products
- Adding from list page and immediately opening the Cart page confirms quantity matches
- Rapid "+"/"-" clicks do not result in inconsistent quantity (buttons lock during pending)
- Mobile viewport: cart controls appear below the price, card content is not clipped
- Keyboard navigation: Tab reaches "Add to Cart" / "−" / quantity display / "+" in logical order
- Screen reader: quantity changes are announced via `aria-live`

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Card height overflow — adding controls makes cards taller and breaks the uniform grid | Visual inconsistency | Set a taller fixed height or use min-height + overflow strategy; verify at xs, sm, md, lg breakpoints before shipping |
| `CardActionArea` click-through — cart button clicks also trigger navigation | Customer unintentionally navigates away | Render cart controls outside the `CardActionArea` DOM subtree; verify with event propagation if needed |
| Flash of "not in cart" state on load — cart query not yet resolved for items already in cart | Momentary UI inconsistency | Show loading indicator while `isPending` is true; suppress "not in cart" controls until query settles |
| Concurrent mutations from list page and cart sidebar/page | Stale optimistic state, incorrect quantity displayed | Both paths invalidate `['cart']` in `onSettled`; React Query re-fetches authoritative state; the last settled response wins |
| Accessibility regression — interactive elements inside a card that is itself a link | Screen reader confusion, broken focus order | Ensure DOM structure separates the link region from the interactive controls region; validate with axe or similar |

