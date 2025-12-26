# Backend Accounting System Architecture

## Overview

This is a modern NodeJS backend accounting system built with TypeScript, designed for high performance, maintainability, and comprehensive testing.

## System Requirements

- **Node.js**: >=22.0.0
- **Package Manager**: pnpm (managed via corepack)
- **TypeScript**: Latest stable version
- **Target Environment**: Node.js server environment

## Testing Architecture

For comprehensive testing strategy, tools, and practices, see [Testing Architecture](./testing-architecture.md).

## Technology Stack

### Core Runtime

- **Language**: TypeScript with strict type checking
- **Runtime**: Node.js (ES Modules)
- **Module System**: ES Modules with `.js` extension imports

### Development Tools

#### Type Coverage Monitoring

- **Tool**: type-coverage
- **Purpose**: Measure and track TypeScript type safety across the codebase
- **Minimum Threshold**: 97 (enforced in CI/CD)
- **Metrics**: Percentage of code with explicit types vs `any` types
- **Benefits**: 
  - Quantifies TypeScript adoption progress
  - Identifies areas lacking type safety
  - Prevents regression to `any` types
  - Enforces minimum type coverage thresholds
  - Improves AI code comprehension and suggestions
- **Usage**: 
  - `pnpm type-coverage` - Check current coverage
  - `pnpm type-coverage:detail` - File-by-file breakdown

#### Package Management

- **Tool**: pnpm
- **Management**: Node.js corepack
- **Benefits**: Fast installs, efficient disk usage, strict dependency resolution

#### TypeScript Development

- **Compiler**: TypeScript with strict configuration
- **Direct Execution**: tsx for development without compilation
- **Build Target**: ES modules for Node.js
- **Type Coverage Tracking**: type-coverage for monitoring TypeScript adoption and type safety metrics

#### Code Quality & Formatting

- **Formatter & Basic Linting**: Biome for fast code formatting and basic linting
  - Purpose: Code style enforcement, formatting consistency, import organization
  - Features: Auto-formatting, import organization, basic linting rules
  - Configuration: Strict rules with TypeScript support
  - Performance: Extremely fast formatting and linting (Rust-based)
- **Advanced Linting**: ESLint for advanced code quality checks and TypeScript-specific rules
  - Purpose: Complex linting rules, TypeScript type-aware checks, extensible plugin ecosystem
  - Configuration: Disables all formatting/stylistic rules to avoid conflicts with Biome
  - TypeScript Support: Configured with @typescript-eslint parser and recommended rules
  - Extensibility: Plugin architecture enables domain-specific rules (future: financial, security plugins)
  - CI/CD Integration: Included in automated quality checks
- **Tool Separation**: Biome handles formatting and basic linting; ESLint handles advanced linting
- **Type Coverage**: type-coverage for measuring and enforcing TypeScript type safety
- **Spell Checking**: CSpell for code spell checking with custom dictionaries
- **Secret Detection**: Gitleaks for detecting secrets and sensitive information
- **Dead Code Detection**: Knip for finding unused files, dependencies, and exports

#### Configuration Management

- **Environment Management**: @t3-oss/env-core for robust environment variable handling
- **Environment Loading**: dotenv for loading .env files during application startup
- **Validation**: Built-in Zod integration for runtime validation and TypeScript inference
- **Features**: Server/client environment separation, compile-time type checking, runtime validation
- **Benefits**: Type-safe configuration access, validation on startup, excellent error messages
- **File Loading**: Automatic .env file detection and loading with environment-specific overrides

#### Logging

- **Framework**: Pino for high-performance structured logging
- **Development**: Pretty-printed logs with pino-pretty for local visibility
- **Production**: Dual output - JSON structured logs + Sentry Logs via `pinoIntegration`
- **Sentry Integration**: Official Sentry `pinoIntegration` captures logs automatically (SDK >= 10.18.0)
- **Features**: Module-specific child loggers, configurable log levels, automatic PII redaction
- **Trace Correlation**: Automatic via Sentry SDK instrumentation

#### Workflow Orchestration

- **Workflow Engine**: Temporal for durable workflow execution and orchestration
- **Workflow Types**: Background processing, scheduled tasks, email notifications, data synchronization, complex business processes
- **Features**: Durable workflows, activity functions, automatic retries, temporal scheduling, workflow state management
- **Monitoring**: Built-in workflow monitoring, execution history, and workflow insights
- **Scalability**: Horizontal scaling with multiple workers and distributed workflow execution
- **Error Handling**: Automatic retries, compensation patterns, workflow failure recovery, and comprehensive error tracking

#### Web Framework & API Development

