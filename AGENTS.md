# AGENTS.md

Backend e-commerce system (Mercado). Integrates with Core microservice.

## Monorepo Structure

This project uses a **pnpm workspace monorepo**:
- `apps/backend/` — Fastify 5 HTTP server (package name: `@mercado/backend`)
- `apps/web/` — React + Vite frontend (package name: `@mercado/web`)
- `packages/api-contracts/` — Shared ts-rest API contracts consumed by both apps
- Workspace root: manages shared tooling (biome, cspell, husky) and delegates backend commands via `--filter`
- Run commands from root: `pnpm <command>` automatically targets the backend package

## Project Stack

Node.js 22+, TypeScript, Fastify, PostgreSQL, Temporal workflows, ts-rest (type-safe APIs), Drizzle ORM, Vitest, Vite, React.

## Convention Over Configuration

Prefer sensible defaults over explicit configuration. Don't ask for or require values that can be reasonably inferred:

- **Local URLs**: Use `http://localhost:3000` for the backend server unless told otherwise
- **Web dev server**: Use `http://localhost:5173` for the Vite dev server unless told otherwise
- **Database**: Assume standard local dev connection (see docker-compose or .env.example)
- **Test environments**: Smoke tests run against local dev server by default
- **File paths**: Use project-standard locations (e.g., `apps/backend/src/`, `apps/web/src/`, `apps/backend/tests/`, `scripts/`)

When in doubt, use the most common/standard value and proceed. Only ask when the default genuinely won't work.

## Running Scripts

**Always use pnpm to run scripts instead of executing them directly.**

1. Check `package.json` "scripts" section first - use `pnpm <script-name>` if it exists
2. Otherwise, use `pnpm exec ./path/to/script` (e.g., `pnpm exec ./scripts/custom-script.sh`)
3. Never run scripts directly like `./scripts/smoke-test.sh` or `bash scripts/smoke-test.sh`

## File Operations

When renaming or moving files, use `git mv` via Shell instead of Write + Delete:

```bash
git mv old/path/file.ts new/path/file.ts
```

This avoids the Delete permission prompt that breaks auto-agent mode.

## Commands

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

- PID files live in `pids/`, log files in `logs/` (both gitignored)
- Re-running `make dev` prints "already running" instead of spawning duplicates
- Stale PID files (process crashed) are cleaned automatically on next start

### Backend

```bash
pnpm dev              # Start backend in watch mode (tsx watch)
pnpm build            # Compile contracts + backend (tsc)
pnpm test             # Run backend unit tests (vitest run)
pnpm test:watch       # Vitest in watch mode
pnpm test:coverage    # Vitest with coverage
pnpm test:smoke       # Verify server starts and health endpoints respond
```

Run a single test file:
```bash
pnpm test -- src/modules/auth/services/auth.service.test.ts
```

Run tests matching a name pattern:
```bash
pnpm test -- --grep "should register a new user"
```

### Frontend

```bash
pnpm dev:web          # Vite dev server on :5173
pnpm build:web        # Production build
pnpm test:e2e         # Playwright end-to-end tests
```

### Database

```bash
pnpm db:generate      # Generate Drizzle migration from schema changes (runs tsc first)
pnpm db:migrate       # Apply migrations to dev database
pnpm db:migrate:test  # Apply migrations to test database
pnpm db:studio        # Open Drizzle Studio
```

### Code Quality

