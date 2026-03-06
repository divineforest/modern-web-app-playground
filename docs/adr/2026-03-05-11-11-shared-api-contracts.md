# Shared API Contracts

**Status:** accepted
**Date:** 2026-03-05 11:11

## Context

The frontend (`apps/web/`) consumed backend APIs via plain `fetch()` with hand-written TypeScript interfaces. These interfaces were manually maintained duplicates of the backend's ts-rest contracts and Zod schemas. No import chain existed between the two apps.

This caused two categories of problems:

**LLM hallucinations:** When an LLM worked on frontend code, it could not follow imports to discover the actual API surface. It had to search the backend, find contracts, then mentally map them to the frontend's manual types. This frequently produced hallucinated endpoint URLs, wrong HTTP methods, incorrect request bodies, and mismatched response shapes. The `Product` interface was independently defined in both `products.tsx` and `product-detail.tsx` — even human developers duplicated it within the same app.

**Production drift:** Nothing enforced that frontend types matched backend contracts. A backend change to a response field silently broke the frontend at runtime. TypeScript could not catch what it could not see across the app boundary.

### Pre-decision state

```
apps/backend/src/modules/cart/api/cart.contracts.ts      → cartContract (Zod + ts-rest)
apps/backend/src/modules/products/api/products.contracts.ts → productsContract
apps/backend/src/modules/orders/api/orders.contracts.ts   → ordersContract

apps/web/src/pages/cart.tsx           → manual CartItem, Cart interfaces + fetch('/api/cart')
apps/web/src/pages/products.tsx       → manual Product, PaginationMeta interfaces + fetch('/api/products')
apps/web/src/pages/product-detail.tsx → manual Product interface (duplicate) + fetch('/api/products/by-slug/:slug')
```

Additional issues:
- Error schemas (`validationErrorSchema`, `notFoundErrorSchema`, `internalErrorSchema`) were copy-pasted identically across all 3 contract files.
- `paginationSchema` existed only in `products.contracts.ts` — not reusable.
- The OpenAPI generator only included `orders`; cart and products were missing.

## Decision

Create a contracts package (`@mercado/api-contracts`) and use the ts-rest typed client on the frontend. Both apps depend on this package; neither depends on the other.

### 1. Package: `@mercado/api-contracts`

A workspace package that owns all API contracts, shared Zod schemas, and the root contract.

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
    │   └── schemas.ts        # Cart domain schemas (addItemSchema, cartResponseSchema, etc.)
    ├── products/
    │   ├── contract.ts       # productsContract
    │   └── schemas.ts        # Product domain schemas
    ├── orders/
    │   ├── contract.ts       # ordersContract
    │   └── schemas.ts        # Order domain schemas
    └── router.ts             # Root apiContract combining all modules
```

**Dependencies:** `@ts-rest/core` and `zod` only. The contracts package SHALL NOT depend on backend or framework packages (Fastify, pg, etc.).

**Shared error schemas (defined once in `packages/api-contracts/src/shared/errors.ts`):**

```typescript
import { z } from 'zod';

export const validationErrorSchema = z.object({
  error: z.string(),
  details: z
    .union([z.string(), z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))])
    .optional(),
});

export const notFoundErrorSchema = z.object({ error: z.string() });
export const unauthorizedErrorSchema = z.object({ error: z.string() });
export const internalErrorSchema = z.object({ error: z.string() });
export const unprocessableEntityErrorSchema = z.object({ error: z.string() });
export const conflictErrorSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
});
```

**Contract pattern (each module follows this structure):**

```typescript
// packages/api-contracts/src/cart/contract.ts
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  internalErrorSchema,
  notFoundErrorSchema,
  unauthorizedErrorSchema,
  unprocessableEntityErrorSchema,
  validationErrorSchema,
} from '../shared/errors.js';
import {
  addItemSchema,
  cartResponseSchema,
  mergeCartSchema,
  successResponseSchema,
  updateItemSchema,
} from './schemas.js';

const c = initContract();

