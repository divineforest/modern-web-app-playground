# Testing Architecture

## Overview

This document outlines the comprehensive testing strategy for the backend accounting system, designed to ensure high code quality, reliability, and maintainability through automated testing at multiple layers.

## Testing Strategy

### Core Testing Principles

- **Unit Testing**: Complete function coverage with isolated dependencies
- **Integration Testing**: API endpoint validation with real database instances
- **Database Testing**: Dedicated PostgreSQL test database referenced via `DATABASE_URL`
- **Smoke Testing**: Real infrastructure validation with Vitest (not bash scripts)
- **Mock Strategy**: Comprehensive API mocking with MSW for external services
- **Test Isolation**: Shared test database with unique factory data per scenario
- **Coverage**: Enforced thresholds - 90% lines/functions/statements, 85% branches
- **CI/CD Testing**: Containerized test execution in CI environments

### Testing Layers

#### Unit Testing

- **Framework**: Vitest for fast execution and TypeScript native support
- **Scope**: Individual functions and modules in isolation
- **Dependencies**: All external dependencies mocked
- **Coverage**: High coverage requirements with detailed reporting

#### Integration Testing

- **API Testing**: Full HTTP endpoint testing with Fastify test utilities
- **Database Integration**: Real PostgreSQL instance connected through `DATABASE_URL`
- **Service Integration**: Business logic testing with actual database operations
- **End-to-End Flows**: Complete user workflows and data transformations

#### Smoke Testing

- **Framework**: Vitest with separate configuration (`vitest.config.smoke.ts`)
- **Scope**: Real infrastructure validation against running services
- **Purpose**: Verify server startup, health endpoints, and critical workflows
- **Infrastructure**: Tests against real PostgreSQL, LocalStack S3, and Temporal
- **Execution**: Separate test suite with extended timeouts (`pnpm test:smoke`)

**Why Vitest over Bash Scripts:**

| Factor | Bash Scripts | Vitest |
|--------|--------------|--------|
| Type safety | None | Full TypeScript types for payloads |
| Error messages | Parse logs manually | Structured diffs and assertions |
| Debugging | `echo` statements | IDE breakpoints, watch mode |
| Refactoring | Manual grep | LSP/IDE support |
| AI Agent compatibility | Poor (CLI tools blocked by sandbox) | Native Node SDKs work seamlessly |
| Codebase consistency | Different patterns | Same patterns as unit/integration tests |

**Smoke Test Categories:**

1. **Server Health**: Validates `/healthz`, `/ready`, and `/docs` endpoints
2. **Workflow E2E**: Tests Temporal workflows with real webhook payloads
3. **Infrastructure**: Verifies database connectivity, S3 archival, external integrations

#### Database Testing

- **Connection Management**: Drizzle factory automatically picks up `process.env.DATABASE_URL`
- **Test Isolation**: Dedicated test database with timestamped factory data to avoid collisions
- **Schema Testing**: Migration and schema validation testing
- **Data Integrity**: Transaction testing and rollback scenarios

## Testing Infrastructure

### Core Testing Framework

- **Framework**: Vitest
- **Features**: Fast unit testing, TypeScript native support, watch mode
- **Coverage**: @vitest/coverage-v8 with V8 engine integration
- **Thresholds**: Lines 90%, Functions 90%, Branches 85%, Statements 90%

### API Testing & Mocking

- **Mocking**: MSW (Mock Service Worker)
- **Configuration**: Strict error handling (`onUnhandledRequest: 'error'`)
- **Environments**: Both Node.js (tests) and browser (development)
- **External APIs**: Comprehensive mocking for Odoo, Core SDK, and other external services

### Database Testing Infrastructure

- **Bootstrap**: `tests/setup/env.ts` sets `NODE_ENV` and ensures `DATABASE_URL` before any imports run
- **PostgreSQL Integration**: `postgres` client + Drizzle ORM power all database access
- **Database**: Reuses a provisioned PostgreSQL service (e.g., Docker Compose) for fast feedback
- **CI/CD**: Works with pre-provisioned PostgreSQL instances or service containers in CI
- **Isolation**: Tests rely on factory-generated data and explicit cleanup where required
- **Health Checks**: Connection attempts double as availability checks at startup

## Test Organization

### Test File Structure

#### Current Type-Based Structure

