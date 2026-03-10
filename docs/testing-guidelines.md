# Testing Guidelines

## Summary

Never put business setup in beforeEach. Use beforeEach only for infrastructure setup. Each test declares its own business data.

---

## Core Rule

**Business setup belongs in test blocks, not in beforeEach.**

beforeEach is for infrastructure only:
- Starting and stopping servers
- Opening database connections
- Resetting cache state
- Resetting mock state
- Initializing SDK clients

beforeEach must NOT contain:
- Creating test data like users, companies, or jobs
- Setting specific mock responses
- Configuring business rules
- Initializing domain objects with test values

---

## Why This Rule Exists

Tests with hidden setup in beforeEach have four problems:
- Shared setup changes can break seemingly unrelated tests
- Test order matters because earlier state leaks into later tests
- Preconditions live outside the test, making intent hard to follow
- Extra data gets created for every test, slowing the suite

---

## Use Factory Functions

When tests need similar data, create factory functions instead of shared fixtures and call them directly inside each test.

```typescript
function createTestUser(overrides = {}) {
  return { id: 'user-1', name: 'Test User', ...overrides };
}

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

---

## Bad Example

```typescript
let user;

beforeEach(() => {
  user = createUser({ name: 'Pat' });
});

it('reads a user', () => {
  expect(readUser(user.id)).toBeDefined();
});

it('updates a user', () => {
  expect(updateUser(user.id, { name: 'Alex' })).toBeDefined();
});
```

Problems with this pattern:
- Reader cannot see where `user` comes from or what data it holds
- All tests share identical setup even when they need different inputs
- Changing the shared setup can silently break other tests
- Running tests individually requires the hidden fixture to run first

---

## Good Example

```typescript
it('reads a user', () => {
  const user = createTestUser({ name: 'Pat' });
  expect(readUser(user.id)).toBeDefined();
});

