# Session-Based Cookie Authentication

**Status:** accepted
**Date:** 2026-03-05 12:49

## Context

The Mercado backend authenticates all API requests using a single shared Bearer token from the `API_BEARER_TOKENS` environment variable. User identity is optionally passed in three custom headers: `X-User-Id`, `X-User-Email`, and `X-User-Name`. There is no mechanism for end users to authenticate directly.

### Current state

```
apps/backend/src/infra/auth/
├── auth.plugin.ts          # Reads Authorization: Bearer <token> header
├── token-validator.ts      # Compares token against API_BEARER_TOKENS env var
└── auth.types.ts           # AuthenticatedUser: { userId?, email?, name?, authenticated }
```

The user context on every request is:

```typescript
// apps/backend/src/infra/auth/auth.types.ts
interface AuthenticatedUser {
  userId?: string;   // from X-User-Id header — optional, not validated
  email?: string;    // from X-User-Email header — optional, not validated
  name?: string;     // from X-User-Name header — optional, not validated
  authenticated: true;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}
```

This design has two structural problems:

**No user authentication for the web app.** The web application has a checkout flow (see `docs/specs/checkout.md`) that requires a known user identity. There is no way for an end user to log in via the web. The `users` table exists in `apps/backend/src/db/schema.ts` with `email`, `password`, and `salt` columns, but they are unused by the auth layer.

**Unverified user context.** Any caller who knows the shared Bearer token can claim any user identity by setting `X-User-Id`/`X-User-Email` headers. The user context attached to `request.user` is never verified against the database.

### Existing users table (relevant columns)

```typescript
// apps/backend/src/db/schema.ts
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  firstName: varchar('first_name').notNull(),
  lastName: varchar('last_name').notNull(),
  email: varchar('email').notNull().unique(),
  password: varchar('password').notNull(),
  salt: varchar('salt').notNull(),
  isAdmin: boolean('is_admin').default(false),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
});
```

## Decision

Replace the static Bearer token mechanism with email/password authentication backed by server-side sessions stored in a new `sessions` database table. Sessions are delivered to the browser as an httpOnly cookie named `sid`.

The full spec is at `docs/specs/auth.md`.

### 1. New sessions table

```typescript
// apps/backend/src/db/schema.ts  (addition)
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),           // crypto.randomBytes(32).toString('hex')
    expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_sessions_token').on(table.token),
    index('idx_sessions_user_id').on(table.userId),
    index('idx_sessions_expires_at').on(table.expiresAt),
  ]
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
```

### 2. Updated request.user type

The `AuthenticatedUser` type in `infra/auth/auth.types.ts` is replaced with a resolved database user:

```typescript
// apps/backend/src/infra/auth/auth.types.ts  (replacement)
export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}
```

### 3. Replacement auth plugin

`infra/auth/auth.plugin.ts` is rewritten to read the `sid` cookie, look up the session, and attach the user:

```typescript
// apps/backend/src/infra/auth/auth.plugin.ts  (replacement)
import fp from 'fastify-plugin';
import { db } from '../../db/connection.js';
import { sessions, users } from '../../db/schema.js';
import { eq, and, gt } from 'drizzle-orm';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const authPluginImplementation: FastifyPluginCallback = (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    const token = request.cookies?.sid;
    if (!token) return reply.status(401).send({ error: 'Authentication required' });

    const [row] = await db
      .select({ session: sessions, user: users })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
      .limit(1);

    if (!row) return reply.status(401).send({ error: 'Authentication required' });

    // Sliding expiry: extend session on each use
    const newExpiry = new Date(Date.now() + SESSION_DURATION_MS);
    await db
      .update(sessions)
      .set({ expiresAt: newExpiry, lastUsedAt: new Date() })
      .where(eq(sessions.id, row.session.id));

    request.user = {
      id: row.user.id,
      email: row.user.email,
      firstName: row.user.firstName,
      lastName: row.user.lastName,
      isAdmin: row.user.isAdmin ?? false,
    };
  });
};

export const authPlugin = fp(authPluginImplementation, { name: 'session-auth', fastify: '5.x' });
```

### 4. New auth module

```
apps/backend/src/modules/auth/
├── api/
│   ├── auth.contract.ts    # ts-rest contract: register, login, logout, me
│   └── auth.routes.ts      # Fastify route handlers
├── services/
│   └── auth.service.ts     # register(), login(), logout() — password hashing, session lifecycle
├── repositories/
│   └── auth.repository.ts  # createSession(), findSessionWithUser(), deleteSession(), findUserByEmail()
├── domain/
│   └── auth.schemas.ts     # Zod: registerSchema, loginSchema, userProfileSchema
└── index.ts                # Public exports
```