```
src/
├── modules/
│   ├── contacts-sync/
│   │   └── services/
│   │       └── contacts-sync.service.test.ts  # Service tests
│   ├── inbound-email/
│   │   ├── services/
│   │   │   └── postmark-webhook-processor.test.ts  # Service tests
│   │   └── workflows/
│   │       └── postmark-email-processor.activity.test.ts  # Activity tests
├── shared/
│   ├── data-access/
│   │   ├── core/
│   │   │   ├── core-sdk.test.ts       # SDK unit tests
│   │   └── odoo-sdk.test.ts           # External API client tests
│   ├── services/
│   │   ├── companies.test.ts          # Business logic tests
│   │   ├── contacts-sync.test.ts      # Service integration tests
│   │   └── postmark-webhook-processor.test.ts
│   └── api/
│       └── routes/
│           └── health.test.ts         # API endpoint tests
├── lib/
│   └── logger.test.ts                 # Utility function tests
├── mocks/                             # MSW mock handlers
│   ├── handlers.ts                    # API mock definitions
│   ├── server.ts                      # Node.js mock server
│   ├── browser.ts                     # Browser mock worker
│   └── index.ts                       # Mock exports
└── tests/
    ├── factories/                     # Test data factories
    │   ├── companies.ts               # Company test data
    │   └── index.ts                   # Factory exports
    └── setup/
        └── env.ts                     # Vitest bootstrap (DATABASE_URL + NODE_ENV)
```

#### Proposed Modular Structure