- **Framework**: Fastify for high-performance HTTP server with TypeScript-first design
- **API Contracts**: ts-rest for end-to-end type safety between client and server
- **Core Plugins**:
  - **@fastify/cors**: Cross-Origin Resource Sharing with configurable origins
  - **@fastify/helmet**: Security headers and protection middleware
  - **@fastify/rate-limit**: Request rate limiting with configurable windows
  - **@fastify/swagger**: OpenAPI 3.0 specification generation from route schemas
  - **@fastify/swagger-ui**: Interactive API documentation at `/docs` endpoint
- **Features**: JSON schema validation, automatic OpenAPI generation, plugin ecosystem
- **Performance**: 3x faster than Express with built-in async/await support
- **Security**: Comprehensive security headers, CORS policies, and rate limiting
- **Documentation**: Interactive Swagger UI with full API exploration capabilities

#### Database & ORM

- **ORM**: Drizzle ORM for type-safe database operations
- **Database Driver**: postgres (PostgreSQL client) managed through the centralized factory in `src/db/connection.ts`
- **Migration Tool**: drizzle-kit for schema generation, migrations, and introspection
- **Features**: Schema-first design, automatic TypeScript inference, SQL-like query builder
- **Migrations**: Automatic schema migrations with version control via drizzle-kit
- **Connection**: `createDatabase()` factory constructs clients from environment variables and exposes a shared singleton for application code
- **Testing Support**: Vitest bootstrap (`tests/setup/env.ts`) overrides `process.env.DATABASE_URL` so tests point at a dedicated database without injecting `db`
- **Development Tools**: Database introspection, schema diffing, and migration generation

#### Database Containerization

- **Database**: PostgreSQL containerized with Docker for consistent development environment
- **Multi-Database**: Single PostgreSQL instance with separate development and test databases selected via `DATABASE_URL`
- **Orchestration**: Docker Compose for database service management
- **Health Checks**: Database connectivity monitoring and health checks
- **Persistence**: Volume-based data persistence across container restarts

## Project Structure

```
.
├── .env.example                           # Environment variable template
├── .env                                   # Environment variables (not committed)
├── .env.local                             # Local development overrides (not committed)
├── docker-compose.yml                     # PostgreSQL database service
├── src/
│   ├── lib/                               # Core utilities and configuration
│   │   ├── env.ts                         # Environment schema (@t3-oss/env-core + Zod) - Single source of truth
│   │   ├── logger.ts                      # Pino logger with module child loggers and PII redaction
│   │   └── http.ts                        # HTTP utilities
│   ├── config/                            # Derived configurations
│   │   ├── database.ts                    # Database configuration (uses env.ts)
│   │   └── server.ts                      # Fastify server configuration
│   ├── infra/                             # Infrastructure and operational concerns
│   │   ├── health/                        # Health check endpoints
│   │   │   ├── health.routes.ts           # Health and readiness routes
│   │   │   ├── health.routes.test.ts      # Health route tests
│   │   │   └── index.ts                   # Health module exports
│   │   └── index.ts                       # Infrastructure route registration
│   ├── api/                               # API layer (business endpoints)
│   │   └── routes/                        # Fastify route implementations
│   │       └── index.ts                   # Route registration
│   ├── modules/                           # Domain-driven feature modules
│   │   ├── contacts-sync/                 # Contacts synchronization module
│   │   │   ├── index.ts                   # Module exports and public API
│   │   │   └── services/                  # Business logic
│   │   │       ├── contacts-sync.service.ts       # Contacts sync service
│   │   │       └── contacts-sync.service.test.ts  # Service tests
│   │   ├── inbound-email/                 # Email processing module
│   │   │   ├── index.ts                   # Module exports
│   │   │   ├── api/                       # HTTP layer
│   │   │   │   ├── postmark-webhook.routes.ts
│   │   │   │   └── postmark-webhook.routes.test.ts
│   │   │   ├── services/                  # Business logic
│   │   │   │   ├── postmark-webhook-processor.ts
│   │   │   │   └── postmark-webhook-processor.test.ts
│   │   │   ├── workflows/                 # Temporal workflows
│   │   │   │   ├── postmark-inbound-email.workflow.ts
│   │   │   │   ├── postmark-email-processor.activity.ts
│   │   │   │   └── postmark-email-processor.activity.test.ts
│   │   └── jobs/                          # Job templates module
│   │       ├── index.ts                   # Module exports
│   │       ├── api/                       # HTTP layer
│   │       │   ├── job-templates.contracts.ts
│   │       │   ├── job-templates.routes.ts
│   │       │   └── job-templates.routes.test.ts
│   │       ├── services/                  # Business logic
│   │       │   ├── job-templates.service.ts
│   │       │   └── job-templates.service.test.ts
│   │       ├── repositories/              # Data access
│   │       │   ├── job-templates.repository.ts
│   │       │   └── job-templates.repository.test.ts
│   │       └── domain/                    # Domain models
│   │           ├── job-template.entity.ts
│   │           └── job-template.types.ts
│   ├── server.ts                          # Fastify server setup and startup
│   ├── instrument.ts                      # Sentry SDK initialization (must be imported first)
│   ├── db/                                # Database layer
│   │   ├── schema.ts                      # Drizzle schema definitions
│   │   ├── schema-core.ts                 # Core microservice tables (no migrations)
│   │   ├── schema-local.ts                # Local microservice tables (with migrations)
│   │   ├── migrations/                    # Database migration files
│   │   ├── connection.ts                  # Database connection setup
│   │   └── index.ts                       # Database exports
│   ├── shared/                            # Shared infrastructure and cross-module code
│   │   ├── data-access/                   # External system data access
│   │   │   ├── core/                      # Core microservice data access
│   │   │   │   ├── companies.repository.ts    # Database queries (read-only core tables)
│   │   │   │   ├── core-sdk.ts                # HTTP API client for core microservice
│   │   │   │   └── index.ts                   # Core data access exports
│   │   │   └── odoo/                      # Odoo ERP data access
│   │   │       ├── odoo-sdk.ts                # Odoo JSON-RPC API client
│   │   │       └── index.ts                   # Odoo data access exports
│   │   └── workflows/                     # Temporal workflow infrastructure
│   │       ├── client.ts                  # Temporal client factory
│   │       ├── worker.ts                  # Worker with Sentry interceptor
│   │       ├── worker.test.ts             # Worker tests
│   │       ├── workflows.ts               # Workflow registry
│   │       └── index.ts                   # Workflows exports
│   └── scripts/                           # CLI scripts
│       └── contacts-sync.ts               # Contacts sync CLI
├── tests/                                 # Testing utilities and setup
│   ├── factories/                         # Test data factories
│   └── setup/                             # Test environment setup
│       └── env.ts                         # Vitest bootstrap (sets NODE_ENV and DATABASE_URL)
└── config/
    └── docker/                            # Docker database configs
        ├── init-db.sql                     # PostgreSQL database initialization
        └── healthcheck.sh                  # Database health check script
```

