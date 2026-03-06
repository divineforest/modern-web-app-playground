# TanStack Query for Server State Management via @ts-rest/react-query

**Status:** proposed
**Date:** 2026-03-05 19:30

## Context

The React frontend (`apps/web/`) manages all server state — data fetched from the backend API — with manual `useEffect` + `useState` patterns. Every page and context independently implements fetching, loading states, and error handling. There is no caching, request deduplication, or background refetching.

### Current state

Every page follows this pattern:

```typescript
// apps/web/src/pages/products.tsx (representative of all pages)
const [products, setProducts] = useState<Product[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  setLoading(true);
  async function fetchProducts() {
    try {
      const response = await api.products.list({ query: { status: 'active', page, limit: PAGE_SIZE } });
      if (response.status === 200) {
        setProducts(response.body.products);
        setPagination(response.body.pagination);
      } else {
        throw new Error('Failed to fetch products');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }
  void fetchProducts();
}, [page]);
```

Files that contain this pattern:

| File | API calls | State variables |
|------|-----------|-----------------|
| `apps/web/src/pages/products.tsx` | `api.products.list` | `products`, `pagination`, `loading`, `error` |
| `apps/web/src/pages/product-detail.tsx` | `api.products.getBySlug`, `api.cart.addItem` | `product`, `loading`, `error`, `addingToCart` |
| `apps/web/src/pages/cart.tsx` | `api.cart.getCart`, `api.cart.updateItem`, `api.cart.removeItem`, `api.cart.clearCart` | `cart`, `loading`, `error` |
| `apps/web/src/pages/checkout.tsx` | `api.cart.getCart`, `api.checkout.checkout` | `cart`, `loading`, `submitting`, `error` |
| `apps/web/src/pages/order-confirmation.tsx` | `api.orders.getByOrderNumber` | `order`, `loading`, `error` |
| `apps/web/src/contexts/auth-context.tsx` | `api.auth.me`, `api.auth.login`, `api.auth.register`, `api.auth.logout` | `user`, `loading` |
| `apps/web/src/contexts/cart-context.tsx` | `api.cart.getCart` | `itemCount` |

### Problems

1. **No caching.** Navigating from product list → product detail → back refetches the product list. The cart count in `cart-context.tsx` refetches on every mount.
2. **Duplicate requests.** `cart-context.tsx` and `cart.tsx` both call `api.cart.getCart` independently — two identical requests when visiting the cart page.
3. **Stale data.** After `api.cart.addItem` in `product-detail.tsx`, the cart badge count in `cart-context.tsx` requires a manual `refreshCart()` call. If forgotten, the badge shows stale data.
4. **Boilerplate.** Each page repeats ~15 lines of `useState` + `useEffect` + `try/catch` + `setLoading`. Seven files contain this pattern.
5. **No retry or background refetch.** A transient network failure shows an error with no recovery path except a full page reload.

### Constraints

- The frontend already uses `@ts-rest/core` with `initClient` and `@mercado/api-contracts` (see ADR `2026-03-05-11-11-shared-api-contracts.md`).
- React 19 with React Router 7, Vite 7, MUI 7.
- Session-based auth with `credentials: 'include'` (see ADR `2026-03-05-12-49-session-based-auth.md`).

## Decision

Adopt `@ts-rest/react-query` with `@tanstack/react-query` v5 for all server state management. This replaces manual `useEffect` + `useState` data fetching patterns across the web app.

### 1. Install dependencies

```bash
pnpm --filter @mercado/web add @tanstack/react-query @ts-rest/react-query
```

### 2. Create the tsr client

Replace the current `initClient` setup with `initTsrReactQuery`:

```typescript
// apps/web/src/lib/api-client.ts
import { initTsrReactQuery } from '@ts-rest/react-query/v5';
import { apiContract } from '@mercado/api-contracts';

export const tsr = initTsrReactQuery(apiContract, {
  baseUrl: '',
  baseHeaders: {},
  credentials: 'include',
});
```

The `tsr` object provides typed hooks that mirror the contract structure: `tsr.products.list.useQuery(...)`, `tsr.cart.addItem.useMutation(...)`, etc.

### 3. Set up providers

```tsx
// apps/web/src/main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { tsr } from './lib/api-client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <tsr.ReactQueryProvider>
          <AuthProvider>
            <CartProvider>
              <RouterProvider router={router} />
            </CartProvider>
          </AuthProvider>
        </tsr.ReactQueryProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
```

`staleTime: 30_000` means data is considered fresh for 30 seconds — navigating back to the product list within 30s returns cached data instantly without a request.

### 4. Page component pattern (queries)

Before — manual fetch in `products.tsx`:

