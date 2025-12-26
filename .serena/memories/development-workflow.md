# Development Workflow Guide

## Prerequisites Setup
```bash
# Install Node.js version from .nvmrc
nvm use

# Enable pnpm (version from package.json)
corepack enable

# Install dependencies
pnpm install
```

## Environment Setup

### Database
```bash
# Start PostgreSQL with dev and test databases
docker-compose up -d

# Databases available at:
# - Development: postgresql://postgres:postgres@localhost:5432/accounting_dev
# - Test: postgresql://postgres:postgres@localhost:5432/accounting_test

# Set environment variable for development
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/accounting_dev"
```

### Temporal Server
```bash
# Install Temporal CLI (macOS)
brew install temporal

# Start Temporal server locally
temporal server start-dev

# Server available at:
# - Temporal server: localhost:7233
# - Web UI: http://localhost:8233
```

## Daily Development Workflow

### 1. Start Development Environment
```bash
# Terminal 1: Start database
docker-compose up -d

# Terminal 2: Start Temporal server
temporal server start-dev

# Terminal 3: Start Fastify server
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/accounting_dev"
pnpm dev
```

### 2. Making Changes
```bash
# Make code changes (hot reload enabled)

# Run tests as you develop
pnpm test:watch

# Check types frequently
pnpm typecheck
```

### 3. Quality Checks Before Commit
```bash
# Run all quality checks
pnpm lint                  # Biome + ESLint
pnpm typecheck             # TypeScript types
pnpm test                  # All tests
pnpm type-coverage         # Verify 97%+ coverage

# Auto-fix issues if needed
pnpm lint:fix              # Auto-fix linting issues
pnpm check:fix             # Format with Biome
```

### 4. Commit Changes
```bash
# Git hooks will automatically:
# - Format staged files with Biome
# - Run ESLint on staged files
# - Check type coverage (97%+)
# - Prevent commit if issues found

git add .
git commit -m "feat: add new feature"
```

## Feature Development Workflow

### 1. Create New Module
```bash
# Create module directory structure
mkdir -p src/modules/new-feature/{api,services,repositories,domain}

# Create module files
touch src/modules/new-feature/index.ts
touch src/modules/new-feature/api/new-feature.routes.ts
touch src/modules/new-feature/api/new-feature.contracts.ts
touch src/modules/new-feature/services/new-feature.service.ts
# ... etc
```

### 2. Database Changes
```bash
# Update schema in src/db/schema-local.ts
# Generate migration
pnpm db:generate

# Run migration
pnpm db:migrate

# Verify in Drizzle Studio
pnpm db:studio
```

### 3. API Development
```bash
# Define ts-rest contracts first
# Implement Fastify routes
# Add authentication if needed
# Create tests alongside implementation
```

### 4. Testing
```bash
# Create test factories in tests/factories/
# Write integration tests for routes
# Write unit tests for services
# Run tests in watch mode
pnpm test:watch
```

## Code Quality Workflow

### Unified Commands (Recommended)
```bash
pnpm lint                  # Check both Biome and ESLint
pnpm lint:fix              # Auto-fix both tools
pnpm check:fix             # Format and basic lint (Biome only)
```

### Individual Tool Commands
```bash
# Biome (formatting + basic linting)
pnpm format                # Format code
pnpm lint:biome            # Check Biome rules
pnpm lint:biome:fix        # Auto-fix Biome issues

# ESLint (advanced linting)
pnpm lint:eslint           # Check ESLint rules
pnpm lint:eslint:fix       # Auto-fix ESLint issues
```

### Type Safety
```bash
pnpm typecheck             # TypeScript compilation check
pnpm type-coverage         # Check type coverage percentage
pnpm type-coverage:detail  # See which files need more types
```

## Database Workflow

### Schema Changes
```bash
# 1. Update schema files
# src/db/schema-local.ts for local tables
# src/db/schema-core.ts for core tables (read-only)

# 2. Generate migration (local tables only)
pnpm db:generate

# 3. Review generated migration in src/db/migrations/

# 4. Apply migration
pnpm db:migrate

# 5. Verify changes
pnpm db:studio
```

### Database Reset
```bash
# Complete reset (removes all data)
docker-compose down -v
docker-compose up -d
pnpm db:migrate

# Fresh test database
pnpm db:migrate:test
```

## Testing Workflow

### Running Tests
```bash
# All tests
pnpm test

# Watch mode (development)
pnpm test:watch

# Coverage report
pnpm test:coverage

# Specific test file
pnpm test src/modules/example/api/example.routes.test.ts
```

### Test Database
- Tests use real PostgreSQL test database
- Database is reset between test runs
- Use factories for creating test data
- Never mock database for integration tests

## Troubleshooting

### Database Issues
```bash
# Check database connection
docker-compose logs

# Reset database
docker-compose down -v && docker-compose up -d

# Recreate migrations
pnpm db:generate
pnpm db:migrate
```

### Type Issues
```bash
# Check TypeScript compilation
pnpm typecheck

# See type coverage details
pnpm type-coverage:detail

# Clean build artifacts
rm -rf dist/
pnpm build
```

### Linting Issues
```bash
# Auto-fix most issues
pnpm lint:fix

# Check specific tool
pnpm lint:biome
pnpm lint:eslint

# Format code
pnpm format
```

## Git Workflow

### Branch Strategy
- `main`: Production-ready code
- `develop`: Integration branch
- `feature/*`: Feature branches
- `fix/*`: Bugfix branches

### Pre-commit Hooks
Automated hooks run before each commit:
- Biome formats staged files
- ESLint checks staged TypeScript files
- Type coverage verifies 97%+ threshold
- Commit blocked if any check fails

### Bypassing Hooks (Emergency Only)
```bash
git commit --no-verify -m "emergency commit"
```

## Performance Tips

### Development
- Use `pnpm dev` for hot reload
- Run `pnpm test:watch` for continuous testing
- Use `pnpm check:fix` for quick formatting

### Database
- Keep database running in background
- Use connection pooling (configured)
- Run migrations only when schema changes

### Testing
- Use appropriate factories (build vs create)
- Run specific test files during development
- Use watch mode for faster feedback