## Development Workflow

### Code Quality Standards

- **Type Safety**: Strict TypeScript configuration with no implicit any
- **Type Coverage**: Continuous monitoring with type-coverage to maintain high type safety standards
- **Code Formatting**: Biome for fast, consistent code formatting and basic linting
- **Advanced Linting**: ESLint for complex linting rules and TypeScript-specific checks
- **Tool Separation**: Biome for style, ESLint for logic and advanced type checking
- **Error Handling**: Comprehensive error boundaries

### Code Quality Workflow

The project uses a dual-tool approach for code quality, with clear separation of concerns:

#### Unified Commands
- **`pnpm lint`** - Run both Biome and ESLint linting
- **`pnpm lint:fix`** - Auto-fix issues with both Biome and ESLint
- **`pnpm check:fix`** - Format and lint with Biome (formatting + basic linting)

#### Individual Tool Commands

**Biome (Formatting & Basic Linting)**
- **`pnpm lint:biome`** - Biome linting only
- **`pnpm lint:biome:fix`** - Auto-fix Biome linting issues
- **`pnpm check:fix`** - Format and lint with Biome (includes formatting)
- **Purpose**: Fast code formatting and basic linting rules
- **Capabilities**: Auto-formatting, import organization, basic code quality checks

**ESLint (Advanced Linting)**
- **`pnpm lint:eslint`** - ESLint linting only
- **`pnpm lint:eslint:fix`** - Auto-fix ESLint issues where possible
- **Purpose**: Advanced code quality checks and TypeScript-specific rules
- **Capabilities**: Type-aware linting, complex rule enforcement, plugin-based extensibility

#### CI/CD Integration
Both tools run in a single unified Lint step in the CI/CD pipeline:
- Runs `pnpm run lint:biome` then `pnpm run lint:eslint`
- Verifies both basic linting (Biome) and advanced TypeScript checks (ESLint)
- Build fails if either tool reports errors

#### Pre-commit Hooks
Automated quality gates run before each commit:
- **Biome Format**: Formats staged files only (fast, minimal delay)
- **ESLint Check**: Validates staged TypeScript files (catches issues early)
- **Type Coverage**: Enforces minimum 97% type coverage threshold
- Only processes staged files for optimal performance
- Prevents committing code with linting errors or insufficient type coverage

