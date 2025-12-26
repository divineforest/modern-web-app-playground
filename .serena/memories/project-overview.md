# Backend Accounting System - Project Overview

## Project Purpose
NodeJS backend accounting system for EasyBiz with TypeScript, Docker, and PostgreSQL. This is a modern backend system designed for high performance, maintainability, and comprehensive testing.

## Tech Stack
- **Runtime**: Node.js 22+ with TypeScript (ES Modules)
- **Web Framework**: Fastify with ts-rest (type-safe APIs)
- **Database**: PostgreSQL with Drizzle ORM
- **Workflow Orchestration**: Temporal (durable workflows)
- **Containerization**: Docker & Docker Compose
- **Testing**: Vitest (unit and integration testing)
- **Configuration**: @t3-oss/env-core + Zod (type-safe config)
- **Code Quality**: Biome (formatting & basic linting) + ESLint (advanced linting)
- **Additional Tools**: CSpell, Gitleaks, Knip

## Project Structure
The codebase follows a **modular (domain-driven) architecture** where code is organized by business domain:

```
src/
├── lib/                    # Core utilities and configuration
├── config/                 # Derived configurations  
├── infra/                  # Infrastructure and operational concerns
├── modules/                # Domain-driven feature modules
│   ├── contacts-sync/      # Contacts synchronization module
│   ├── inbound-email/      # Email processing module
│   └── practice-management/ # Job templates and jobs module
├── shared/                 # Shared infrastructure and cross-module code
│   ├── data-access/        # External system data access
│   └── workflows/          # Temporal workflow infrastructure
├── db/                     # Database layer
└── scripts/                # CLI scripts
```

## Key Architecture Principles
- **Type Safety**: Strict TypeScript with 97%+ type coverage requirement
- **Modular Design**: Self-contained domain modules with clear boundaries
- **Infrastructure Separation**: Operational concerns separated from business logic
- **End-to-End Type Safety**: From HTTP requests to database operations
- **Durable Processing**: Temporal workflows for fault-tolerant execution

## Database Architecture
- **Schema Separation**: Core microservice tables (no migrations) vs local tables (with migrations)
- **Timestamp Handling**: All timestamps use `TIMESTAMP WITH TIME ZONE` for proper timezone handling
- **Migration Management**: Drizzle Kit for schema generation and migrations

## Development Environment
- **Package Manager**: pnpm (managed via corepack)
- **Database**: Containerized PostgreSQL with separate dev/test databases
- **Temporal**: Local Temporal server for workflow development
- **Hot Reload**: tsx for instant TypeScript execution

## Testing Strategy
- **Framework**: Vitest with comprehensive test setup
- **Integration Testing**: Real PostgreSQL test database for route tests
- **Test Factories**: Factory functions for creating test data
- **Mocking**: MSW for API mocking with strict error handling
- **Coverage**: High test coverage requirements with type coverage monitoring

## Key Features
- Job templates and jobs management
- Contacts synchronization (Odoo → Core API)
- Inbound email processing with Postmark webhooks
- Temporal workflow orchestration
- Type-safe API contracts with ts-rest
- Comprehensive error handling and logging
- Security headers and rate limiting
- Health checks and monitoring endpoints