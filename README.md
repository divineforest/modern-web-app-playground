# Backend Accounting System

NodeJS backend accounting system for EasyBiz with TypeScript, Docker, and PostgreSQL.

## ✨ AI Assistant Setup Prompt

_Use this README to set up the complete development and test environment. Execute the setup commands, install dependencies, configure databases, run all tests and code quality checks to ensure everything passes and the project is ready for development._

## Tech Stack

- Node.js 22+ with TypeScript
- Fastify web framework with ts-rest (type-safe APIs)
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

## Version Management

This project uses centralized version management:

- **Node.js**: Version specified in `.nvmrc` (use `nvm use`)
- **pnpm**: Version specified in `package.json` `packageManager` field

## Quick Start

**1. Start PostgreSQL Database**:

```bash
# Start PostgreSQL with dev and test databases
docker-compose up -d

# Databases available at:
# - Development: postgresql://postgres:postgres@localhost:5432/accounting_dev
# - Test: postgresql://postgres:postgres@localhost:5432/accounting_test
```

**2. Setup Temporal Server**:

```bash
# Install Temporal CLI (macOS)
brew install temporal

# Start Temporal server locally (runs on localhost:7233)
temporal server start-dev

# Server will be available at:
# - Temporal server: localhost:7233
# - Web UI: http://localhost:8233
```

**3. Setup Local Development**:

```bash
# Use Node.js version from .nvmrc (if using nvm)
nvm use

# Install dependencies (pnpm version from package.json)
corepack enable
pnpm install

# Set environment variables
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/accounting_dev"

# Run Fastify server locally
pnpm dev
```

## Development

**Database Management**:

```bash
docker-compose up          # Start PostgreSQL (foreground)
docker-compose up -d       # Start PostgreSQL in background
docker-compose logs        # View database logs
docker-compose down -v     # Stop and reset (removes data)
```

**Temporal Workflow Management**:

```bash
temporal server start-dev  # Start local Temporal server
pnpm temporal:worker       # Start Temporal worker (processes workflows)
pnpm temporal:hello-world  # Run example workflow
```

**Fastify Server Development**:

```bash
pnpm start                 # Start Fastify server
pnpm dev                   # Watch mode (with hot reload)
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