export const cartContract = c.router({
  getCart: {
    method: 'GET',
    path: '/api/cart',
    responses: { 200: cartResponseSchema, 500: internalErrorSchema },
    summary: 'Get current cart',
  },
  addItem: {
    method: 'POST',
    path: '/api/cart/items',
    responses: {
      200: cartResponseSchema,
      400: validationErrorSchema,
      404: notFoundErrorSchema,
      422: unprocessableEntityErrorSchema,
      500: internalErrorSchema,
    },
    body: addItemSchema,
    summary: 'Add item to cart',
  },
  updateItem: {
    method: 'PATCH',
    path: '/api/cart/items/:itemId',
    responses: { 200: cartResponseSchema, 400: validationErrorSchema, 404: notFoundErrorSchema, 500: internalErrorSchema },
    pathParams: z.object({ itemId: z.string().uuid() }),
    body: updateItemSchema,
    summary: 'Update item quantity',
  },
  // removeItem, mergeCart follow the same pattern
});
```

**Root contract (`packages/api-contracts/src/router.ts`):**

```typescript
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

### 2. Backend consumes contracts from the package

Backend route handlers import contracts from `@mercado/api-contracts`:

```typescript
// apps/backend/src/modules/cart/api/cart.routes.ts
import { cartContract } from '@mercado/api-contracts';
import { initServer } from '@ts-rest/fastify';

const s = initServer();

const router = s.router(cartContract, {
  getCart: async ({ request }) => { /* handler unchanged */ },
  addItem: async ({ request }) => { /* handler unchanged */ },
  // ...
});
```

Backend-internal types (entities, repository interfaces, service types) SHALL remain in each module's `domain/*.types.ts` files. Only Zod schemas that define the HTTP API surface (request bodies, response shapes, path params) SHALL live in the contracts package.

### 3. Frontend uses ts-rest typed client

Frontend components SHALL use the `api` client for all backend calls, replacing manual `fetch()`:

```typescript
// apps/web/src/lib/api-client.ts
import { apiContract } from '@mercado/api-contracts';
import { initClient } from '@ts-rest/core';

export const api = initClient(apiContract, {
  baseUrl: '',
  baseHeaders: {},
});
```

**Before/after — type inference in frontend components:**

Before (manual interfaces, no import chain to backend):

```typescript
// apps/web/src/pages/products.tsx — BEFORE
interface Product {
  id: string;
  name: string;
  slug: string;
  price: string;
  currency: string;
  imageUrl: string | null;
  // ... manually maintained, easily drifts
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const response = await fetch(`/api/products?status=active&page=${page}&limit=20`);
const data = await response.json() as { products: Product[]; pagination: PaginationMeta };
```

After (types inferred from contract via `ClientInferResponseBody`):

```typescript
// apps/web/src/pages/products.tsx — AFTER
import type { apiContract } from '@mercado/api-contracts';
import type { ClientInferResponseBody } from '@ts-rest/core';
import { api } from '../lib/api-client';

type ProductsListResponse = ClientInferResponseBody<typeof apiContract.products.list, 200>;
type Product = ProductsListResponse['products'][number];
type PaginationMeta = ProductsListResponse['pagination'];

const response = await api.products.list({
  query: { status: 'active', page, limit: PAGE_SIZE },
});
if (response.status === 200) {
  setProducts(response.body.products);  // fully typed
}
```

The `ClientInferResponseBody` utility extracts the response body type for a given status code directly from the contract. This pattern replaces all manual interfaces across the web app.

### 4. Workspace configuration

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

```jsonc
// apps/backend/package.json
{ "dependencies": { "@mercado/api-contracts": "workspace:*" } }

// apps/web/package.json
{ "dependencies": { "@mercado/api-contracts": "workspace:*", "@ts-rest/core": "^3.52.1" } }
```

## Consequences

### Positive

