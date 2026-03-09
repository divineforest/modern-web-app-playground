# Cart Sidebar on Product Catalog Pages

## Overview

The cart sidebar feature gives customers immediate visibility into their current cart while browsing the product catalog. A persistent cart panel is displayed on the right side of both the product list page and the product detail page, showing cart items, quantities, and totals without requiring navigation to a dedicated cart page.

This improves the shopping experience by reducing context-switching: customers can see exactly what they've selected while they continue browsing, and confirm that items were successfully added after clicking "Add to Cart" on the product detail page.

The feature is implemented entirely on the frontend. No new API endpoints or backend changes are required — the sidebar reuses the existing `GET /api/cart` query already used by the cart context and cart page.

## Goals and Non-Goals

### Goals

- Display the current cart state in a right-side panel on the product list page (`/`) and product detail page (`/products/:slug`)
- Show cart items with product name, quantity, and line total
- Show cart subtotal and total item count
- Provide quick navigation to the full Cart page and Checkout
- Handle the empty cart state gracefully
- Update automatically when an item is added from the product detail page
- Collapse the sidebar on small screens to preserve usable width for the product content

### Non-Goals

- Cart item quantity controls within the sidebar (use the full Cart page for that)
- Removing items from within the sidebar
- Showing the cart sidebar on non-catalog pages (Cart, Checkout, Orders, Login, Register, Search)
- Adding "Add to Cart" functionality to the product list page grid
- Any new backend API endpoints or data changes

## Functional Requirements

### FR-1: Sidebar Placement and Layout

- The product list page and product detail page SHALL display a two-column layout on medium screens and above: main product content on the left, cart sidebar on the right.
- The cart sidebar SHALL have a fixed width of approximately 300px and SHALL NOT shrink to accommodate the product content area.
- The product content area SHALL occupy the remaining width (flex: 1).
- On small screens (xs, sm breakpoints), the cart sidebar SHALL be hidden to preserve full width for the product content.
- The cart sidebar SHALL be sticky (positioned relative to the viewport scroll) so it remains visible as the user scrolls through product listings or long product descriptions.

### FR-2: Cart Sidebar Contents

- The sidebar SHALL display the heading "Your Cart".
- When the cart contains items, the sidebar SHALL list each cart item showing:
  - Product name (truncated to two lines if long)
  - Quantity
  - Line total (formatted as currency)
- The sidebar SHALL display a subtotal row below the item list, labeled "Subtotal", formatted as currency.
- The sidebar SHALL display a "View Cart" button that navigates to `/cart`.
- The sidebar SHALL display a "Checkout" button that navigates to `/checkout`.
- The item list SHALL scroll independently if it contains many items, with a maximum height that keeps the subtotal and action buttons always visible within the sidebar.

### FR-3: Empty Cart State

- When the cart has no items, the sidebar SHALL display a shopping cart icon and the message "Your cart is empty".
- In the empty state, the sidebar SHALL NOT show the subtotal row or the "Checkout" button.
- In the empty state, a "Start Shopping" call-to-action is not needed since the user is already on the catalog page.

### FR-4: Real-Time Updates on Product Detail Page

- After the user clicks "Add to Cart" on the product detail page, the sidebar SHALL automatically update to reflect the new cart state (new item or increased quantity and updated subtotal).
- The update SHOULD be near-immediate, relying on the React Query cache invalidation already performed by the existing `addToCartMutation.onSuccess` handler.
- No additional loading spinner is required for the sidebar during the add-to-cart mutation — the sidebar updates reactively when the query cache is refreshed.

### FR-5: Loading State

- While the cart query is in flight (initial page load), the sidebar SHALL display a compact skeleton or loading indicator in place of the item list.
- Once loaded, the sidebar SHALL render the appropriate state (empty or with items).

### FR-6: Shared Component

- The cart sidebar SHALL be extracted as a single reusable component (`CartSidebar`) used by both the product list page and the product detail page.
- The component SHALL accept no required props — it reads cart data directly from the React Query cache via the `['cart']` query key.

## Technical Requirements

### TR-1: No New API Endpoints

- The sidebar SHALL use the existing `tsr.cart.getCart.useQuery` hook with query key `['cart']`.
- Because the `CartProvider` already fetches `GET /api/cart` on mount and caches it under `['cart']`, the sidebar query SHOULD deduplicate with the global cache — no extra network request is made when navigating between catalog pages.

### TR-2: CartSidebar Component

- The `CartSidebar` component SHALL be created at `apps/web/src/components/cart-sidebar.tsx`.
- The component SHALL use `tsr.cart.getCart.useQuery({ queryKey: ['cart'] })` to access cart data.
- The component SHALL format prices using `Intl.NumberFormat` matching the convention already used in the cart page and product pages.
- The component SHALL use MUI components consistent with the rest of the application: `Paper`, `Typography`, `Box`, `Divider`, `Button`, `CircularProgress`.

### TR-3: Page Layout Changes

- Both `ProductsPage` (`apps/web/src/pages/products.tsx`) and `ProductDetailPage` (`apps/web/src/pages/product-detail.tsx`) SHALL update their top-level layout to a horizontal flex container with two children: the existing product content and the new `CartSidebar`.
- The outer `Container` SHALL remain `maxWidth="lg"` and `py: 4`.
- The layout wrapper SHALL use `display: 'flex'`, `gap: 3`, `alignItems: 'flex-start'` so the sticky sidebar aligns correctly.
- The `CartSidebar` SHALL be hidden via `display: { xs: 'none', md: 'block' }`.