#### No Conflicts
ESLint is configured to disable all formatting and stylistic rules, preventing conflicts with Biome. This ensures:
- Biome is the single source of truth for code style
- ESLint focuses exclusively on logic and type-aware checks
- Developers get consistent, non-conflicting feedback

### Build & Deployment

- **Development**: Direct TypeScript execution via tsx with Fastify server and containerized PostgreSQL
- **Production**: Compiled JavaScript via TypeScript compiler with optimized Fastify build
- **API Documentation**: Auto-generated OpenAPI specs from ts-rest contracts
- **Database**: Containerized PostgreSQL for development consistency
- **Database Migrations**: Automated schema migrations via Drizzle ORM
- **Health Monitoring**: Fastify health checks, database monitoring, and application observability

## Architecture Layers

### Infrastructure Layer (`src/infra/`)

The infrastructure layer provides operational and monitoring endpoints separate from business logic:

- **Purpose**: Handle operational concerns like health checks, metrics, and system monitoring
- **Responsibilities**:
  - Health and readiness endpoints for container orchestration (K8s, Docker)
  - Liveness and readiness probes for load balancers
  - Future: Metrics endpoints (Prometheus, StatsD)
  - Future: Observability and APM integrations
- **Examples**:
  - `health/health.routes.ts`: Health check endpoints (`/healthz`, `/ready`)
- **Usage**: Called by container orchestrators, load balancers, and monitoring systems
- **Testing**: Integration tests with Fastify test utilities
- **Benefits**: Clear separation between operational and business concerns

### Shared Data Access Layer (`src/shared/data-access/`)

The shared data access layer provides unified access to external systems, grouped by the system being accessed:

- **Purpose**: Centralized access to external system data (both database and API)
- **Organization**: Grouped by external system (core, odoo, etc.) rather than by technology
- **Responsibilities**:
  - API authentication and connection management
  - Database queries for cross-service data access (read-only)
  - Request/response transformation and error handling
  - Retry logic and circuit breaker patterns
  - Mock implementations for testing

#### Core Microservice (`src/shared/data-access/core/`)
- **companies.repository.ts**: Read-only database queries for core-owned tables
- **core-sdk.ts**: HTTP API client for write operations and business logic
- **Usage**: Used by modules and services to access core microservice data

#### Odoo ERP (`src/shared/data-access/odoo/`)
- **odoo-sdk.ts**: JSON-RPC API client for Odoo integration
- **Usage**: Used by sync services and workflows to access Odoo data

### Modules Layer (`src/modules/`)

The modules layer organizes domain-driven business features into self-contained modules:

- **Purpose**: Group all code for a feature (API, services, repositories, workflows) in one place
- **Organization**: Each module is a self-contained feature with clear boundaries
- **Module Structure**:
  - `api/` - HTTP routes and contracts (ts-rest)
  - `services/` - Business logic and orchestration
  - `repositories/` - Data access layer (if needed)
  - `workflows/` - Temporal workflows and activities (if needed)
  - `domain/` - Entities, types, and domain models
  - `index.ts` - Public API exports
- **Examples**:
  - `contacts-sync/`: Odoo → Core API synchronization
  - `inbound-email/`: Postmark webhook processing with Temporal workflows
  - `jobs/`: Job templates with full CRUD operations
- **Benefits**: Improved discoverability, clear ownership, easier testing, better AI-assisted development
- **Testing**: Tests colocated with source files for immediate visibility

### API Layer (`src/api/`)

The API layer provides HTTP endpoints and request/response handling:

- **Purpose**: Expose business functionality via REST APIs with full type safety
- **Responsibilities**:
  - HTTP request/response handling with Fastify
  - API contract definition and validation via ts-rest
  - Authentication and authorization middleware
  - Request validation and error handling
  - OpenAPI documentation generation
- **API Versioning**:
  - **Internal APIs** (`/api/internal/*`): Not versioned - changes are coordinated across internal services
  - **Public APIs** (`/api/v1/*`, `/api/v2/*`, etc.): Versioned for backward compatibility with external clients
- **Examples**:
  - `contracts/accounts.ts`: Type-safe API contracts for accounting operations
  - `routes/accounts.ts`: Fastify route implementations calling services
  - `middleware/auth.ts`: JWT authentication and authorization
- **Usage**: Entry point for external clients, orchestrates services layer
- **Testing**: Integration tests with Fastify test utilities and MSW

### Shared Workflows Infrastructure (`src/shared/workflows/`)

Centralized Temporal workflow infrastructure shared across all modules:

- **Purpose**: Provide common Temporal worker and client infrastructure for the entire application
- **Responsibilities**:
  - Temporal client factory with connection management
  - Worker setup with Sentry error capturing
  - Workflow registry consolidating all module workflows
  - Shared interceptors and middleware