```typescript
const [products, setProducts] = useState<Product[]>([]);
const [pagination, setPagination] = useState<PaginationMeta | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  setLoading(true);
  async function fetchProducts() {
    try {
      const response = await api.products.list({
        query: { status: 'active', page, limit: PAGE_SIZE },
      });
      if (response.status === 200) {
        setProducts(response.body.products);
        setPagination(response.body.pagination);
      } else {
        throw new Error('Failed to fetch products');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }
  void fetchProducts();
}, [page]);
```

After — TanStack Query hook:

```typescript
const { data, isPending, error } = tsr.products.list.useQuery({
  queryKey: ['products', page],
  queryData: {
    query: { status: 'active', page, limit: PAGE_SIZE },
  },
});

const products = data?.status === 200 ? data.body.products : [];
const pagination = data?.status === 200 ? data.body.pagination : null;
```

This eliminates 4 `useState` calls, the `useEffect`, the `try/catch`, and the manual `setLoading` flag. TanStack Query provides `isPending`, `error`, `data`, `isRefetching`, and automatic retry.

### 5. Mutation pattern

Before — manual mutation in `product-detail.tsx`:

```typescript
const [addingToCart, setAddingToCart] = useState(false);

const handleAddToCart = async () => {
  setAddingToCart(true);
  try {
    const response = await api.cart.addItem({ body: { productId: product.id, quantity: 1 } });
    if (response.status === 200) {
      refreshCart();
    }
  } catch {
    setError('Failed to add to cart');
  } finally {
    setAddingToCart(false);
  }
};
```

After — mutation with cache invalidation:

```typescript
const queryClient = useQueryClient();

const addToCart = tsr.cart.addItem.useMutation({
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['cart'] });
  },
});

const handleAddToCart = () => {
  addToCart.mutate({ body: { productId: product.id, quantity: 1 } });
};
// addToCart.isPending replaces addingToCart state
// addToCart.error replaces error state
```

`invalidateQueries({ queryKey: ['cart'] })` automatically refetches all queries whose key starts with `['cart']` — this updates both the cart page data and the cart badge count from a single invalidation.

### 6. Cart context simplification

The `CartProvider` in `apps/web/src/contexts/cart-context.tsx` currently manages `itemCount` via manual fetch. With TanStack Query, it becomes a thin wrapper:

```typescript
// apps/web/src/contexts/cart-context.tsx
import { useQueryClient } from '@tanstack/react-query';
import { tsr } from '../lib/api-client';

function CartProvider({ children }: { children: React.ReactNode }) {
  const { data } = tsr.cart.getCart.useQuery({
    queryKey: ['cart'],
  });
  const queryClient = useQueryClient();

  const itemCount = data?.status === 200 ? data.body.itemCount : 0;

  const invalidateCart = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['cart'] });
  }, [queryClient]);

  return (
    <CartContext value={{ itemCount, invalidateCart }}>
      {children}
    </CartContext>
  );
}
```

The cart page (`cart.tsx`) uses the same `['cart']` query key. TanStack Query deduplicates: one network request serves both the badge and the cart page.

### 7. Auth context — keep manual

Auth state (`user`, `login`, `logout`, `register`) SHALL remain in `apps/web/src/contexts/auth-context.tsx` with manual `api` calls (retain the existing `initClient`-based `api` export alongside `tsr` during migration). Auth is session-based with side effects (cookie management, redirects). Caching auth state in TanStack Query adds complexity without clear benefit — the user object changes only on login/logout, not on refetch intervals.

After migration completes for all non-auth pages, auth MAY move to TanStack Query if a concrete caching benefit emerges (e.g., multiple components need the user object simultaneously). Until that need arises, `apps/web/src/lib/api-client.ts` SHALL export both:

```typescript
// apps/web/src/lib/api-client.ts
import { apiContract } from '@mercado/api-contracts';
import { initClient } from '@ts-rest/core';
import { initTsrReactQuery } from '@ts-rest/react-query/v5';

export const api = initClient(apiContract, {
  baseUrl: '',
  baseHeaders: {},
  credentials: 'include',
});

export const tsr = initTsrReactQuery(apiContract, {
  baseUrl: '',
  baseHeaders: {},
  credentials: 'include',
});
```

### 8. Query key conventions

All query keys SHALL follow this pattern:

| Endpoint | Query key |
|----------|-----------|
| `tsr.products.list` | `['products', page]` |
| `tsr.products.getBySlug` | `['products', slug]` |
| `tsr.cart.getCart` | `['cart']` |
| `tsr.orders.getByOrderNumber` | `['orders', orderNumber]` |

