# Mercado

E-commerce backend (Fastify + TypeScript) with a React frontend, PostgreSQL, and Temporal workflows — structured as a pnpm monorepo.

## ✨ AI Assistant Setup Prompt

_Use this README to set up the complete development and test environment. Execute the setup commands, install dependencies, configure databases, run all tests and code quality checks to ensure everything passes and the project is ready for development._

## Stack

- **Backend**: Node.js 22+, TypeScript, Fastify 5, ts-rest (type-safe APIs), Drizzle ORM
- **Frontend**: React, Vite
- **Database**: PostgreSQL (Docker), Temporal (workflow orchestration)
- **Testing**: Vitest
- **Quality**: Biome + ESLint, CSpell, Gitleaks, Knip, 97% type coverage enforced

## Prerequisites

- Node.js 22+ (see `.nvmrc`)
- Docker & Docker Compose
- pnpm (via corepack: `corepack enable`)
- Temporal CLI (for workflows)

## Quick Start

```bash
corepack enable && pnpm install
make dev          # Start Postgres + backend + web
```

`make dev` starts Docker, waits for Postgres, then launches the backend and web dev servers (logs in `logs/`).

```bash
make status       # Show running PIDs and Docker status
make logs         # Tail all log files
make stop         # Kill app processes and bring down Docker
make worker       # Start Temporal worker (separate)
make backend      # Restart backend only
make web          # Restart web only
```

**First-time**: set `DATABASE_URL` to match `docker-compose.yml` credentials:

```bash
export DATABASE_URL="postgresql://<user>:<password>@localhost:5432/mercado_dev"
```

## Commands

### Database

```bash
pnpm db:generate           # Generate migration from schema changes
pnpm db:migrate            # Apply migrations (dev)
pnpm db:migrate:test       # Apply migrations (test)
pnpm db:seed               # Seed data
pnpm db:reset              # Reset database
pnpm db:studio             # Open Drizzle Studio GUI
```

### Testing

```bash
pnpm test                  # Run unit tests
pnpm test:watch            # Watch mode
pnpm test:coverage         # Coverage report
pnpm test:smoke            # Smoke tests
pnpm test:s3               # LocalStack S3 integration test
```

### Code Quality

```bash
pnpm typecheck             # Type checking
pnpm type-coverage         # Check type coverage (min 97%)
pnpm lint                  # Biome + ESLint
pnpm lint:fix              # Auto-fix both
pnpm format                # Format with Biome
pnpm spell                 # Spell check
pnpm secrets               # Secret detection
pnpm knip                  # Dead code detection
```

Pre-commit hook runs Biome format, ESLint, and type coverage check on staged files.
To bypass (emergencies only): `git commit --no-verify -m "message"`

### OpenAPI

```bash
pnpm openapi:generate                    # Generate OpenAPI spec
pnpm openapi:generate:lint               # Generate + lint
pnpm openapi:preview                     # Preview docs in browser
pnpm openapi:generate --contract=contacts  # Generate specific contract
```

### Build

```bash
pnpm build                 # TypeScript build to dist/
pnpm build:web             # Production web build
pnpm preview:web           # Preview production web build
```

### Temporal

```bash
temporal server start-dev  # Start local server (localhost:7233, UI :8233)
pnpm temporal:hello-world  # Run example workflow
```

## Docs

- [`AGENTS.md`](./AGENTS.md) — full architecture, conventions, and commands for AI agents
- [`docs/architecture.md`](./docs/architecture.md) — system architecture
- [`docs/testing-guidelines.md`](./docs/testing-guidelines.md) — testing strategy
- [`docs/adr/`](./docs/adr/) — architecture decisions
- [`docs/specs/`](./docs/specs/) — feature specifications
