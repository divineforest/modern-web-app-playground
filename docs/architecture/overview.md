# Mercado Architecture

## Overview

E-commerce system with backend API and React frontend. Integrates with Core microservice.

**Stack**: Node.js 22+, TypeScript, Fastify, PostgreSQL, Temporal, ts-rest, Drizzle ORM, Vitest, React, Vite.

For testing strategy, see [Testing Architecture](./testing-architecture.md).

## Monorepo Structure

pnpm workspace with three packages:

```
packages/
└── api-contracts/              # Shared API contracts (ts-rest + Zod)
    ├── src/
    │   ├── shared/             # Shared error and pagination schemas
    │   ├── auth/               # Auth contract and schemas
    │   ├── cart/               # Cart contract and schemas
    │   ├── checkout/           # Checkout contract and schemas
    │   ├── products/           # Products contract and schemas
    │   ├── orders/             # Orders contract and schemas
    │   ├── router.ts           # Combined API contract
    │   └── index.ts            # Public API exports
    └── package.json            # @mercado/api-contracts

apps/
├── backend/                    # Fastify backend server
│   ├── src/
│   │   ├── lib/                # Core utilities (env.ts, logger.ts, http.ts)
│   │   ├── config/             # Derived configurations (database.ts, server.ts)
│   │   ├── db/                 # Database layer
│   │   │   ├── schema.ts       # Drizzle schema (single source of truth)
│   │   │   ├── connection.ts   # Database connection factory
│   │   │   ├── index.ts        # Public exports
│   │   │   └── migrations/     # SQL migration files
│   │   ├── infra/              # Infrastructure/operational endpoints
│   │   │   ├── auth/           # Bearer token authentication plugin
│   │   │   └── health/         # Health check routes (/healthz, /ready)
│   │   ├── modules/            # Domain-driven feature modules
│   │   │   ├── auth/           # User authentication (login, register, sessions)
│   │   │   ├── cart/           # Shopping cart (add/update/remove items)
│   │   │   ├── checkout/       # Checkout flow (order creation from cart)
│   │   │   ├── products/       # Product catalog (list, detail, search)
│   │   │   ├── orders/         # Order management (CRUD, status tracking)
│   │   │   └── payment-webhooks/ # Stripe webhook processing (Temporal workflows)
│   │   ├── shared/             # Cross-module infrastructure
│   │   │   ├── data-access/    # External system clients
│   │   │   │   └── core/       # Core microservice (SDK + repository)
│   │   │   └── workflows/      # Temporal infrastructure (client, worker, registry)
│   │   ├── scripts/            # CLI scripts
│   │   ├── app.ts              # Fastify app factory
│   │   ├── instrument.ts       # OpenTelemetry instrumentation
│   │   └── server.ts           # Server entry point
│   └── tests/
│       ├── factories/          # Test data factories
│       ├── fixtures/           # Test fixture files
│       ├── helpers/            # Test helper utilities
│       ├── setup/              # Test environment setup
│       └── smoke/              # Smoke tests
└── web/                        # React frontend (Vite + MUI)
    └── src/
        ├── lib/                # Shared utilities (api-client.ts)
        ├── components/         # Reusable components (cart-sidebar, require-auth)
        ├── contexts/           # React contexts (auth, cart)
        ├── assets/             # Static assets (images, SVGs)
        ├── pages/              # Page components (products, cart, checkout, login, register, orders)
        ├── layouts/            # Layout components (root-layout)
        └── router.tsx          # React Router configuration
```

## Architecture Layers

### Modules (`apps/backend/src/modules/`)

Self-contained domain features. Each module may contain:

| Directory | Purpose |
|-----------|---------|
| `api/` | HTTP routes and ts-rest contracts |
| `services/` | Business logic |
| `repositories/` | Data access |
| `workflows/` | Temporal workflows and activities |
| `domain/` | Types, entities, schemas |
| `index.ts` | Public exports |

**Conventions**:
- Naming: dashed-lowercase (`orders`, `payment-webhooks`)
- Tests: Colocated (`service.ts` + `service.test.ts`)
- Dependencies: Import other modules via their `index.ts`

### Shared (`apps/backend/src/shared/`)

Cross-module infrastructure:
- **data-access/**: External system clients grouped by system (core)
- **workflows/**: Temporal client factory, worker setup, workflow registry

### Infrastructure (`apps/backend/src/infra/`)

Operational endpoints (health checks, metrics) separate from business logic.

## Database Conventions

### Schema

All tables defined in `apps/backend/src/db/schema.ts`. See actual file for current schema.

### Timestamps

Use `TIMESTAMP WITH TIME ZONE` for all timestamp columns:

```typescript
timestamp('created_at', { mode: 'date', withTimezone: true })
```

PostgreSQL stores in UTC, converts on retrieval.

### Migrations

- Generate: `pnpm db:generate`
- Apply: `pnpm db:migrate`
- Files: `apps/backend/src/db/migrations/`

## API Conventions

### Versioning

- **Internal** (`/api/internal/*`): Not versioned
- **Public** (`/api/v1/*`): Versioned for backward compatibility

### Contracts (ts-rest + Zod)

**Single source of truth**: All API contracts live in `@mercado/api-contracts` package.

**Backend**: Route handlers consume contracts via `@ts-rest/fastify`:

```typescript
import { cartContract } from '@mercado/api-contracts';
const router = s.router(cartContract, { /* handlers */ });
```

**Frontend**: Typed client consumes contracts via `@ts-rest/core`:

```typescript
import { api } from './lib/api-client';
const res = await api.cart.getCart();
if (res.status === 200) {
  // res.body is fully typed from contract
}
```

**OpenAPI**: Generated automatically from contracts via `pnpm openapi:generate`.

See [API Contracts Architecture](./api-contracts.md) for detailed design.

## Environment

Single source of truth: `apps/backend/src/lib/env.ts` (uses @t3-oss/env-core + Zod).

## Local Development

```bash
docker-compose up -d     # PostgreSQL
pnpm dev                 # Start server
pnpm temporal:worker     # Start Temporal worker (separate terminal)
```
