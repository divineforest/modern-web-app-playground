# API Contracts Architecture

## Overview

`@mercado/api-contracts` is a shared workspace package that defines the entire API surface using [ts-rest](https://ts-rest.com/) contracts and [Zod](https://zod.dev/) schemas. It is the single source of truth consumed by both backend (route handlers) and frontend (typed client).

**Key properties:**
- Compile-time type safety across the full stack
- Runtime request/response validation via Zod
- Automatic OpenAPI spec generation
- No code duplication between backend and frontend

## Package Structure

```
packages/api-contracts/src/
├── index.ts                    # Public API — re-exports all contracts and schemas
├── router.ts                   # Root apiContract combining all domain contracts
├── shared/
│   ├── errors.ts               # Reusable error response schemas
│   └── pagination.ts           # Pagination metadata schema
└── {domain}/                   # One directory per domain (e.g. cart/, products/)
    ├── contract.ts             # ts-rest contract definition
    └── schemas.ts              # Zod I/O schemas
```

Dependencies: `@ts-rest/core`, `zod` only.

## Contract Definition Pattern

Each domain follows the same structure — a `contract.ts` using `initContract()` and a `schemas.ts` with Zod schemas:

```typescript
// {domain}/contract.ts
import { initContract } from '@ts-rest/core';
import { someResponseSchema } from './schemas.js';
import { validationErrorSchema, internalErrorSchema } from '../shared/errors.js';

const c = initContract();

export const exampleContract = c.router({
  list: {
    method: 'GET',
    path: '/api/example',
    query: z.object({ page: z.coerce.number().default(1) }),
    responses: {
      200: listResponseSchema,
      400: validationErrorSchema,
      500: internalErrorSchema,
    },
    summary: 'List items',
  },
  // ... more endpoints
});
```

### Root Router

All domain contracts are combined into a single `apiContract` in `router.ts`, enabling `api.cart.addItem()`, `api.products.list()`, etc. on both backend and frontend. See `router.ts` for the current list of domains.

## Shared Schemas

### Error Responses (`shared/errors.ts`)

Reusable error schemas mapped to standard HTTP status codes (400, 401, 404, 409, 422, 500). All follow `{ error: string, details?: ... }` shape. Every contract endpoint includes the relevant error responses.

### Pagination (`shared/pagination.ts`)

Standard pagination metadata (`total`, `page`, `limit`, `totalPages`) used in paginated list responses.

## Backend Consumption

**Pattern:** ts-rest/fastify in `apps/backend/src/modules/*/api/*.routes.ts`:

```typescript
import { productsContract } from '@mercado/api-contracts';
import { initServer } from '@ts-rest/fastify';

const s = initServer();

const router = s.router(productsContract, {
  list: async ({ query }) => {
    const result = await productService.list(query);
    return { status: 200, body: result };
  },
});

s.registerRouter(productsContract, router, fastify, { logInitialization: true });
```

Routes are registered in `apps/backend/src/app.ts`, split into public and protected (behind auth plugin) scopes.

## Frontend Consumption

**Dual client** setup in `apps/web/src/lib/api-client.ts`:

```typescript
import { apiContract } from '@mercado/api-contracts';
import { initClient } from '@ts-rest/core';
import { initTsrReactQuery } from '@ts-rest/react-query/v5';

// Standalone client — for contexts and non-React code
export const api = initClient(apiContract, { baseUrl: '', credentials: 'include' });

// React Query client — for components with hooks
export const tsr = initTsrReactQuery(apiContract, { baseUrl: '', credentials: 'include' });
```

**Query pattern** (components):

```typescript
const { data, isPending } = tsr.products.list.useQuery({
  queryKey: ['products', page],
  queryData: { query: { status: 'active', page, limit: PAGE_SIZE } },
});
```

**Mutation pattern:**

```typescript
const mutation = tsr.checkout.checkout.useMutation({
  onSuccess: (response) => {
    if (response.status === 200) { /* success */ }
    else if (response.status === 422) { /* validation error */ }
  },
});
mutation.mutate({ body: { shippingAddress: { ... } } });
```

**Standalone client** (contexts):

```typescript
const res = await api.auth.me();
if (res.status === 200) { setUser(res.body); }
```

## OpenAPI Generation

OpenAPI 3.0.3 spec is generated from contracts via `@ts-rest/open-api` (`generateOpenApi()`). The generation script (`apps/backend/src/scripts/generate-openapi.ts`) supports filtering by contract and outputs a standalone JSON spec. Swagger UI serves the spec at `/docs` in development via `@fastify/swagger-ui`.

Contracts' `summary` and `description` fields appear in the generated spec. Path params, query, body, and response schemas are all extracted automatically from Zod definitions.

## Conventions

### Monetary Amounts

All prices and monetary values are string decimals (e.g. `"29.99"`), not floats:

```typescript
z.coerce.number().min(0).transform(val => val.toFixed(2))  // input
z.string()  // response — already formatted
```

### Enum Values

Defined as `const` arrays, exported as union types:

```typescript
const statusValues = ['draft', 'active', 'archived'] as const;
export type Status = typeof statusValues[number];
```

### Response Shape

All endpoints return discriminated unions keyed by HTTP status. Consumers check `status` to narrow the body type:

```typescript
{ status: 200, body: SuccessType } | { status: 400, body: ValidationError } | ...
```

### Naming

- Contract variables: `{domain}Contract` (e.g. `cartContract`)
- Schema variables: `{entity}{Purpose}Schema` (e.g. `addItemSchema`, `cartResponseSchema`)
- Paths: `/api/{domain}/{action}`