```bash
pnpm lint             # Biome + ESLint (unified)
pnpm check:fix        # Biome auto-fix
pnpm lint:eslint      # ESLint only
pnpm typecheck        # tsc --noEmit
pnpm type-coverage    # Must stay above 97%
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

Session-cookie based (`sid` cookie, HttpOnly, SameSite=Lax, 7-day sliding expiry). Routes requiring auth are wrapped with the auth plugin at registration time in `app.ts`. The frontend's `CartProvider` and `RequireAuth` component handle client-side auth state.

### React Query Cache Keys

The frontend uses a global `['cart']` query key populated by `CartProvider` on mount. Any component can subscribe via `tsr.cart.getCart.useQuery({ queryKey: ['cart'] })` and will deduplicate with no extra network request. After mutating cart state, call `queryClient.invalidateQueries({ queryKey: ['cart'] })`.

### Database Migrations

**Never manually create or edit migration files.** Drizzle-kit tracks migrations via `meta/_journal.json` — manually created `.sql` files are silently ignored.

Correct workflow:
1. Edit `apps/backend/src/db/schema-local.ts`
2. `pnpm db:generate`
3. Review the generated SQL
4. `pnpm db:migrate`

Migration conventions:
- UUIDs: always `gen_random_uuid()` — never `uuid_generate_v4()`
- Constrained values: use CHECK constraints by default; only convert to ENUM after values are stable for 6+ months across 2+ tables
- ENUM naming: singular, snake_case, no `_enum`/`_type` suffix; values lowercase snake_case

### Infrastructure Changes

After modifying `env.ts`, `app.ts`, `server.ts`, `db/connection.ts`, `src/infra/**`, or any config/deployment file, run:
```bash
pnpm test:smoke
```
This validates server startup, `/healthz`, `/ready` (DB connectivity), and `/docs`.

## Code Style

- **Biome** for formatting and basic linting - run `pnpm check:fix`
- **ESLint** for advanced TypeScript linting - run `pnpm lint:eslint`
- **Both tools**: Run `pnpm lint` for unified linting (Biome + ESLint)
- **Enforced**: `import type` for TypeScript type imports
- Style: 2-space indent, 100 char width, single quotes, semicolons required

## Coding Conventions

### Tests

- One `X.test.ts` per `X.ts`, co-located next to the source file
- Test names describe business requirements, not implementation
- Tests use `buildTestApp()` for integration tests and `afterEach` DB cleanup

### Specs

Specs in `docs/specs/` describe **what** the system needs, not how to build it. Use `FR-*` for functional requirements (observable behavior) and `TR-*` for technical constraints. Do not prescribe internal naming, npm packages, or code structure. Data model sections describe the target state — never frame as "changes" or "migrations".

When writing a new feature spec, follow the workflow in `.agents/skills/create-spec/SKILL.md`. It requires reading `docs/specification-guide.md` and `docs/architecture.md`, a clarification phase before drafting, and self-scoring (minimum 8.0/10).

## After Changes

Before considering work complete, ensure all checks pass locally:

### Verification Strategy

Use a two-phase approach to avoid timeouts on large codebases:

**Phase 1: Check modified files first**
- Run TypeScript check on changed files only: `npx tsc --noEmit path/to/file1.ts path/to/file2.ts`
- Include direct importers of modified files
- This catches 95% of issues in <5 seconds

**Phase 2: Run full project checks**
- Only after Phase 1 passes, run full checks:
- `pnpm lint`
- `pnpm test`
- `pnpm typecheck`
- `pnpm type-coverage`
- If implementing from `docs/specs/`: Remove 🚧 from completed items

**Phase 3: Browser QA (for UI changes)**
- If the task touched `apps/web/` or added/modified user-facing features:
  1. Start dev servers if not running (backend and web)
  2. Use the browser tool to walk through the primary user flow end-to-end
  3. Verify: page loads, interactive elements work, data persists across navigation
  4. Check edge cases: empty states, error states, loading states
- Skip this phase for backend-only changes with no UI impact

## AI Feedback Loop

After completing a task, briefly evaluate:

1. **Friction encountered**: What slowed you down or was difficult to find/understand?
2. **Improvement idea**: If you have a concrete suggestion to reduce that friction, propose it
3. **Score**: Rate your suggestion 1-10 (10 = high confidence it helps AI, not just "seems useful")

**Rules**:
- Only report friction you actually experienced, not theoretical issues
- Skip if the task was smooth - no feedback needed
- Be brutally honest: documentation rarely helps AI; code quality improvements usually do
- Low-confidence suggestions (score < 7) should probably be skipped
