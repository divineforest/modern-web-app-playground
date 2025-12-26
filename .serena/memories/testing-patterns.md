# Testing Patterns and Guidelines

## Core Testing Philosophy
**Business setup belongs in test blocks, not in beforeEach.** Each test declares its own business data.

## Quick Reference Matrix

| What you need to do | Use this approach | NOT this approach | Why |
|---------------------|-------------------|-------------------|-----|
| Test a route | `createTest*()` factory | `buildTest*Data()` | Routes need real DB records with IDs |
| Test validation | `buildTest*Data()` | `createTest*()` | Faster, validation doesn't need DB |
| Mock Odoo API | Add to `src/mocks/handlers.ts` | Mock in test | Reused across many tests |
| Mock once | `server.use(...)` in test | Edit handlers.ts | Test-specific scenario |

## Standard Test Setup Pattern

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from '../../../app.js';
import { createTestJobTemplate } from '../../../../tests/factories/index.js';

describe('FeatureName', () => {
  let fastify: FastifyInstance;
  
  const authHeaders = { authorization: 'Bearer test_token_12345' };

  beforeEach(async () => {
    fastify = await buildTestApp(); // Infrastructure setup only
  });

  afterEach(async () => {
    await fastify.close();
  });

  it('should do something', async () => {
    // Business data created INSIDE the test
    const template = await createTestJobTemplate({
      code: `TEST_${Date.now()}`,
      name: 'Test Template',
    });

    const response = await fastify.inject({
      method: 'GET',
      url: `/api/internal/job-templates/${template.id}`,
      headers: authHeaders,
    });

    expect(response.statusCode).toBe(200);
  });
});
```

## Factory Functions Pattern

Instead of shared beforeEach setup, create factory functions:

```typescript
// Factory function for test data
function createTestUser(overrides = {}) {
  return { 
    id: 'user-1', 
    name: 'Test User', 
    email: 'test@example.com',
    ...overrides 
  };
}

// Usage in tests
describe('users', () => {
  it('reads a user', () => {
    const user = createTestUser({ name: 'Sam' });
    expect(readUser(user.id)).toEqual(user);
  });

  it('updates a user', () => {
    const user = createTestUser();
    expect(updateUser(user.id, { name: 'Alex' }).name).toBe('Alex');
  });
});
```

## Route Testing Patterns

### Authentication Tests (ACL)
Group authentication tests into "ACL" describe blocks - one per endpoint:

```typescript
describe('POST /api/internal/job-templates', () => {
  it('creates a job template with valid data', async () => {
    // Test happy path
  });

  describe('ACL', () => {
    it('returns 401 without authentication', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/job-templates',
        payload: { /* valid data */ },
        // No auth headers
      });
      expect(response.statusCode).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/job-templates',
        headers: { authorization: 'Bearer invalid_token' },
        payload: { /* valid data */ },
      });
      expect(response.statusCode).toBe(401);
    });
  });
});
```

### Data Factory Usage
- **`createTest*()`**: Inserts to database, returns record with ID (use for route tests)
- **`buildTest*Data()`**: Returns plain object for payloads (use for validation tests)

```typescript
// ✅ GOOD - Route test needs real DB ID
const template = await createTestJobTemplate({ 
  code: `TEST_${Date.now()}` 
});
await fastify.inject({ 
  url: `/api/templates/${template.id}` 
});

// ✅ GOOD - Validation test doesn't need DB
const templateData = buildTestJobTemplateData();
await validateJobTemplate(templateData);

// ❌ BAD - Using build factory for route test
const template = buildTestJobTemplateData(); // No ID!
await fastify.inject({ 
  url: `/api/templates/${template.id}` // undefined!
});
```

## Mocking Patterns

### External API Mocks
Add reusable mocks to `src/mocks/handlers.ts`:

```typescript
// src/mocks/handlers.ts
export const odooHandlers = [
  http.get('/api/odoo/companies', () => {
    return HttpResponse.json({ companies: [] });
  }),
];
```

### One-off Mocks
Use `server.use()` for test-specific mocks:

```typescript
it('handles API errors', async () => {
  server.use(
    http.get('/api/external/data', () => {
      return HttpResponse.json({ error: 'API Error' }, { status: 500 });
    })
  );

  const result = await fetchExternalData();
  expect(result).toHaveProperty('error');
});
```

## Common Testing Mistakes

| ❌ Don't | ✅ Do | Why |
|----------|--------|-----|
| Mock the database | Use real test DB | Route tests = integration tests |
| Reuse factory data in beforeEach | Create data in each test | Prevents hidden dependencies |
| Nest ACL describe blocks | One flat "ACL" block per endpoint | Easier to audit security |
| Use `buildTest*Data()` for routes | Use `createTest*()` | Routes need real DB IDs |
| Hardcode test data | Use `TEST_${Date.now()}` | Parallel tests need unique data |
| Share data between tests | Create fresh per test | Tests must run in any order |

## Test Environment Setup
- **Test Database**: Real PostgreSQL test database (configured in vitest.setup.ts)
- **Test App**: `buildTestApp()` creates Fastify instance without logging
- **Auth Headers**: Use `{ authorization: 'Bearer test_token_12345' }` for protected routes
- **Mock Server**: MSW auto-started, reset after each test

## File Organization
- **Test Files**: Colocated with source files (`.test.ts` suffix)
- **Test Factories**: Located in `tests/factories/`
- **Test Setup**: Environment setup in `tests/setup/env.ts`
- **Mock Handlers**: External API mocks in `src/mocks/handlers.ts`

## Best Practices
1. **Isolation**: Each test should run independently in any order
2. **Clarity**: All prerequisite data should be visible in the test
3. **Speed**: Use appropriate factories (build vs create) for the test type
4. **Coverage**: Test both happy path and error scenarios
5. **Security**: Always include ACL tests for protected endpoints