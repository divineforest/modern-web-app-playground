# 001: Shared API Contracts

**Status:** proposed
**Date:** 2026-03-05

## Context

The frontend (`apps/web/`) consumes backend APIs via plain `fetch()` with hand-written TypeScript interfaces. These interfaces are manually maintained duplicates of the backend's ts-rest contracts and Zod schemas. There is no import chain between the two apps.

This causes two categories of problems:

**LLM hallucinations (AI assistant friction):** When an LLM works on frontend code, it cannot follow imports to discover the actual API surface. It must search the backend, find contracts, then mentally map them to the frontend's manual types. This frequently produces hallucinated endpoint URLs, wrong HTTP methods, incorrect request bodies, and mismatched response shapes. The `Product` interface is independently defined in both `products.tsx` and `product-detail.tsx` — even human developers duplicated it within the same app.

**Production drift:** Nothing enforces that frontend types match backend contracts. A backend change to a response field silently breaks the frontend at runtime. TypeScript cannot catch what it cannot see across the app boundary.

### Current State

```
apps/backend/src/modules/cart/api/cart.contracts.ts      → defines cartContract (Zod schemas + ts-rest)
apps/backend/src/modules/products/api/products.contracts.ts → defines productsContract
apps/backend/src/modules/orders/api/orders.contracts.ts   → defines ordersContract

apps/web/src/pages/cart.tsx           → manual CartItem, Cart interfaces + fetch('/api/cart')
apps/web/src/pages/products.tsx       → manual Product, PaginationMeta interfaces + fetch('/api/products')
apps/web/src/pages/product-detail.tsx → manual Product interface (duplicate) + fetch('/api/products/by-slug/:slug')
```

Additional issues:
- Error schemas (`validationErrorSchema`, `notFoundErrorSchema`, `internalErrorSchema`) are copy-pasted identically across all 3 contract files.
- `paginationSchema` exists only in `products.contracts.ts` — not reusable.
- The OpenAPI generator only includes `orders`; cart and products are missing.

## Decision

Create a shared contracts package and use the ts-rest typed client on the frontend.

### 1. New package: `packages/api-contracts`

A workspace package that owns all API contracts, shared Zod schemas, and the combined router.

**Package structure:**

```
packages/api-contracts/
├── package.json              # @mercado/api-contracts
├── tsconfig.json
└── src/
    ├── index.ts              # Public API: re-exports contracts + schemas
    ├── shared/
    │   ├── errors.ts         # Shared error response schemas
    │   └── pagination.ts     # Shared pagination schema
    ├── cart/
    │   ├── contract.ts       # cartContract
    │   └── schemas.ts        # Cart domain schemas (addItemSchema, etc.)
    ├── products/
    │   ├── contract.ts       # productsContract
    │   └── schemas.ts        # Product domain schemas
    ├── orders/
    │   ├── contract.ts       # ordersContract
    │   └── schemas.ts        # Order domain schemas
    └── router.ts             # Combined root contract for all modules
```

**Dependencies:** `@ts-rest/core`, `zod` only. No backend or framework dependencies.

**Shared error schemas (defined once):**

```typescript
// packages/api-contracts/src/shared/errors.ts
import { z } from 'zod';

export const validationErrorSchema = z.object({
  error: z.string(),
  details: z
    .union([z.string(), z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))])
    .optional(),
});

export const notFoundErrorSchema = z.object({
  error: z.string(),
});

export const unauthorizedErrorSchema = z.object({
  error: z.string(),
});

export const internalErrorSchema = z.object({
  error: z.string(),
});

export const conflictErrorSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
});
```

**Contract file pattern (each module follows the same structure):**

