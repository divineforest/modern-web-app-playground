# Testing Architecture

## Overview

This document outlines the comprehensive testing strategy for the backend accounting system, designed to ensure high code quality, reliability, and maintainability through automated testing at multiple layers.

## Testing Strategy

### Core Testing Principles

- **Unit Testing**: Complete function coverage with isolated dependencies
- **Integration Testing**: API endpoint validation with real database instances
- **Database Testing**: Dedicated PostgreSQL test database referenced via `DATABASE_URL`
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

- **`vitest.config.ts`**: Global test configuration
- **`tests/setup/env.ts`**: Ensures test-specific environment variables (NODE_ENV, DATABASE_URL)
- **`vitest.setup.ts`**: Global test setup (MSW, hooks)
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
- **End-to-End Testing**: Browser automation testing with Playwright
- **Contract Testing**: API contract testing with Pact or similar tools
- **Mutation Testing**: Code quality validation with mutation testing
- **Visual Testing**: UI regression testing for frontend components
- **Security Testing**: Automated security vulnerability scanning
- **Chaos Engineering**: Fault injection and resilience testing