- **Single source of truth**: One contract definition consumed by backend routes, frontend client, and OpenAPI generator.
- **Compile-time safety**: TypeScript catches request/response mismatches in both apps at build time, before deployment.
- **LLM traceability**: An LLM working on frontend code follows `api.products.list` → `@mercado/api-contracts` → contract with exact path, method, query params, and response shape. Zero guessing.
- **Zod runtime validation**: The frontend gets access to Zod schemas for form validation and response parsing, not just static types.
- **DRY error schemas**: Error response schemas defined once in `packages/api-contracts/src/shared/errors.ts`, imported by all contracts.
- **Complete OpenAPI**: The root `apiContract` replaces the incomplete `AVAILABLE_CONTRACTS` array in the OpenAPI generator, covering all modules.

### Negative

- **Migration effort**: Moved contracts from 3 backend modules to a new package, updated all imports, rewrote frontend fetch calls. One-time cost, now complete.
- **New package to maintain**: `packages/api-contracts` requires its own `tsconfig.json`. In a pnpm workspace with TypeScript project references, this is ~20 lines of config.
- **Domain schema location shift**: Zod schemas for request/response shapes (e.g., `addItemSchema`, `cartResponseSchema`) moved from backend module `domain/` directories to the contracts package. Backend-internal types (entities like `CartIdentifier`, repository interfaces) remain in `apps/backend/src/modules/*/domain/*.types.ts`.

### AI-Friendliness Impact

- **Discoverability**: 5/5 — An LLM searching for "cart API" finds `@mercado/api-contracts/src/cart/contract.ts` as a single hit. Both backend routes and frontend client import from it.
- **Cohesion**: 4/5 — Contracts are inherently cohesive (one API surface). Centralizing them avoids scattering without pulling in unrelated code. Backend services/repositories remain co-located in their modules.
- **Pattern consistency**: 5/5 — Every module follows the identical `contract.ts` + `schemas.ts` structure. The ts-rest contract pattern is unchanged from the original backend-only usage — just relocated.
- **Type coverage**: 5/5 — The web app went from 0% typed API calls to 100%. Every `api.cart.addItem()` call is fully typed from the contract, including all response status codes.
- **Traceability**: 5/5 — Full import chain: `api.cart.addItem` → `api-client.ts` → `@mercado/api-contracts` → `cartContract` → `addItemSchema` + `cartResponseSchema` → Zod field definitions. An LLM can resolve any field to its schema definition via imports alone.

**Overall AI-friendliness: 5/5** — The core improvement is mechanical: import chains replace search-based discovery. When an LLM sees `api.cart.addItem({ body: { productId, quantity } })`, it resolves the import to the contract, reads the Zod schema, and sees every valid status code and response shape. This eliminates the class of hallucinations where the LLM invents endpoints or response fields.

## Options Considered

### Option A: Shared contracts package (chosen)

Dedicated `packages/api-contracts` package. Both apps depend on it via `workspace:*`. Frontend uses `@ts-rest/core` client initialized from the root `apiContract`.

**Trade-offs:** One-time migration cost (move contracts, update imports, rewrite fetch calls). Ongoing: compile-time type safety across the app boundary, zero manual type maintenance.

**AI-friendliness: 5/5** — Import chain connects frontend usage to backend contract definitions. LLMs resolve types without searching.

### Option B: Web imports contracts directly from backend

Configure `@mercado/web` to depend on `@mercado/backend` and import contracts via deep paths:

```typescript
import { cartContract } from '@mercado/backend/modules/cart';
```

**Rejected because:**
- Exposes all backend internals (services, repositories, db schemas) to the web app's dependency graph.
- Backend's Node.js-specific dependencies (Fastify, pg, Temporal SDK) leak into the web bundle unless carefully excluded via package.json `exports` field.
- Tight coupling: any backend directory restructure breaks web import paths.
- **AI-friendliness: 3/5** — Import chain exists but is noisy. An LLM must filter backend internals from contract exports.

### Option C: Generated types from OpenAPI

Generate TypeScript types from OpenAPI spec with `openapi-typescript`:

```bash
pnpm openapi:generate           # produces openapi.json
pnpm openapi-typescript openapi.json -o apps/web/src/generated/api.ts
```

