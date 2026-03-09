# Mercado

E-commerce system with Node.js backend and React frontend, using TypeScript, Docker, and PostgreSQL.

**Monorepo Structure**: This project uses a pnpm workspace monorepo. The backend application lives in `apps/backend/` and the web frontend in `apps/web/`. Run commands from the root using `pnpm <command>` (which delegates to workspace packages via `--filter`).

## ✨ AI Assistant Setup Prompt

_Use this README to set up the complete development and test environment. Execute the setup commands, install dependencies, configure databases, run all tests and code quality checks to ensure everything passes and the project is ready for development._

## Tech Stack

- Node.js 22+ with TypeScript
- Fastify web framework with ts-rest (type-safe APIs)
- React with Vite (frontend)
- PostgreSQL with Drizzle ORM
- Temporal (workflow orchestration)
- Docker & Docker Compose
- Vitest (unit and integration testing)
- @t3-oss/env-core + Zod (type-safe config)
- Biome (formatting & basic linting) + ESLint (advanced linting)
- CSpell, Gitleaks, Knip

## Prerequisites

- Node.js 22+ (see `.nvmrc`)
- Docker & Docker Compose
- Temporal CLI (for local development)
- pnpm (via corepack)
- AWS CLI (recommended: `brew install awscli`)

## Version Management

This project uses centralized version management:

- **Node.js**: Version specified in `.nvmrc` (use `nvm use`)
- **pnpm**: Version specified in `package.json` `packageManager` field

## Quick Start

```bash
# Install dependencies
corepack enable && pnpm install

# Start full stack (Postgres + backend + web)
make dev
```

`make dev` starts Docker infrastructure, waits for Postgres to be ready, then launches the backend and web dev servers in the background with log files in `logs/`.

```bash
make status   # Show running PIDs and Docker status
make logs     # Tail all log files
make stop     # Kill app processes and bring down Docker
make worker   # Start Temporal worker (optional, separate command)
```

**First-time setup**:

```bash
# Use Node.js version from .nvmrc (if using nvm)
nvm use

# Set DATABASE_URL (see docker-compose.yml for POSTGRES_USER/POSTGRES_PASSWORD)
export DATABASE_URL="postgresql://<user>:<password>@localhost:5432/mercado_dev"
```

## Development

**Process Management (Makefile)**:

```bash
make dev          # Start Postgres + backend + web (idempotent — safe to re-run)
make stop         # Stop all app processes and Docker
make status       # Show PID + liveness for each service
make logs         # Tail logs/backend.log and logs/web.log
make worker       # Start Temporal worker separately
make backend      # Start/restart backend only
make web          # Start/restart web only
```

**Docker (infrastructure only)**:

```bash
docker compose up -d       # Start Postgres in background
docker compose down -v     # Stop and reset (removes data)
docker compose logs db     # View Postgres logs
```

**Temporal**:

```bash
temporal server start-dev  # Start local Temporal server (localhost:7233, UI :8233)
pnpm temporal:hello-world  # Run example workflow
```

**Web Frontend (standalone)**:

```bash
pnpm dev:web               # Vite dev server (http://localhost:5173)
pnpm build:web             # Production build
pnpm preview:web           # Preview production build
```

## Database

```bash
pnpm db:generate           # Generate migrations
pnpm db:migrate            # Run migrations
pnpm db:seed               # Seed data
pnpm db:reset              # Reset database
pnpm db:studio             # Open GUI
```

## OpenAPI

```bash
pnpm openapi:generate              # Generate OpenAPI spec
pnpm openapi:generate:lint         # Generate and lint OpenAPI spec
pnpm openapi:preview               # Preview OpenAPI docs in browser

# Generate a specific contract:
pnpm openapi:generate --contract=contacts  # Creates openapi-contacts.json

# Override the default file path for linting/preview using npm_config_file:
npm_config_file=generated/openapi/openapi-contacts.json pnpm openapi:generate:lint
npm_config_file=generated/openapi/openapi-contacts.json pnpm openapi:preview

# Note: The --file=... CLI flag is NOT supported by these scripts.
# To add direct --file support, modify package.json or generate-openapi.ts
# to accept and propagate a --file CLI argument.
```

## Build

```bash
pnpm build                 # TypeScript build to dist/
```

## Testing

```bash
pnpm test                  # Unit tests
pnpm test:watch            # Watch mode
pnpm test:coverage         # Coverage report
pnpm test:s3               # LocalStack S3 integration test
```

## Code Quality

```bash
# Type Checking
pnpm typecheck             # Type checking
pnpm type-coverage         # Check type coverage (min 97%)
pnpm type-coverage:detail  # Detailed type coverage report

# Formatting & Linting (Unified)
pnpm check:fix             # Format & basic lint with Biome
pnpm lint                  # Run both Biome and ESLint linting
pnpm lint:fix              # Auto-fix both Biome and ESLint issues

# Formatting & Linting (Individual Tools)
pnpm format                # Format code (Biome)
pnpm lint:biome            # Lint with Biome only
pnpm lint:biome:fix        # Auto-fix Biome issues
pnpm lint:eslint           # Lint with ESLint only (TypeScript type-aware)
pnpm lint:eslint:fix       # Auto-fix ESLint issues

# Other Quality Checks
pnpm spell                 # Spell check
pnpm secrets               # Secret detection
pnpm knip                  # Dead code detection
```

## Git Hooks

This project uses [Husky](https://typicode.github.io/husky/) for automated quality gates:

**Pre-commit Hook**:
- **Biome Format**: Automatically formats **staged files only** before every commit
- **ESLint Check**: Runs ESLint on staged TypeScript files to catch issues early
- **Type Coverage Check**: Enforces minimum 97% type coverage in strict mode
- Uses native Git commands to detect staged files (no extra dependencies)
- Only processes files you're committing (faster than checking entire codebase)
- Ensures consistent code style and quality across the repository
- Run `pnpm lint:eslint:fix` to auto-fix ESLint issues before committing
- Run `pnpm type-coverage:detail` to identify files needing better type annotations

**GUI Git Clients** (SourceTree, GitHub Desktop, etc.):
- Hooks are configured to work with GUI clients
- If you encounter PATH issues, ensure Node.js and corepack are properly installed

**Bypassing Hooks** (emergency use only):
```bash
git commit --no-verify -m "Your message"
```

**Hook Management**:
- Hook scripts located in `.husky/` directory
- Hooks auto-install via `prepare` script during `pnpm install`

## API Mocking

MSW (Mock Service Worker) for API mocking in tests (`src/mocks/`) with strict error handling.