```typescript
// packages/api-contracts/src/cart/contract.ts
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { internalErrorSchema, notFoundErrorSchema, validationErrorSchema } from '../shared/errors.js';
import { addItemSchema, cartResponseSchema, updateItemSchema } from './schemas.js';

const c = initContract();

export const cartContract = c.router({
  getCart: {
    method: 'GET',
    path: '/api/cart',
    responses: {
      200: cartResponseSchema,
      500: internalErrorSchema,
    },
    summary: 'Get current cart',
  },
  addItem: {
    method: 'POST',
    path: '/api/cart/items',
    responses: {
      200: cartResponseSchema,
      400: validationErrorSchema,
      404: notFoundErrorSchema,
      500: internalErrorSchema,
    },
    body: addItemSchema,
    summary: 'Add item to cart',
  },
  // ... remaining endpoints
});
```

**Combined router (single entry point for the full API surface):**

```typescript
// packages/api-contracts/src/router.ts
import { initContract } from '@ts-rest/core';
import { cartContract } from './cart/contract.js';
import { ordersContract } from './orders/contract.js';
import { productsContract } from './products/contract.js';

const c = initContract();

export const apiContract = c.router({
  cart: cartContract,
  products: productsContract,
  orders: ordersContract,
});
```

**Public API (single import for consumers):**

```typescript
// packages/api-contracts/src/index.ts
export { apiContract } from './router.js';
export { cartContract } from './cart/contract.js';
export { productsContract } from './products/contract.js';
export { ordersContract } from './orders/contract.js';

export * from './shared/errors.js';
export * from './shared/pagination.js';
export * from './cart/schemas.js';
export * from './products/schemas.js';
export * from './orders/schemas.js';
```

### 2. Backend consumes contracts from the package

The backend routes import contracts from `@mercado/api-contracts` instead of co-located files:

```typescript
// apps/backend/src/modules/cart/api/cart.routes.ts
import { initServer } from '@ts-rest/fastify';
import { cartContract } from '@mercado/api-contracts';

const s = initServer();

const router = s.router(cartContract, {
  getCart: async ({ request }) => {
    // ... handler unchanged
  },
});
```

The backend's `domain/*.types.ts` files are removed or reduced to backend-internal types. Zod schemas that define the API surface move to the contracts package.

### 3. Frontend uses ts-rest typed client

Replace manual `fetch()` calls with a ts-rest client instantiated from the shared contract:

```typescript
// apps/web/src/lib/api-client.ts
import { initClient } from '@ts-rest/core';
import { apiContract } from '@mercado/api-contracts';

export const api = initClient(apiContract, {
  baseUrl: '',
  baseHeaders: {},
});
```

**Usage in components (replaces manual fetch + manual types):**

```typescript
// apps/web/src/pages/products.tsx
import { api } from '../lib/api-client.js';

export function ProductsPage() {
  const [products, setProducts] = useState</* inferred from contract */>([]);

  useEffect(() => {
    async function load() {
      const res = await api.products.list({
        query: { status: 'active', page: 1, limit: 20 },
      });

      if (res.status === 200) {
        setProducts(res.body.products);
      }
    }
    load();
  }, []);
}
```

What this eliminates:
- Manual `Product`, `CartItem`, `Cart`, `PaginationMeta` interfaces in web — all inferred from contracts
- Hard-coded URL strings like `fetch('/api/products?status=active')`
- Manual `JSON.parse()` and response type assertions
- Any possibility of calling a non-existent endpoint or sending a wrong body shape

### 4. Workspace configuration

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

```jsonc
// apps/backend/package.json (add dependency)
{ "dependencies": { "@mercado/api-contracts": "workspace:*" } }

// apps/web/package.json (add dependencies)
{
  "dependencies": {
    "@mercado/api-contracts": "workspace:*",
    "@ts-rest/core": "^3.52.1"
  }
}
```

## Consequences

### Positive

- **Single source of truth**: One contract definition consumed by backend routes, frontend client, and OpenAPI generator.
- **Compile-time safety**: TypeScript catches request/response mismatches in both apps at build time, before deployment.
- **LLM traceability**: An AI assistant working on frontend code follows `api.products.list` → import from `@mercado/api-contracts` → reads the contract with exact path, method, query params, and response shape. Zero guessing.
- **Zod runtime validation**: The frontend gets access to Zod schemas for form validation and response parsing, not just static types.
- **DRY error schemas**: Error response schemas defined once, imported everywhere.
- **OpenAPI fix**: The combined router (`apiContract`) replaces the incomplete `AVAILABLE_CONTRACTS` in the OpenAPI generator.