it('updates a user', () => {
  const user = createTestUser();
  const updated = updateUser(user.id, { name: 'Alex' });
  expect(updated.name).toBe('Alex');
});
```

Benefits of this pattern:
- The entire setup lives beside the expectations, so the intent is obvious at a glance
- Debugging failures is faster because all prerequisite data is visible in the stack trace
- Tests trivially support parallel or selective execution without additional guards
- Each test documents its domain scenario explicitly, improving long-term maintenance

---

## Rare Exceptions

Shared beforeEach setup is allowed in rare cases when ALL of these conditions are met:
- The setup is expensive to run
- The setup is identical across the entire test suite
- The setup is read-only and does not mutate state
- The shared state is documented at the top of the test file
- Tests can still run independently when run in isolation

Example use case: Full database migration test suite.

Default approach: Always isolate tests.

---

## Common Mistakes

**Mistake: Storing test data in variables outside tests**
- Problem: Builds hidden dependencies between tests that share the fixture
- Fix: Build domain objects inside the test or via factory helpers per test

**Mistake: Using beforeEach for mock responses**
- Problem: Obscures which mocks belong to which assertions
- Fix: Configure mock responses inside the test that relies on them

**Mistake: Nested describe blocks with cumulative setup**
- Problem: Stacks layers of setup that are hard to reason about
- Fix: Keep describe blocks flat or restate explicit setup in each nested block

**Mistake: Reusing let variables from parent describe blocks**
- Problem: Forces mutable state to leak into tests that do not need it
- Fix: Declare the required data inside the individual test body

---

## Test Template

```typescript
describe('FeatureName', () => {
  beforeEach(async () => {
    await startServer();
    resetMocks();
  });

  afterEach(async () => {
    await stopServer();
  });

  it('should do something', async () => {
    const user = createTestUser({ role: 'admin' });
    server.use(http.get('/api/users/:id', () => HttpResponse.json(user)));

    const result = await fetchUser(user.id);

    expect(result.role).toBe('admin');
  });
});
```

---

## Project Specifics

### Quick Reference

| What | How | Why |
|------|-----|-----|
| **Auth** | `{ authorization: 'Bearer test_token_12345' }` | All `/api/internal/*` routes require this |
| **Test app** | `await buildTestApp()` | Fastify instance without logging |
| **DB factory** | `await createTestGlobalContact()` | Inserts to DB, returns record with ID |
| **Data factory** | `buildTestGlobalContactData()` | Plain object for payloads (no DB hit) |
| **External API mock** | Add to `apps/backend/src/mocks/handlers.ts` | MSW auto-started, reset after each test |
| **One-off mock** | `server.use(http.get(...))` in test | Override or add mock for single test |
| **Database** | Use real PostgreSQL test DB | Route tests = integration tests |

### Decision Matrix

| I need to... | Then use... | Not... | Why |
|--------------|-------------|--------|-----|
| Test a route | `createTest*()` factory | `buildTest*Data()` | Routes need real DB records with IDs |
| Test validation | `buildTest*Data()` | `createTest*()` | Faster, validation doesn't need DB |
| Mock external API | Add to `apps/backend/src/mocks/handlers.ts` | Mock in test | Reused across many tests |
| Mock once | `server.use(...)` in test | Edit handlers.ts | Test-specific scenario |

**Example**: `apps/backend/src/modules/contacts/api/contacts.routes.test.ts`

---

## Route Testing

### Setup Pattern

Standard structure for all route tests (see `apps/backend/src/modules/contacts/api/contacts.routes.test.ts`):

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from '../../../app.js';
import { createTestGlobalContact } from '../../../../tests/factories/index.js';

describe('Contacts Routes', () => {
  let fastify: FastifyInstance;

  const authHeaders = { authorization: 'Bearer test_token_12345' };

  beforeEach(async () => {
    fastify = await buildTestApp();
  });

  afterEach(async () => {
    await fastify.close();
  });

  it('retrieves a contact by ID', async () => {
    const contact = await createTestGlobalContact({
      name: `Test Contact ${Date.now()}`,
    });

    const response = await fastify.inject({
      method: 'GET',
      url: `/api/internal/contacts/${contact.id}`,
      headers: authHeaders,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.id).toBe(contact.id);
    expect(body.name).toBe(contact.name);
  });
});
```

### Access Control Tests

Group authentication tests into "ACL" describe blocks - one per endpoint:

```typescript
describe('POST /api/internal/contacts', () => {
  it('creates a contact with valid data', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/internal/contacts',
      headers: authHeaders,
      payload: {
        companyId: company.id,
        documentId: 'doc-123',
        rawExtraction: { supplierName: { value: 'Test Supplier' } },
      },
    });

    expect(response.statusCode).toBe(201);
  });

  describe('ACL', () => {
    it('returns 401 without authentication', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts',
        payload: {
          companyId: company.id,
          documentId: 'doc-123',
          rawExtraction: { supplierName: { value: 'Test Supplier' } },
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.message).toBe('Missing authentication token');
    });

    it('returns 401 with invalid token', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts',
        headers: { authorization: 'Bearer invalid_token' },
        payload: {
          companyId: company.id,
          documentId: 'doc-123',
          rawExtraction: { supplierName: { value: 'Test Supplier' } },
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.message).toBe('Invalid authentication token');
    });
  });
});
```

Benefits: All security requirements for an endpoint are visible in one place, easy to audit coverage.

---

## Route Testing Mistakes

| ❌ Don't | ✅ Do | Why |
|----------|--------|-----|
| Mock the database | Use real test DB | Route tests = integration tests |
| Reuse factory data in beforeEach | Create data in each test | Prevents hidden dependencies |
| Nest ACL describe blocks | One flat "ACL" block per endpoint | Easier to audit security |
| Use `buildTest*Data()` for routes | Use `createTest*()` | Routes need real DB IDs |
| Hardcode test data | Use `TEST_${Date.now()}` | Parallel tests need unique data |
| Share data between tests | Create fresh per test | Tests must run in any order |

**Example: Wrong factory choice**
```typescript
// ❌ BAD - buildTest*Data() doesn't insert to DB
const contact = buildTestGlobalContactData();
await fastify.inject({ url: `/api/contacts/${contact.id}` }); // id is undefined!

// ✅ GOOD - createTest*() inserts and returns DB record
const contact = await createTestGlobalContact({ name: `Test ${Date.now()}` });
await fastify.inject({ url: `/api/contacts/${contact.id}` }); // works!
```

---

## References

- Let's Not by thoughtbot: https://thoughtbot.com/blog/lets-not
- Avoid Nesting when you're Testing by Kent C. Dodds: https://kentcdodds.com/blog/avoid-nesting-when-youre-testing