The contract (consumed by both backend handlers and the frontend API client):

```typescript
// packages/api-contracts/src/auth/contract.ts
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { userProfileSchema, registerSchema, loginSchema } from './schemas.js';

const c = initContract();

export const authContract = c.router({
  register: {
    method: 'POST',
    path: '/api/auth/register',
    body: registerSchema,
    responses: { 201: userProfileSchema, 409: z.object({ error: z.string() }) },
  },
  login: {
    method: 'POST',
    path: '/api/auth/login',
    body: loginSchema,
    responses: { 200: userProfileSchema, 401: z.object({ error: z.string() }) },
  },
  logout: {
    method: 'POST',
    path: '/api/auth/logout',
    body: c.noBody(),
    responses: { 200: z.object({ ok: z.literal(true) }) },
  },
  me: {
    method: 'GET',
    path: '/api/auth/me',
    responses: { 200: userProfileSchema, 401: z.object({ error: z.string() }) },
  },
});
```

### 5. Cookie configuration

```typescript
// set on login and register responses
reply.setCookie('sid', sessionToken, {
  httpOnly: true,
  secure: process.env['NODE_ENV'] === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60, // seconds
});

// clear on logout
reply.clearCookie('sid', { path: '/' });
```

### 6. Password hashing

`argon2id` via the `argon2` npm package. The argon2id output is self-contained (includes salt), so the `salt` column stores an empty string for new registrations:

```typescript
import * as argon2 from 'argon2';

// hash on registration
const hash = await argon2.hash(password, { type: argon2.argon2id });
// hash goes into users.password; users.salt = ''

// verify on login
const valid = await argon2.verify(storedHash, submittedPassword);
```

### 7. Web application API client update

```typescript
// apps/web/src/lib/api-client.ts  (change: add credentials: 'include')
import { initClient } from '@ts-rest/core';
import { apiContract } from '@mercado/api-contracts';

export const api = initClient(apiContract, {
  baseUrl: '',
  baseHeaders: {},
  credentials: 'include', // ← enables cookie forwarding
});
```

### 8. Removed environment variable

`API_BEARER_TOKENS` is removed from `apps/backend/src/lib/env.ts` and `.env.example`. No new environment variables are required (session duration is hardcoded at 7 days with no current need for operator override).

## Consequences

### Positive

- **Real user identity on every request.** `request.user` is now a fully typed, database-verified object. Any route handler that reads `request.user.id` gets the actual UUID of the authenticated user — no spoofing via custom headers.
- **Revocable sessions.** Logout deletes the session row; the `sid` cookie becomes permanently invalid. This was impossible with a shared static token.
- **Auth contract in `@mercado/api-contracts`.** The register/login/logout/me contract lives alongside cart, products, and orders. The frontend can call auth endpoints through the same typed `api` client already used everywhere.
- **Eliminates `API_BEARER_TOKENS` operational burden.** No shared secret to rotate, distribute, or accidentally leak.

### Negative

- **Every authenticated request hits the database.** Session validation requires one SELECT (join sessions + users) plus one UPDATE (sliding expiry). Under high load this is an additional ~2 DB round-trips per request. Mitigation: the `idx_sessions_token` unique index makes the lookup O(log n); the UPDATE can be made async (fire-and-forget) if latency becomes a concern.
- **Sessions table grows without cleanup.** Expired rows accumulate until a cleanup job is added (marked 🚧 in `docs/specs/auth.md` as TR-7). This is operational debt, not a correctness issue.
- **`argon2` is a native addon.** The `argon2` npm package compiles a C extension. It requires a build toolchain (node-gyp) and must be cross-compiled for Docker/CI targets. The pure-JS fallback (`argon2-wasm`) is an alternative if build complexity becomes a problem.
- **Session management complexity vs. simple token.** Token comparison was `O(1)` crypto; session auth is a DB query. The tradeoff is justified by the need for verified user identity and revocability.

### AI-Friendliness Impact