- **Files**:
  - `client.ts`: Temporal client factory with TLS and authentication
  - `worker.ts`: Worker with Sentry activity interceptor
  - `workflows.ts`: Central registry importing workflows from all modules
  - `index.ts`: Public exports for modules to use
- **Usage**: Modules import client factory and TASK_QUEUE; workflows defined in module directories
- **Module Workflows**: Each module defines workflows in its own `workflows/` directory
- **Testing**: Workflow tests colocated with workflow definitions in module directories

### Layer Interaction Pattern

```
                    ┌─────────────────────────────────────┐
                    │      HTTP Clients & Systems         │
                    └─────────┬──────────────┬────────────┘
                              │              │
                    ┌─────────▼─────┐  ┌────▼──────────┐
                    │  Infra Layer   │  │  API Layer    │
                    │  (Monitoring)  │  │  (Routes)     │
                    └────────────────┘  └────┬──────────┘
                                             │
                                    ┌────────▼───────────┐
                                    │  Modules Layer     │
                                    │ (Domain Features)  │
                                    └────┬───────┬───────┘
                                         │       │
                              ┌──────────▼──┐  ┌▼──────────────┐
                              │  Shared     │  │ Shared        │
                              │  Data       │  │ Workflows     │
                              │  Access     │  └───────────────┘
                              └─────────────┘

Infrastructure Layer:   Health checks, metrics, monitoring
API Layer:              Route registration and HTTP concerns
Modules Layer:          Self-contained domain features (api, services, repositories, workflows)
Shared Data Access:     External system clients (Core, Odoo, etc.)
Shared Workflows:       Temporal infrastructure (worker, client, registry)
```

This separation ensures:

- **Clear Separation**: Infrastructure concerns separated from business logic
- **Type Safety**: End-to-end type safety from HTTP requests to database
- **Testability**: Each layer can be tested independently with appropriate mocks
- **Reusability**: Data access clients and workflow infrastructure shared across all modules
- **Maintainability**: Changes to features are isolated to individual modules
- **Discoverability**: All code for a feature lives in one module directory
- **System-Based Organization**: All access to an external system (DB + API) grouped together
- **Documentation**: Automatic OpenAPI generation from ts-rest contracts
- **Single Responsibility**: Each module and layer has a clear, distinct purpose
- **Operational Excellence**: Dedicated infrastructure layer for monitoring and observability
- **Durable Processing**: Temporal workflows provide fault-tolerant execution for complex business processes
- **AI-Friendly**: Module structure improves context gathering and change scoping for AI assistants

## Architecture Principles

### Type Safety

- **Strict Mode**: All TypeScript strict options enabled
- **No Implicit Any**: Explicit typing required
- **Module Resolution**: Bundler resolution for optimal performance
- **Type Coverage**: Monitored via type-coverage tool for continuous type safety improvement

### Performance Considerations

- **Fast Development**: tsx for instant TypeScript execution with Fastify hot-reload and containerized database
- **High-Performance Server**: Fastify provides 3x better performance than Express with native async/await
- **Optimized Dependencies**: pnpm for efficient package management
- **Database Performance**: Connection pooling and query optimization with Drizzle
- **Database Consistency**: Containerized PostgreSQL ensures identical environments
- **Type Safety Performance**: ts-rest eliminates runtime validation overhead with compile-time checks
- **Monitoring**: Dedicated infrastructure layer for health checks and operational endpoints

## Package Ecosystem

### Database & ORM Stack

- **`drizzle-orm`**: Type-safe ORM with SQL-like query builder
- **`drizzle-kit`**: Schema migrations, introspection, and development tools
- **`postgres`**: High-performance PostgreSQL client driver

### Web Framework & API Stack

- **`fastify`**: High-performance HTTP server framework
- **`@fastify/cors`**: Cross-Origin Resource Sharing middleware
- **`@fastify/helmet`**: Security headers and protection
- **`@fastify/rate-limit`**: Request rate limiting
- **`@fastify/swagger`**: OpenAPI 3.0 specification generation
- **`@fastify/swagger-ui`**: Interactive API documentation interface
- **`@ts-rest/core`**: Type-safe API contracts
- **`@ts-rest/fastify`**: Fastify integration for ts-rest

### Configuration & Environment

- **`@t3-oss/env-core`**: Type-safe environment variable management
- **`dotenv`**: Environment file loading
- **`zod`**: Runtime type validation and schema definition

### Development Tools