Invalidation targets:
- After cart mutation → `invalidateQueries({ queryKey: ['cart'] })`
- After checkout → `invalidateQueries({ queryKey: ['cart'] })` + `invalidateQueries({ queryKey: ['orders'] })`

### 9. File structure changes

No new directories. Changes are within existing files:

```
apps/web/
├── src/
│   ├── lib/
│   │   └── api-client.ts          # Add tsr export alongside existing api export
│   ├── contexts/
│   │   ├── auth-context.tsx        # No changes (keeps manual api calls)
│   │   └── cart-context.tsx        # Rewrite to use tsr.cart.getCart.useQuery
│   ├── pages/
│   │   ├── products.tsx            # Replace useEffect+useState with tsr.products.list.useQuery
│   │   ├── product-detail.tsx      # useQuery for product, useMutation for addItem
│   │   ├── cart.tsx                # useQuery for cart, useMutations for update/remove/clear
│   │   ├── checkout.tsx            # useQuery for cart, useMutation for checkout
│   │   └── order-confirmation.tsx  # useQuery for order
│   └── main.tsx                    # Add QueryClientProvider + tsr.ReactQueryProvider
└── package.json                    # Add @tanstack/react-query, @ts-rest/react-query
```

## Consequences

### Positive

- **Automatic caching**: Product list survives back-navigation without refetching (30s stale time).
- **Request deduplication**: Cart badge and cart page share one network request via matching query key `['cart']`.
- **Automatic cache invalidation**: `invalidateQueries({ queryKey: ['cart'] })` after any cart mutation updates all consumers — eliminates manual `refreshCart()` coordination.
- **Reduced boilerplate**: ~15 lines of `useState`/`useEffect`/`try`/`catch` per page replaced by 3-5 lines of hook usage.
- **Built-in retry**: Transient network failures retry once automatically (`retry: 1`).
- **Background refetching**: Stale queries refetch when the window regains focus, keeping data fresh without manual intervention.
- **DevTools**: `@tanstack/react-query-devtools` provides cache inspection during development.

### Negative

- **New dependency**: `@tanstack/react-query` (~13 KB gzipped) and `@ts-rest/react-query` added to the bundle.
- **Learning curve**: Developers must understand query keys, stale time, cache invalidation, and the distinction between `isPending` (no cached data) vs `isFetching` (background refetch).
- **Dual client during migration**: `api` and `tsr` coexist in `api-client.ts` until auth context is migrated. Both share the same underlying fetch and configuration.
- **Optimistic updates rewrite**: The cart page's manual optimistic update pattern (update local state → revert on error) must be reimplemented using TanStack Query's `onMutate`/`onError`/`onSettled` callbacks.

### AI-Friendliness Impact

- **Discoverability**: 5/5 — `tsr.cart.addItem.useMutation` is greppable and maps directly to the contract method. An LLM searching for "cart add item" finds both the hook usage and the contract definition.
- **Cohesion**: 4/5 — Server state logic moves from scattered `useState`/`useEffect` blocks into hook calls co-located with the component that renders the data. Query configuration (stale time, retry) centralizes in `main.tsx`.
- **Pattern consistency**: 5/5 — Every page follows one pattern: `tsr.<module>.<method>.useQuery` for reads, `tsr.<module>.<method>.useMutation` for writes. Replaces 7 different manual fetch implementations.
- **Type coverage**: 5/5 — `@ts-rest/react-query` infers response types from the contract. `data.body.products` is typed without manual `ClientInferResponseBody` annotations.
- **Traceability**: 5/5 — Import chain: `tsr.products.list.useQuery` → `api-client.ts` → `initTsrReactQuery(apiContract)` → `@mercado/api-contracts` → `productsContract` → Zod schemas. Identical to the existing `api` client chain, with added hook wrappers.

**Overall AI-friendliness: 5/5**

## Options Considered

### Option A: @ts-rest/react-query + TanStack Query v5 (chosen)

The `@ts-rest/react-query` package wraps TanStack Query and generates typed hooks from the existing `apiContract`. Setup requires `initTsrReactQuery(apiContract, options)` — a one-line change from the existing `initClient` call. Hooks mirror the contract structure (`tsr.products.list.useQuery`), so an LLM maps hook → contract → schema via imports.

**Trade-offs:** Adds two packages (~15 KB gzipped combined). Requires provider setup in `main.tsx`. The `@ts-rest/react-query` package must stay version-compatible with both `@ts-rest/core` and `@tanstack/react-query`.

**AI-friendliness: 5/5** — Hook names match contract method names. No indirection layer.

### Option B: TanStack Query v5 with manual query functions

Use `@tanstack/react-query` directly with the existing `api` client:

