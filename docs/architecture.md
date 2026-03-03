# Mercado Architecture

## Overview

Backend e-commerce system (Mercado). Integrates with Core microservice.

**Stack**: Node.js 22+, TypeScript, Fastify, PostgreSQL, Temporal, ts-rest, Drizzle ORM, Vitest.

For testing strategy, see [Testing Architecture](./testing-architecture.md).

## Project Structure

```
src/
├── lib/                    # Core utilities (env.ts, logger.ts, http.ts)
├── config/                 # Derived configurations (database.ts, server.ts)
├── db/                     # Database layer
│   ├── schema.ts           # Drizzle schema (single source of truth)
│   ├── connection.ts       # Database connection factory
│   └── migrations/         # SQL migration files
├── infra/                  # Infrastructure/operational endpoints
│   ├── auth/               # Bearer token authentication plugin
│   └── health/             # Health check routes (/healthz, /ready)
├── modules/                # Domain-driven feature modules
│   ├── orders/             # Order management (CRUD, status tracking)
│   └── payment-webhooks/   # Stripe webhook processing (Temporal workflows)
├── shared/                 # Cross-module infrastructure
│   ├── data-access/        # External system clients
│   │   └── core/           # Core microservice (SDK + repository)
│   └── workflows/          # Temporal infrastructure (client, worker, registry)
├── scripts/                # CLI scripts
└── server.ts               # Fastify server entry point

tests/
├── factories/              # Test data factories
├── setup/                  # Test environment setup
└── smoke/                  # Smoke tests
```

## Architecture Layers

### Modules (`src/modules/`)

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

### Shared (`src/shared/`)

Cross-module infrastructure:
- **data-access/**: External system clients grouped by system (core)
- **workflows/**: Temporal client factory, worker setup, workflow registry

### Infrastructure (`src/infra/`)

Operational endpoints (health checks, metrics) separate from business logic.

## Database Conventions

### Schema

All tables defined in `src/db/schema.ts`. See actual file for current schema.

### Timestamps

Use `TIMESTAMP WITH TIME ZONE` for all timestamp columns:

```typescript
timestamp('created_at', { mode: 'date', withTimezone: true })
```

PostgreSQL stores in UTC, converts on retrieval.

### Migrations

- Generate: `pnpm db:generate`
- Apply: `pnpm db:migrate`
- Files: `src/db/migrations/`

## API Conventions

### Versioning

- **Internal** (`/api/internal/*`): Not versioned
- **Public** (`/api/v1/*`): Versioned for backward compatibility

### Contracts

API contracts defined via ts-rest in `api/*.contracts.ts`. OpenAPI generated automatically.

## Environment

Single source of truth: `src/lib/env.ts` (uses @t3-oss/env-core + Zod).

Template: `.env.example`

## Local Development

```bash
docker-compose up -d     # PostgreSQL
pnpm dev                 # Start server
pnpm temporal:worker     # Start Temporal worker (separate terminal)
```