- **`tsx`**: TypeScript execution without compilation
- **`typescript`**: TypeScript compiler and language support
- **`type-coverage`**: TypeScript type coverage measurement and enforcement
- **`@biomejs/biome`**: Fast code formatting and basic linting
- **`eslint`**: Pluggable linting utility for advanced code quality checks
- **`@typescript-eslint/parser`**: ESLint parser for TypeScript support
- **`@typescript-eslint/eslint-plugin`**: TypeScript-specific linting rules
- **`eslint-config-prettier`**: Disables ESLint formatting rules to prevent Biome conflicts
- **`cspell`**: Code spell checking
- **`gitleaks`**: Secret detection and security scanning
- **`knip`**: Dead code detection and dependency analysis

### Logging & Observability

- **`pino`**: High-performance structured logging (primary logging interface)
- **`pino-pretty`**: Pretty-printed logs for development
- **`@sentry/node`**: Error tracking + `pinoIntegration` for Sentry Logs

### Workflow Orchestration

- **`@temporalio/worker`**: Temporal worker for executing workflows and activities
- **`@temporalio/client`**: Temporal client for workflow management and scheduling
- **`@temporalio/workflow`**: Workflow development framework and runtime
- **`@temporalio/activity`**: Activity function framework for external operations

### Technology Integration Benefits

#### Type Coverage (type-coverage)

- **Exceptional Type Safety**: Current coverage at 97.02% (12,638 / 13,025 identifiers)
- **Type Safety Metrics**: Quantifies percentage of code with explicit types vs `any` types
- **Regression Prevention**: Enforced 97.02% minimum threshold detects any regression
- **AI-Assisted Development**: Near-complete type information enables accurate AI suggestions
- **Progressive Improvement**: Tracks TypeScript adoption progress over time with measurable goals
- **CI/CD Integration**: Automated builds fail if coverage drops below 97.02%
- **Detailed Reporting**: File-by-file and line-by-line breakdown of the remaining 2.98% gaps
- **Team Accountability**: Makes type safety a measurable, trackable team goal
- **Refactoring Confidence**: 97%+ coverage enables safe, AI-assisted automated refactoring

#### Docker & Docker Compose (Database)

- **Database Consistency**: Identical PostgreSQL environment across all development machines
- **Multi-Database Setup**: Single PostgreSQL instance with separate development and test databases
- **Development Speed**: One-command database setup with `docker-compose up`
- **Data Persistence**: Volume-based storage ensures data survives container restarts
- **Easy Reset**: Clean database state with `docker-compose down -v` for testing

#### Drizzle ORM & Database Tools

- **Type Safety**: Full TypeScript integration with automatic type inference
- **Performance**: Lightweight ORM with minimal overhead and SQL-like syntax
- **Developer Experience**: Excellent IntelliSense and compile-time error checking
- **Migration Management**: Version-controlled schema changes with rollback support via drizzle-kit
- **Database Driver**: postgres package for high-performance PostgreSQL connections
- **Development Tools**: Schema introspection, migration generation, and database studio integration
- **Connection Management**: Advanced connection pooling with configurable timeouts and limits

#### Fastify Web Framework

- **Performance**: 3x faster than Express with optimized request/response handling
- **TypeScript Native**: Built-in TypeScript support with excellent type inference
- **Plugin Ecosystem**: Rich ecosystem with official plugins for common functionality
- **Schema Validation**: Built-in JSON schema validation for requests and responses
- **Auto-Documentation**: Automatic OpenAPI/Swagger generation from route schemas
- **Security**: Built-in security features including helmet, CORS, and rate limiting
- **Testing**: Comprehensive testing utilities for integration and unit tests

#### ts-rest API Contracts

- **End-to-End Type Safety**: Shared types between client and server with compile-time validation
- **Contract-First Development**: Define API contracts before implementation for better design
- **Automatic OpenAPI**: Generate OpenAPI specifications directly from TypeScript contracts
- **Client Generation**: Auto-generate type-safe client libraries for frontend consumption
- **Validation**: Runtime request/response validation with zero overhead in production
- **Developer Experience**: Full IntelliSense and auto-completion for API calls
- **Maintainability**: Single source of truth for API contracts prevents client/server drift

#### Configuration Management (@t3-oss/env-core + Zod)

- **Single Source of Truth**: All environment configuration centralized in `src/lib/env.ts`
- **Type Safety**: Runtime validation with compile-time TypeScript inference using Zod schemas
- **Environment Separation**: Clear distinction between server and client-side environment variables
- **Error Handling**: Comprehensive validation errors with helpful messages at application startup
- **Developer Experience**: Full IntelliSense support with auto-completion for all configuration values
- **Security**: Prevents accidental exposure of server-only variables to client-side code
- **Maintainability**: All other configuration files import from the single source, ensuring consistency

#### Logging Architecture (Pino + Sentry Logs)

