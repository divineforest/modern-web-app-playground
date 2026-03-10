# Testing Architecture

## Quick Reference

- **Framework**: Vitest with MSW for mocking external APIs
- **Coverage thresholds**: See `vitest.config.ts` (canonical source)
- **Test database**: Uses `DATABASE_URL` from environment

## Test Types

| Type | Location | Run Command |
|------|----------|-------------|
| Unit/Integration | `apps/backend/src/**/*.test.ts` (co-located) | `pnpm test` |
| Smoke | `apps/backend/tests/smoke/*.smoke.test.ts` | `pnpm test:smoke` |

## Smoke Tests

Smoke tests validate real infrastructure (PostgreSQL, Temporal) against a running server.

**Key differences from unit tests:**
- Extended timeouts (60s+) for server startup and workflow completion
- Use native Node SDKs (Drizzle) instead of CLI tools
- Separate config: `apps/backend/tests/smoke/vitest.config.smoke.ts`

**Helpers**: `apps/backend/tests/smoke/helpers/` contains utilities for server lifecycle, Temporal client, and database operations.

## MSW Mocking

External API mocks live in `apps/backend/src/mocks/handlers.ts`. MSW runs in strict mode (`onUnhandledRequest: 'error'`) - unmocked requests fail tests.

## Test Data

Factories in `apps/backend/tests/factories/` generate realistic test data. Tests use unique factory data to avoid collisions in the shared test database.