**Rejected because:**
- Generated types are static — no Zod runtime validation on the frontend.
- Types go stale if the generation step is skipped. CI can enforce this, but it adds a build-order dependency.
- Generated code is opaque: an LLM can read the flat type file but cannot trace a type back to the source contract that produced it. Hallucination risk remains for anything not in the generated output.
- The existing OpenAPI generator was incomplete (only `orders`); fixing it was a prerequisite regardless.
- **AI-friendliness: 2/5** — Generated files are large, flat, and lack the semantic structure of contracts. No import chain from type to schema definition.

## Migration Path

Each step was independently shippable and testable.

1. **Create contracts package skeleton.** Run `mkdir -p packages/api-contracts/src/{shared,cart,products,orders}`. Add `package.json` (`@mercado/api-contracts` with `@ts-rest/core` and `zod` dependencies) and `tsconfig.json`. Add `packages/*` to `pnpm-workspace.yaml`. Verify: `pnpm install` succeeds.

2. **Extract shared schemas.** Copy `validationErrorSchema`, `notFoundErrorSchema`, `internalErrorSchema` (identical across all 3 backend contract files) into `packages/api-contracts/src/shared/errors.ts`. Move `paginationSchema` from `products.contracts.ts` into `packages/api-contracts/src/shared/pagination.ts`. Add any missing error schemas (`unauthorizedErrorSchema`, `conflictErrorSchema`, `unprocessableEntityErrorSchema`). Verify: `npx tsc --noEmit` in `packages/api-contracts/`.

3. **Migrate cart contract.** Move Zod schemas (`addItemSchema`, `cartResponseSchema`, `updateItemSchema`, `mergeCartSchema`, `successResponseSchema`, `cartItemSchema`) from `apps/backend/src/modules/cart/` into `packages/api-contracts/src/cart/schemas.ts`. Move `cartContract` definition into `packages/api-contracts/src/cart/contract.ts`, updating imports to use relative paths within the package. Verify: `npx tsc --noEmit` in `packages/api-contracts/`.

4. **Update backend cart imports.** Change `apps/backend/src/modules/cart/api/cart.routes.ts` to import `cartContract` from `@mercado/api-contracts` instead of the local contract file. Update `apps/backend/src/modules/cart/index.ts` re-exports. Verify: `pnpm --filter @mercado/backend test` passes.

5. **Repeat steps 3–4 for products, then orders.** Same pattern: move schemas and contract, update backend imports, verify tests pass after each module.

6. **Create root contract.** Add `packages/api-contracts/src/router.ts` exporting `apiContract` that combines all three module contracts. Add `packages/api-contracts/src/index.ts` as the public API re-exporting all contracts, schemas, and the root contract. Verify: `import { apiContract } from '@mercado/api-contracts'` resolves in both apps.

7. **Set up frontend ts-rest client.** Run `pnpm --filter @mercado/web add @ts-rest/core @mercado/api-contracts`. Create `apps/web/src/lib/api-client.ts` with `initClient(apiContract, { baseUrl: '', baseHeaders: {} })`. Verify: `npx tsc --noEmit` in `apps/web/`.

8. **Migrate frontend pages one at a time.** For each page (`cart.tsx`, `products.tsx`, `product-detail.tsx`): replace manual interfaces with `ClientInferResponseBody<typeof apiContract.*.*, 200>` type aliases, replace `fetch()` calls with `api.*.*()` calls, remove dead interface definitions. Verify after each page: `pnpm --filter @mercado/web typecheck` passes.

9. **Fix OpenAPI generator.** Update `apps/backend/src/scripts/generate-openapi.ts` to import `apiContract` from `@mercado/api-contracts` instead of using the incomplete `AVAILABLE_CONTRACTS` array. Verify: `pnpm openapi:generate` produces a spec covering cart, products, and orders.

10. **Clean up.** Delete the now-empty contract files from backend modules (`apps/backend/src/modules/*/api/*.contracts.ts`). Remove orphaned schema files that moved to the contracts package. Verify: `pnpm lint && pnpm test && pnpm typecheck`.