Pino as primary logger. In production, Sentry's [`pinoIntegration`](https://docs.sentry.io/platforms/javascript/guides/fastify/configuration/integrations/pino/) forwards `info`/`warn`/`error` logs to Sentry Logs UI automatically.

- **Development**: pino-pretty (colorized stdout)
- **Production**: JSON stdout + Sentry Logs (via `pinoIntegration`)
- **PII**: Redacted by Pino before Sentry captures
- **Requires**: `@sentry/node` >= 10.18.0, `pino` >= 8.0.0, `enableLogs: true`

#### Workflow Orchestration (Temporal)

- **Durable Execution**: Workflows survive process restarts and failures with automatic state recovery
- **Scalability**: Horizontal scaling with multiple workers and distributed workflow execution
- **Workflow Management**: Complete workflow lifecycle with versioning, history, and state visualization
- **Advanced Features**: Long-running workflows, child workflows, signals, queries, and temporal scheduling
- **Error Handling**: Automatic retries, compensation patterns, workflow failure recovery, and saga patterns
- **Monitoring**: Built-in workflow monitoring, execution history, and Temporal Web UI for visual debugging
- **TypeScript Integration**: Full type safety for workflow definitions and activity functions with excellent developer experience
- **Performance**: High-throughput workflow processing with efficient state management and minimal overhead
- **Reliability**: Exactly-once execution guarantees, workflow determinism, and built-in testing framework

## Configuration Files

### Core Configuration

- **`tsconfig.json`**: TypeScript compiler configuration with strict settings and advanced type checking
- **`vitest.config.ts`**: Test framework configuration with coverage setup and environment overrides
- **`biome.json`**: Code formatting and linting configuration with TypeScript-specific rules
- **`eslint.config.js`**: ESLint configuration for advanced linting (see ESLint Configuration section below)
- **`cspell.json`**: Spell checking configuration with custom dictionaries and project-specific terms
- **`.gitleaks.toml`**: Secret detection configuration with custom rules, allowlists, and entropy detection
- **`knip.json`**: Dead code detection configuration with entry points and ignore patterns
- **`package.json`**: Project metadata, scripts, and dependency management with pnpm specification

### ESLint Configuration

- **File**: `eslint.config.js` (ESLint flat config format)
- **Parser**: @typescript-eslint/parser for TypeScript syntax understanding
- **Plugins**: @typescript-eslint/eslint-plugin for TypeScript-specific rules
- **Conflict Prevention**: eslint-config-prettier disables all formatting-related ESLint rules
- **Type-Aware Rules**: Configured to use TypeScript project references for type-aware linting
- **Scope**: Runs on all TypeScript source files (`src/**/*.ts`)
- **Extensibility**: Plugin architecture enables adding domain-specific plugins (e.g., eslint-plugin-financial, eslint-plugin-security)
- **Temporarily Disabled Rules**: Some strict TypeScript rules are disabled during migration:
  - `@typescript-eslint/require-await` - Async functions without await
  - `@typescript-eslint/no-unsafe-*` - Unsafe `any` usage rules
  - `@typescript-eslint/no-explicit-any` - Explicit `any` types
  - `@typescript-eslint/no-floating-promises` - Unhandled promises
  - Other type-safety rules (see `eslint.config.js` for full list)
- **Migration Strategy**: Enable rules incrementally and fix violations one rule at a time
- **Commands**:
  - `pnpm lint:eslint` - Check for ESLint issues
  - `pnpm lint:eslint:fix` - Auto-fix ESLint issues
  - `pnpm lint` - Run both Biome and ESLint
- **Editor Integration**: VS Code and other editors support real-time ESLint feedback

### Environment Configuration

- **`.env`**: Default environment variables (not committed)
- **`.env.example`**: Environment variable template and documentation
- **`.env.local`**: Local development overrides (not committed)
- **`src/lib/env.ts`**: Single source of truth for environment configuration using @t3-oss/env-core with Zod schemas

#### Example Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/accounting_dev"

# Temporal
TEMPORAL_ADDRESS="localhost:7233"
TEMPORAL_NAMESPACE="default"

# Application
NODE_ENV="development"
PORT="3000"
LOG_LEVEL="info"