### TR-4: Sticky Positioning

- The `CartSidebar` root element SHALL use `position: 'sticky'` and `top: 16` (or equivalent spacing token) to keep it visible during scroll.
- This requires the page layout to not set `overflow: hidden` on any ancestor between the sidebar and the scroll root.

### TR-5: Item List Overflow

- If the cart has many items, the item list within the sidebar SHALL cap at a `maxHeight` (e.g., `360px`) and use `overflowY: 'auto'` to allow scrolling within the sidebar without expanding its height beyond the viewport.

## Data Flow

### Browsing Product List with Items in Cart

1. **Customer** navigates to `/` (product list page).
2. **Page** renders two-column layout: product grid on the left, `CartSidebar` on the right.
3. **CartSidebar** calls `tsr.cart.getCart.useQuery` — if the `['cart']` cache is already populated by `CartProvider`, no additional network request occurs.
4. **CartSidebar** renders the item list, subtotal, and action buttons.
5. Customer clicks a product card and navigates to the product detail page — the sidebar is still visible there with the same cart state.

### Adding an Item from Product Detail Page

1. **Customer** is on `/products/some-slug` and clicks "Add to Cart".
2. **ProductDetailPage** calls `addToCartMutation.mutate(...)`.
3. On success, `queryClient.invalidateQueries({ queryKey: ['cart'] })` is called (already implemented in the existing code).
4. **CartSidebar** (rendered on the right) reacts to the cache invalidation, re-fetches `GET /api/cart`, and updates with the new item visible in the list and the new subtotal.
5. The existing `Snackbar` confirmation ("Added to cart!") still appears as before.

### Empty Cart on First Visit

1. **Guest** visits `/` for the first time with no cart cookie.
2. **CartSidebar** calls the cart query; server returns the empty cart representation.
3. **CartSidebar** renders the empty state: cart icon and "Your cart is empty" message.
4. No subtotal or checkout button is shown.

## Component API

### `CartSidebar`

```tsx
// apps/web/src/components/cart-sidebar.tsx
export function CartSidebar(): JSX.Element
```

No props. Internally uses:
- `tsr.cart.getCart.useQuery({ queryKey: ['cart'] })` for cart data
- `Link` from `react-router-dom` for navigation buttons
- MUI components for layout and styling

### Layout Integration Example

```tsx
// Simplified illustration of the updated page layout
<Container maxWidth="lg" sx={{ py: 4 }}>
  <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      {/* existing page content */}
    </Box>
    <Box sx={{ display: { xs: 'none', md: 'block' }, flexShrink: 0, width: 300 }}>
      <CartSidebar />
    </Box>
  </Box>
</Container>
```

## Error Scenarios

| Scenario | Handling |
|----------|----------|
| Cart API returns an error | Sidebar silently shows nothing (no error alert — cart state is supplementary, not blocking) |
| Cart query is loading | Sidebar shows a compact `CircularProgress` |
| Cart has zero items | Sidebar shows empty state (icon + message) |
| Product image missing in cart item | Not shown in sidebar (sidebar shows name + quantity + price only) |

## Security Considerations

- The sidebar uses the same `GET /api/cart` endpoint as the existing cart page — no new security surface is introduced.
- Cookie-based cart identification (session or `cart_token`) is handled entirely by the server; the sidebar does not handle tokens.

## Testing and Validation

### Unit / Component Tests

- `CartSidebar` renders item list correctly given cart data
- `CartSidebar` renders empty state when cart has no items
- `CartSidebar` renders loading state while query is in flight
- `CartSidebar` formats prices correctly using `Intl.NumberFormat`
- `CartSidebar` does not render subtotal or checkout button in empty state
- `CartSidebar` links "View Cart" to `/cart` and "Checkout" to `/checkout`

### Integration Tests

- Product list page renders sidebar alongside the product grid on medium+ screens
- Product detail page renders sidebar alongside product details on medium+ screens
- After adding item to cart from product detail page, sidebar updates to show the new item and updated subtotal

### End-to-End Tests

- Visit `/` → sidebar visible (or empty state) on desktop viewport
- Visit `/products/:slug` → sidebar visible on desktop viewport
- Add item from product detail page → sidebar updates with new item
- Resize to mobile viewport → sidebar is hidden

### Manual QA Checklist

- Navigate to product list: sidebar appears on right side with correct cart state
- Navigate to product detail: sidebar appears on right side
- Add an item: sidebar updates immediately after "Added to cart!" snackbar
- Add a second item of same product: sidebar shows updated quantity and recalculated line total
- Empty cart: sidebar shows empty state with no checkout button
- Click "View Cart": navigates to `/cart`
- Click "Checkout": navigates to `/checkout`
- Resize to mobile: sidebar disappears, product content fills full width
- Long cart (many items): item list scrolls within sidebar without expanding past viewport

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Sidebar reduces product grid width noticeably | Fewer columns in product grid on md screens, feels cramped | Test grid layout at md breakpoint; adjust grid column thresholds if needed (e.g., from 4 columns to 3) |
| Sticky positioning breaks inside overflow containers | Sidebar scrolls with content instead of staying fixed | Ensure no ancestor applies `overflow: hidden` or `overflow: auto`; test across browsers |
| Cart query fires a duplicate network request | Slight extra load | Verify React Query deduplicates the `['cart']` query from `CartProvider`; add `staleTime` if needed |
| Sidebar distracts from product browsing | Cluttered UI, reduced conversion | Keep sidebar design minimal (no images, no controls); gather user feedback post-launch |
