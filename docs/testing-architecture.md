# Testing Architecture

## Quick Reference

- **Framework**: Vitest with MSW for mocking external APIs
- **Coverage thresholds**: See `vitest.config.ts` (canonical source)
- **Test database**: Uses `DATABASE_URL` from environment

## Test Types

| Type | Location | Run Command |
|------|----------|-------------|
| Unit/Integration | `src/**/*.test.ts` (co-located) | `pnpm test` |
| Smoke | `tests/smoke/*.smoke.test.ts` | `pnpm test:smoke` |

## Smoke Tests

Smoke tests validate real infrastructure (PostgreSQL, Temporal) against a running server.

**Key differences from unit tests:**
- Extended timeouts (60s+) for server startup and workflow completion
- Use native Node SDKs (Drizzle) instead of CLI tools
- Separate config: `tests/smoke/vitest.config.smoke.ts`

**Helpers**: `tests/smoke/helpers/` contains utilities for server lifecycle, Temporal client, and database operations.

## MSW Mocking

External API mocks live in `src/mocks/handlers.ts`. MSW runs in strict mode (`onUnhandledRequest: 'error'`) - unmocked requests fail tests.

## Test Data

Factories in `tests/factories/` generate realistic test data. Tests use unique factory data to avoid collisions in the shared test database.