See [Architecture Documentation](./architecture.md#proposed-modular-architecture) for complete details on the modular structure.

```
src/
├── modules/
│   ├── billing/
│   │   └── tests/                     # Module-specific tests
│   │       ├── billing.service.test.ts
│   │       ├── billing.routes.test.ts
│   │       └── billing.integration.test.ts
│   ├── contacts-sync/
│   │   └── tests/
│   │       ├── contacts-sync.service.test.ts
│   │       └── contacts-sync.integration.test.ts
│   └── postmark-inbound/
│       └── tests/
│           ├── postmark-webhook.test.ts
│           ├── postmark-email-processor.test.ts
│           └── postmark-inbound.integration.test.ts
├── lib/
│   └── logger.test.ts                 # Utility function tests
├── mocks/                             # MSW mock handlers (unchanged)
│   ├── handlers.ts
│   ├── server.ts
│   ├── browser.ts
│   └── index.ts
└── tests/                             # Global test utilities (unchanged)
    ├── factories/
    │   ├── companies.ts
    │   └── index.ts
    └── setup/
        └── db.pg.ts
```

**Key Testing Benefits of Modular Structure:**

- **Co-located Tests**: Tests live alongside the code they test within each module
- **Better Discoverability**: Easy to find tests for a specific feature
- **Clearer Scope**: Test files naturally group by module boundaries
- **Independent Testing**: Modules can be tested in isolation
- **AI-Friendly**: Easier for AI assistants to scope test generation and updates

#### Smoke Test Structure

```
tests/
├── smoke/                              # Smoke test suite (separate from unit/integration)
│   ├── vitest.config.smoke.ts          # Smoke-specific Vitest config (extended timeouts)
│   ├── setup.ts                        # Smoke test setup (server lifecycle, cleanup)
│   ├── server-health.smoke.test.ts     # Health endpoint validation
│   ├── email-intake.smoke.test.ts      # Webhook → Temporal workflow E2E
│   └── helpers/
│       ├── server.ts                   # Server spawn/wait/kill utilities
│       ├── s3.ts                       # S3 verification (uses @aws-sdk, not aws CLI)
│       └── temporal.ts                 # Temporal client for workflow verification
```

**Smoke Test Design Principles:**

- **Native Node Clients**: Use `@aws-sdk/client-s3` instead of `aws` CLI, Drizzle instead of `psql`
- **Typed Payloads**: Webhook payloads defined as TypeScript types, not bash heredocs
- **Reusable Utilities**: Share test factories and helpers with unit/integration tests
- **AI-Friendly**: No external CLI tools that break in sandboxed environments

### Test Categories by Layer

#### Shared SDK Tests (`src/shared/data-access/*/*.test.ts`)

- **Purpose**: Test external API client implementations
- **Scope**: API authentication, request/response handling, error scenarios
- **Mocking**: Complete external API mocking with MSW
- **Coverage**: All SDK methods, error handling, retry logic
- **Examples**: `core-sdk.test.ts`, `odoo-sdk.test.ts`

#### Module Service Tests (`src/modules/*/services/*.test.ts`)

- **Purpose**: Test business logic and service orchestration
- **Scope**: Business rules, data transformation, multi-SDK orchestration
- **Database**: Integration tests against the shared PostgreSQL service defined by `DATABASE_URL`
- **Mocking**: SDK layer mocking for unit tests, real database for integration

#### Module API Tests (`src/modules/*/api/*.test.ts`)

- **Purpose**: Test HTTP endpoints and request handling
- **Scope**: Request validation, response formatting, authentication
- **Framework**: Fastify test utilities with MSW mocking
- **Coverage**: All endpoints, error scenarios, authentication flows
- **Examples**: `postmark-webhook.routes.test.ts`, `contacts.routes.test.ts`

## Testing Tools & Dependencies

### Testing Framework Stack

- **`vitest`** (v3.2.4): Fast unit testing framework with TypeScript support
- **`@vitest/coverage-v8`** (v3.2.4): Code coverage reporting with V8 engine
- **`msw`** (v2.10.5): API mocking for tests and development environments

### Mock Strategy

#### MSW (Mock Service Worker)

- **Configuration**: Strict error handling prevents unmocked requests
- **Handlers**: Centralized mock definitions in `src/mocks/handlers.ts`
- **Environments**:
  - Node.js server for test environments
  - Browser worker for development environments
- **Coverage**: All external API endpoints mocked comprehensively

#### Test Data Management

- **Factories**: Centralized test data creation in `tests/factories/`
- **Realistic Data**: Business-appropriate test data matching production patterns
- **Relationships**: Proper foreign key relationships and data integrity
- **Variants**: Multiple data scenarios for edge case testing

## Configuration & Setup

### Test Setup Files

- **`vitest.config.ts`**: Global test configuration for unit/integration tests
- **`tests/smoke/vitest.config.smoke.ts`**: Smoke test configuration with extended timeouts
- **`tests/setup/env.ts`**: Ensures test-specific environment variables (NODE_ENV, DATABASE_URL)
- **`vitest.setup.ts`**: Global test setup (MSW, hooks)
- **`tests/smoke/setup.ts`**: Smoke test setup (server lifecycle management)
- **Database Factories**: Reusable test data generation

## Performance Considerations

### Test Execution Speed

- **Parallel Execution**: Vitest runs tests in parallel by default
- **Stable Database Service**: Reuses the Docker PostgreSQL instance for fast startup
- **Efficient Mocking**: MSW provides minimal overhead mocking
- **Smart Coverage**: V8 coverage with minimal performance impact

### Resource Management

- **Database Lifecycle**: Controlled teardown or reset of the PostgreSQL service when needed
- **Memory Management**: Efficient test data cleanup between tests
- **Database Connections**: Proper connection pooling in test environments
- **Mock Isolation**: Clean mock state between test suites

## CI/CD Testing Integration

### Container Support

- **GitHub Actions**: Leverages PostgreSQL service containers provisioned by the workflow
- **Docker-in-Docker**: Supports containerized testing environments when required
- **Resource Limits**: Appropriate memory and CPU limits for workflow service containers
- **Parallel Jobs**: Multiple test jobs with isolated PostgreSQL databases

### Smoke Testing in CI

- **Execution**: Smoke tests run after unit/integration tests pass
- **Mode**: Uses built server (`pnpm test:smoke:build`) for production-like validation
- **Infrastructure**: Requires PostgreSQL, LocalStack, and Temporal services
- **Timeout**: Extended timeouts (60s+) for server startup and workflow completion

### Coverage Reporting

- **Threshold Enforcement**: Builds fail if coverage drops below thresholds
- **Coverage Reports**: Detailed HTML and JSON coverage reports
- **Trend Analysis**: Coverage tracking over time
- **Pull Request Integration**: Coverage comments on PRs

## Best Practices

### Test Organization

- **One Test File Per Source File**: Clear 1:1 mapping for maintainability
- **Descriptive Test Names**: Clear test descriptions following business requirements
- **Test Grouping**: Related tests grouped with `describe` blocks
- **Setup/Teardown**: Proper cleanup in `beforeEach`/`afterEach` hooks

### Database Testing

- **Dedicated Instance**: Use the shared `accounting_test` database defined by `DATABASE_URL`
- **Transaction Isolation**: Prefer wrapping destructive tests in transactions or cleaning up created records
- **Schema Validation**: Test database schema matches production
- **Migration Testing**: Validate all database migrations work correctly

### Mock Management

- **Realistic Mocks**: Mock data matches real API responses
- **Error Scenarios**: Comprehensive error condition mocking
- **State Management**: Clean mock state between tests
- **Version Compatibility**: Mock responses match external API versions

## Debugging & Troubleshooting

### Test Debugging

- **IDE Integration**: Full debugging support in VS Code and other IDEs
- **Console Logging**: Structured logging in test environments
- **Container Logs**: Access to database and container logs during failures
- **Test Isolation**: Easy reproduction of failing tests

### Common Issues

- **Container Startup**: Docker environment and resource requirements
- **Database Connections**: Connection string and networking issues
- **Mock Conflicts**: MSW handler conflicts and request matching
- **Coverage Gaps**: Identifying and fixing uncovered code paths

## Future Testing Considerations

- **Performance Testing**: Load testing and stress testing frameworks
- **Browser E2E Testing**: Browser automation testing with Playwright (if UI added)
- **Contract Testing**: API contract testing with Pact or similar tools
- **Mutation Testing**: Code quality validation with mutation testing
- **Security Testing**: Automated security vulnerability scanning
- **Chaos Engineering**: Fault injection and resilience testing