```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api-client';

const { data } = useQuery({
  queryKey: ['products', page],
  queryFn: () => api.products.list({ query: { status: 'active', page, limit: PAGE_SIZE } }),
});
```

**Rejected because:**
- Every query requires a manual `queryFn` wrapper around the `api` call. This is boilerplate that `@ts-rest/react-query` eliminates.
- Response type inference requires explicit generics or type annotations — `@ts-rest/react-query` infers them automatically from the contract.
- No typed `useQueryClient` — cache operations (`setQueryData`, `invalidateQueries`) lack response type safety.

**AI-friendliness: 4/5** — Still has import chain via `api`, but the `queryFn` wrapper is an extra indirection that adds noise.

### Option C: SWR

Vercel's `swr` package provides caching and revalidation with a simpler API:

```typescript
import useSWR from 'swr';
const { data, error, isLoading } = useSWR(['products', page], () =>
  api.products.list({ query: { status: 'active', page, limit: PAGE_SIZE } }),
);
```

**Rejected because:**
- No official ts-rest integration. Every fetch requires a manual wrapper function.
- Mutation support is limited compared to TanStack Query — no built-in `useMutation` with `onSuccess`/`onError`/`onSettled` callbacks.
- Cache invalidation uses string-based `mutate(key)` rather than TanStack Query's structured `invalidateQueries({ queryKey })`.
- Smaller ecosystem: no equivalent of `@tanstack/react-query-devtools`.

**AI-friendliness: 3/5** — No typed integration with ts-rest. LLMs must write manual wrappers for every endpoint.

### Option D: Keep manual useEffect + useState

Status quo. No new dependencies.

**Rejected because:**
- Every new page requires reimplementing the same 15-line fetch pattern.
- No caching means redundant requests on every navigation.
- Cart state synchronization requires manual `refreshCart()` coordination — bug-prone and already causing stale badge counts.
- No retry mechanism for transient failures.

**AI-friendliness: 2/5** — Each page's fetch logic is unique enough to confuse LLMs. Seven different implementations of the same pattern with subtle variations.

## Migration Path

Each step is independently shippable and testable.

1. **Install packages.** Run `pnpm --filter @mercado/web add @tanstack/react-query @ts-rest/react-query`. Verify: `pnpm install` succeeds, `pnpm --filter @mercado/web typecheck` passes.

2. **Add tsr client to api-client.ts.** Add the `tsr` export alongside the existing `api` export in `apps/web/src/lib/api-client.ts`. Both use identical configuration. Verify: `npx tsc --noEmit apps/web/src/lib/api-client.ts` passes.

3. **Set up providers in main.tsx.** Add `QueryClientProvider` and `tsr.ReactQueryProvider` wrapping the existing providers in `apps/web/src/main.tsx`. Verify: app starts without errors, existing pages still work (they still use `api` directly).

4. **Migrate products.tsx.** Replace `useState`/`useEffect` fetch with `tsr.products.list.useQuery`. Remove manual `loading`/`error` state. Verify: products page loads, pagination works, `pnpm --filter @mercado/web typecheck` passes.

5. **Migrate product-detail.tsx.** Replace product fetch with `tsr.products.getBySlug.useQuery`. Replace `addItem` with `tsr.cart.addItem.useMutation` + `invalidateQueries({ queryKey: ['cart'] })`. Verify: product detail loads, add-to-cart updates badge.

6. **Migrate cart-context.tsx.** Replace manual `fetchCartCount` with `tsr.cart.getCart.useQuery({ queryKey: ['cart'] })`. Remove `refreshCart` — consumers invalidate the `['cart']` query key instead. Verify: badge count updates after add/remove item.

7. **Migrate cart.tsx.** Replace cart fetch with `tsr.cart.getCart.useQuery`. Replace `updateItem`, `removeItem`, `clearCart` with `useMutation` hooks that invalidate `['cart']`. Reimplement optimistic updates via `onMutate`/`onError`/`onSettled`. Verify: cart operations work, badge stays in sync.

8. **Migrate checkout.tsx.** Replace cart fetch with `tsr.cart.getCart.useQuery`. Replace checkout submit with `tsr.checkout.checkout.useMutation`. Verify: checkout flow works end-to-end.

9. **Migrate order-confirmation.tsx.** Replace order fetch with `tsr.orders.getByOrderNumber.useQuery`. Verify: order confirmation page loads.

10. **Clean up.** If auth context remains on manual `api` calls, keep the `api` export. Remove unused `ClientInferResponseBody` imports from migrated files. Optionally add `@tanstack/react-query-devtools` as a dev dependency. Run `pnpm lint && pnpm --filter @mercado/web typecheck && pnpm test:e2e`.