- **Discoverability** 5/5 — `authContract` follows the same naming pattern as `cartContract`, `productsContract`, `ordersContract`. An LLM searching for "how auth works" will find the module at `modules/auth/`, the contract at `packages/api-contracts/src/auth/`, and this ADR.
- **Cohesion** 5/5 — All auth logic is in one module. The DB session lookup and user attachment are in one plugin file. No auth logic is scattered across middlewares.
- **Pattern consistency** 5/5 — The auth module follows the same `api/ services/ repositories/ domain/` structure as all other modules. The contract follows the same ts-rest pattern. `request.user` remains the single injection point, same as before.
- **Type coverage** 5/5 — `request.user` changes from `AuthenticatedUser { userId?: string }` (stringly typed, optional) to `AuthenticatedUser { id: string; email: string; ... }` (all required, UUID-typed). Any code that reads `request.user.userId` will produce a TypeScript error, making the migration auditable by the compiler.
- **Traceability** 5/5 — Import chain: `authPlugin` → `sessions` + `users` (schema.ts) → DB. `authContract` → `@mercado/api-contracts` → frontend `api` client. Complete graph.

**Overall AI-friendliness: 5/5**

## Options Considered

### Option A: Opaque session tokens in database (chosen)

A `crypto.randomBytes(32)` token is stored in the `sessions` table and sent as an httpOnly cookie. Session state (user id, expiry) lives entirely in the database. Logout is a DELETE; expiry is a column update.

- **Trade-offs:** DB round-trip per request; table requires cleanup job.
- **Why chosen:** Full revocability, no token size limit in cookie, server has complete session inventory (useful for "log out everywhere"), simple implementation with no JWT library.
- **AI-friendliness:** 5/5 — The session lookup is a single Drizzle query. The schema defines the complete session state. No hidden state outside the database.

### Option B: JWT (JSON Web Tokens)

A signed JWT is stored in the cookie. Session state is embedded in the token payload; no database lookup needed per request.

- **Why rejected:**
  - **Logout is broken by design.** A deleted JWT is still valid until it expires. Implementing proper logout requires a token blocklist, which is a database table — negating the stateless benefit.
  - **Token rotation complexity.** Short-lived access tokens + refresh tokens require two-token management in the frontend client, adding non-trivial state handling to the web app.
  - **Sliding expiry requires re-issuing the token** on every request (or requires a separate refresh flow). This is non-trivial to implement correctly.
  - **Secret rotation invalidates all sessions.** Rotating the JWT signing secret logs out every user simultaneously.
- **AI-friendliness:** 3/5 — JWTs introduce two-token state (access + refresh) that an LLM must track across the client and server. The blocklist pattern re-introduces DB dependency while making the auth flow harder to follow.

### Option C: Keep Bearer token, add user identity endpoint

Retain `API_BEARER_TOKENS` for service-level auth. Add a separate `/api/auth/login` endpoint that returns a short-lived user token embedded in responses, passed as a header by the frontend.

- **Why rejected:** This pattern requires the frontend to manage a separate token lifecycle (storage, refresh, inclusion in headers). The web app already manages a cart token in `localStorage`; adding a second token with different semantics increases complexity. httpOnly cookies are the established browser standard for session auth — they provide CSRF protection via SameSite and eliminate JS token management.
- **AI-friendliness:** 2/5 — Two auth mechanisms in one codebase. An LLM reading a route handler cannot determine which mechanism protects it without reading the plugin registration order.

## Migration Path

1. **Add `sessions` table to `apps/backend/src/db/schema.ts`** and run `pnpm db:generate && pnpm db:migrate`. No existing data is affected.

2. **Install `argon2` and `@fastify/cookie`** packages in `apps/backend/`. Add `@fastify/cookie` registration to `apps/backend/src/server.ts` before the auth plugin.

3. **Create `modules/auth/`** with the service, repository, and route handler. Register `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` as public routes (before the auth plugin in `server.ts`).

4. **Add `auth` contract to `@mercado/api-contracts`** (`packages/api-contracts/src/auth/`) and re-export it from `packages/api-contracts/src/router.ts`.

5. **Replace `infra/auth/auth.plugin.ts`** with the session-based plugin. Update `infra/auth/auth.types.ts` with the new `AuthenticatedUser` shape. Remove `infra/auth/token-validator.ts`.

6. **Fix TypeScript errors** caused by the `request.user` type change (`userId?: string` → `id: string`). The compiler will surface every call site that read `request.user.userId` or `request.user.email` from the old type.

7. **Remove `API_BEARER_TOKENS`** from `apps/backend/src/lib/env.ts` and `.env.example`.

8. **Update `apps/web/src/lib/api-client.ts`** to add `credentials: 'include'`.

9. **Add `/login` and `/register` pages** to `apps/web/` with React Router entries.

10. **Run `pnpm test:smoke`** to verify the server starts and health endpoints still respond.