# Security (production)
JWT_SECRET="your-secure-jwt-secret-here"
```

### Database Configuration

- **`src/db/schema.ts`**: Database schema definitions with TypeScript types
- **`src/config/database.ts`**: Database connection and pooling configuration (imports from `src/lib/env.ts`)
- **Migration Management**: Handled via drizzle-kit with environment-based configuration
- **Schema Generation**: `drizzle-kit generate` for creating migration files
- **Database Introspection**: `drizzle-kit introspect` for reverse-engineering existing schemas

### Database Schema Architecture

The project implements a clear separation between core microservice tables and locally managed tables:

#### Schema File Structure

- **`src/db/schema.ts`**: Main schema file that exports all tables for querying
- **`src/db/schema-core.ts`**: Core microservice tables (companies, etc.) - **NO MIGRATIONS**
- **`src/db/schema-local.ts`**: Local microservice tables (job_templates, etc.) - **WITH MIGRATIONS**
- **`drizzle.config.ts`**: Points only to `schema-local.ts` for migration management

#### Schema Separation Benefits

- **Microservice Boundaries**: Clear separation between tables owned by different services
- **Migration Safety**: Prevents accidental modification of core microservice tables
- **Query Flexibility**: Full Drizzle ORM access to all tables regardless of ownership
- **Type Safety**: Complete TypeScript types for all tables across microservices
- **Testing Isolation**: Core tables can be mocked while local tables use real database
- **Development Workflow**: Local team can iterate on local schema without affecting core service

#### Usage Patterns

```typescript
// Import all tables for querying (both core and local)
import { companies, jobTemplates } from "./db/schema.js";

// Full query capabilities across microservice boundaries
const result = await db
  .select()
  .from(companies) // Core microservice table
  .leftJoin(
    jobTemplates, // Local microservice table
    eq(companies.id, jobTemplates.companyId)
  );

// Migrations only affect local tables
// pnpm db:generate -> only creates migrations for jobTemplates
// pnpm db:push -> only modifies local tables
```

### Database Conventions

#### Timestamp Handling

The project uses **TIMESTAMP WITH TIME ZONE** for all timestamp columns to ensure proper handling of dates and times across different timezones:

- **Column Type**: All timestamp columns use PostgreSQL's `TIMESTAMP WITH TIME ZONE` (aliased as `TIMESTAMPTZ`)
- **Drizzle ORM**: Use `timestamp('column_name', { mode: 'date', withTimezone: true })` for schema definitions
- **Storage**: PostgreSQL stores all timestamps in UTC internally and converts to the session timezone on retrieval
- **Benefits**:
  - Eliminates timezone ambiguity in stored data
  - Automatic conversion to client timezone when needed
  - Consistent behavior across different geographic regions
  - Prevents daylight saving time issues

**Example Schema Definition:**

```typescript
import { timestamp } from 'drizzle-orm/pg-core';

export const exampleTable = pgTable('example', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

**Important Notes:**
- Always use `withTimezone: true` for new timestamp columns
- Legacy tables without timezone support should be migrated during schema updates
- JavaScript Date objects work seamlessly with timezone-aware timestamps

### Database Containerization Configuration

- **`docker-compose.yml`**: PostgreSQL database service with development and test databases
- **`config/docker/init-db.sql`**: Database initialization script for creating multiple databases

## Modular Architecture

The codebase follows a **modular (domain-driven) architecture** where code is organized by business domain rather than technical layers. This structure significantly improves maintainability, discoverability, and AI-assisted development.

### AI-Friendliness Score: 8.5/10

**Benefits**:
- ✅ All domain code organized in self-contained `modules/` 
- ✅ Shared infrastructure centralized in `shared/`
- ✅ Clear boundaries reduce accidental edits
- ✅ Easy navigation and context gathering for AI assistants
- ✅ Immediate visibility of test coverage (colocated tests)
- ✅ Simpler scoping and change impact analysis

### Module Conventions

1. **Naming**: Use dashed-lowercase (e.g., `contacts-sync`, `inbound-email`)
2. **Structure**: Each module contains `api/`, `services/`, `repositories/`, `workflows/`, `domain/` as needed
3. **Tests**: Colocated with source files (e.g., `service.ts` next to `service.test.ts`)
4. **Public API**: Each module has `index.ts` exporting only public interfaces
5. **Dependencies**: Modules import from other modules only through their `index.ts`

### Existing Modules

- **`contacts-sync/`**: Synchronizes contacts from Odoo ERP to Core microservice
- **`inbound-email/`**: Processes Postmark webhook emails via Temporal workflows
- **`jobs/`**: Job templates management with full CRUD operations

## Future Considerations

- Advanced authentication (OAuth2, SAML, multi-factor authentication)
- Monitoring and observability (Prometheus metrics, distributed tracing, APM)
- Horizontal scaling with load balancers and service mesh
- Caching strategies (Redis, in-memory caching, CDN integration)
- Backup and disaster recovery strategies
- Multi-environment deployment (staging, production, blue-green deployments)
- CI/CD pipeline with automated testing, security scanning, and deployment
- Microservices architecture with API gateway
- Event-driven architecture with domain events
