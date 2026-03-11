# AGENTS.md

E-commerce system (Mercado).

## Monorepo Structure

This project uses a **pnpm workspace monorepo**:
- `apps/backend/` — Fastify 5 HTTP server (package name: `@mercado/backend`)
- `apps/web/` — React + Vite frontend (package name: `@mercado/web`)
- `packages/api-contracts/` — Shared ts-rest API contracts consumed by both apps
- Run commands from root: `pnpm <command>` automatically targets the backend package

## Project Stack

Node.js 22+, TypeScript, Fastify, PostgreSQL, Temporal workflows, ts-rest (type-safe APIs), Drizzle ORM, Vitest, Vite, React.

## Commands

Always use pnpm: `pnpm <script-name>` for package scripts, `pnpm exec ./path/to/script` for others. When renaming files, use `git mv` instead of Write + Delete.

### Process Management (Makefile)

The `Makefile` at the project root manages the full local stack. Prefer these over running services manually.

```bash
make dev          # Start Postgres + backend + web (idempotent)
make stop         # Kill app processes and bring down Docker
make status       # Show PID + liveness for each service
make logs         # Tail logs/backend.log and logs/web.log
make worker       # Start Temporal worker (not included in make dev)
make backend      # Start/restart backend only
make web          # Start/restart web only
```

### Backend

```bash
pnpm dev              # Start backend in watch mode
pnpm build            # Compile contracts + backend
pnpm test             # Run backend unit tests
pnpm test:smoke       # Verify server starts and health endpoints respond
```

### Frontend

```bash
pnpm dev:web          # Vite dev server on :5173
pnpm build:web        # Production build
pnpm test:e2e         # Playwright end-to-end tests
```

The web app's visual language (palette, typography, shadows, component treatments, page-specific styling) is documented in [`docs/style-guide.md`](docs/style-guide.md).

### Database

```bash
pnpm db:generate      # Generate Drizzle migration from schema changes
pnpm db:migrate       # Apply migrations to dev database
pnpm db:migrate:test  # Apply migrations to test database
```

## Architecture

### Backend Module Structure

Each domain module in `apps/backend/src/modules/<domain>/` follows:
```
api/          ← ts-rest route handlers (thin — delegate to services)
domain/       ← domain types and validation errors
services/     ← business logic
repositories/ ← database queries (Drizzle)
```

Shared infrastructure lives in:
- `src/infra/` — Fastify plugins (auth, health, metrics)
- `src/db/` — Drizzle connection, schema, migrations
- `src/lib/` — Utilities (env parsing, HTTP client, error transformers, logging)
- `src/shared/` — Domain-agnostic SDK clients only (no business logic; if the method name contains a domain term, it belongs in `src/modules/<domain>/`)

### API Contracts

`packages/api-contracts/` defines ts-rest contracts shared between backend and frontend. The backend registers handlers against these contracts; the frontend calls them via `tsr` (the typed ts-rest React Query client at `apps/web/src/lib/api-client.ts`).

When adding a new endpoint:
1. Add the route to the contract in `packages/api-contracts/src/`
2. Implement the handler in the appropriate `modules/<domain>/api/` file
3. Register it in `apps/backend/src/app.ts`

### Authentication

Session-cookie auth. Routes requiring auth are wrapped with the auth plugin at registration time in `app.ts`.

### Database Migrations

**Never manually create or edit migration files** — Drizzle-kit tracks via `meta/_journal.json`; manual `.sql` files are silently ignored. Workflow: edit `src/db/schema-local.ts` → `pnpm db:generate` → review SQL → `pnpm db:migrate`.

### Infrastructure Changes

After modifying `env.ts`, `app.ts`, `server.ts`, `db/connection.ts`, `src/infra/**`, or any config/deployment file, run `pnpm test:smoke`.

## Code Style

Biome (formatting) + ESLint (linting). Run `pnpm lint` for both.

## Coding Conventions

### Tests

- One `X.test.ts` per `X.ts`, co-located next to the source file
- Tests use `buildTestApp()` for integration tests and `afterEach` DB cleanup

### Specs

Feature specs live in `docs/specs/`. Use `FR-*` for functional requirements, `TR-*` for technical constraints.

## After Changes

- `pnpm lint`, `pnpm test`, `pnpm typecheck`, `pnpm type-coverage`
- If implementing from `docs/specs/`: Remove 🚧 from completed items
- If the task touched `apps/web/`: use the browser tool to walk through the primary user flow end-to-end
- If implementing a user-facing feature with E2E scenarios in the spec: write Playwright tests covering those scenarios in `apps/web/e2e/`. Follow existing patterns (`apps/web/e2e/*.spec.ts`, page objects in `apps/web/e2e/pages/`). Run `pnpm test:e2e` to verify.