### Negative

- **Migration effort**: Moving contracts from 3 backend modules to a new package, updating all imports, rewriting frontend fetch calls.
- **New package to maintain**: `packages/api-contracts` needs its own `tsconfig.json` and build config. However, in a pnpm workspace with TypeScript project references, this is minimal.
- **Domain schema location shift**: Zod schemas for request bodies (e.g., `createOrderSchema`) move from `apps/backend/src/modules/orders/domain/` to the shared package. Backend-only types (entities, repository types) stay in the backend.

### AI-Friendliness Impact

- **Cohesion**: 4/5 — Contracts are inherently cohesive (they describe one API surface). Moving them to a shared package centralizes them without scattering. Backend services/repositories remain co-located in their modules.
- **Type coverage**: 5/5 — The web app goes from 0% typed API calls to 100%. Every `api.cart.addItem()` call is fully typed from the contract.
- **Pattern consistency**: 4/5 — Follows the existing ts-rest contract pattern exactly, just relocated. No new paradigm to learn.
- **Discoverability**: 5/5 — An LLM searching for "cart API" finds `@mercado/api-contracts/src/cart/contract.ts` as a single hit. Both backend routes and frontend client import from it, making the full data flow traceable via imports alone.

**Overall AI-friendliness: 5/5** — The core improvement is mechanical: import chains replace search-based discovery. When an LLM sees `api.cart.addItem({ body: { productId, quantity } })`, it can resolve the import to the contract, see the Zod schema, see every valid status code and response shape. This eliminates the class of hallucinations where the LLM invents endpoints or response fields.

## Options Considered

### Option A: Shared contracts package (recommended)

As described above. Creates `packages/api-contracts`, both apps depend on it, frontend uses `@ts-rest/core` client.

**Trade-offs:** Some upfront migration work, but pays back immediately in type safety and LLM accuracy.

### Option B: Web imports contracts directly from backend

Configure `@mercado/web` to depend on `@mercado/backend` and import contracts via deep paths like `@mercado/backend/modules/orders`.

```typescript
// Would require adding to apps/web/package.json:
{ "dependencies": { "@mercado/backend": "workspace:*" } }

// Usage:
import { cartContract } from '@mercado/backend/modules/cart';
```

**Rejected because:**
- Exposes all backend internals to the web app (services, repositories, db schemas).
- Backend's Node.js-specific dependencies (Fastify, pg, Temporal) would leak into the web bundle unless carefully excluded.
- Tight coupling — any backend refactor affects web import paths.
- AI-friendliness: 3/5 — import chain exists but is noisy; LLM must filter backend internals from contract exports.

### Option C: Generated types from OpenAPI

Extend the OpenAPI generator to include all contracts, then generate TypeScript types with `openapi-typescript`.

```bash
pnpm generate:openapi          # produces openapi.json
pnpm openapi-typescript openapi.json -o apps/web/src/generated/api.ts
```

**Rejected because:**
- Generated types are static — no Zod runtime validation on the frontend.
- Types go stale if generation step is forgotten (CI can enforce, but adds friction).
- Generated code is opaque to LLMs — they can read it but can't trace the *source* contract. Hallucination risk remains for anything not in the generated file.
- The existing OpenAPI generator is incomplete (only `orders`); fixing it is a prerequisite anyway.
- AI-friendliness: 2/5 — generated files are large, flat, and lack the semantic structure of contracts.

## Migration Path

1. Create `packages/api-contracts` with shared error/pagination schemas.
2. Move one contract at a time (start with `cart` — simplest).
3. Update backend imports for that module; verify tests pass.
4. Set up `@ts-rest/core` client in web; migrate one page at a time.
5. Remove manual interfaces from web pages as each is migrated.
6. Repeat for `products`, then `orders`.
7. Fix OpenAPI generator to use `apiContract` from the shared package.
