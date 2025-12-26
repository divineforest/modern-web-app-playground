# Suggested Development Commands

## Essential Commands for Development

### Package Management
```bash
# Install dependencies (pnpm version from package.json)
corepack enable
pnpm install

# Use Node.js version from .nvmrc
nvm use
```

### Development Server
```bash
# Start Fastify server in development (with hot reload)
pnpm dev

# Start production build
pnpm start

# Build TypeScript to JavaScript
pnpm build
```

### Database Management
```bash
# Start PostgreSQL database (dev + test databases)
docker-compose up -d

# View database logs
docker-compose logs

# Stop and reset database (removes data)
docker-compose down -v

# Database operations
pnpm db:generate           # Generate migrations
pnpm db:migrate            # Run migrations
pnpm db:push              # Push schema changes
pnpm db:studio            # Open Drizzle Studio GUI
pnpm db:introspect        # Introspect existing database
pnpm db:check             # Check schema consistency
```

### Temporal Workflow Management
```bash
# Start local Temporal server
temporal server start-dev

# Start Temporal worker (processes workflows)
pnpm temporal:worker

# Access Temporal Web UI
# http://localhost:8233
```

### Testing Commands
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Generate coverage report
pnpm test:coverage

# Type checking
pnpm typecheck             # TypeScript type checking
pnpm type-coverage         # Check type coverage (min 97%)
pnpm type-coverage:detail  # Detailed type coverage report
```

### Code Quality Commands
```bash
# Unified commands (recommended)
pnpm lint                  # Run both Biome and ESLint
pnpm lint:fix              # Auto-fix both Biome and ESLint issues
pnpm check:fix             # Format & lint with Biome (fast)

# Individual tool commands
pnpm format                # Format code (Biome)
pnpm lint:biome            # Lint with Biome only
pnpm lint:biome:fix        # Auto-fix Biome issues
pnpm lint:eslint           # Lint with ESLint only
pnpm lint:eslint:fix       # Auto-fix ESLint issues

# Other quality checks
pnpm spell                 # Spell check
pnpm spell:fix             # Fix spelling issues
pnpm secrets               # Secret detection
pnpm knip                  # Dead code detection
```

### Utility Commands
```bash
# Sync contacts (CLI script)
pnpm sync:contacts

# Environment setup
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/accounting_dev"
```

## Development Workflow Commands

### Starting Development Environment
```bash
# 1. Start database
docker-compose up -d

# 2. Start Temporal server (in separate terminal)
temporal server start-dev

# 3. Set environment variables
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/accounting_dev"

# 4. Install dependencies
corepack enable && pnpm install

# 5. Start development server
pnpm dev
```

### Before Committing
```bash
# Run all quality checks
pnpm lint                  # Check linting
pnpm typecheck             # Check types
pnpm test                  # Run tests
pnpm type-coverage         # Verify type coverage
```

### Database Reset
```bash
# Complete database reset
docker-compose down -v     # Stop and remove data
docker-compose up -d       # Start fresh
pnpm db:migrate           # Run migrations
```

## Environment Setup
```bash
# Development databases available:
# - Development: postgresql://postgres:postgres@localhost:5432/accounting_dev
# - Test: postgresql://postgres:postgres@localhost:5432/accounting_test

# Temporal server:
# - Server: localhost:7233
# - Web UI: http://localhost:8233
```

## Git Hooks (Automated)
The project uses Husky for automated quality gates:
- **Pre-commit**: Auto-formats staged files, runs ESLint, checks type coverage
- **Manual bypass**: `git commit --no-verify -m "message"` (emergency only)

## CI/CD Commands
These commands are run automatically in CI/CD:
- `pnpm lint` (Biome + ESLint)
- `pnpm typecheck`
- `pnpm test`
- `pnpm type-coverage`
- `pnpm build`
- `pnpm secrets`