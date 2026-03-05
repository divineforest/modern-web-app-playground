# Authentication — Email and Password

## Overview

This feature introduces email and password authentication for Mercado users. It replaces the existing static API Bearer token mechanism with a proper session-based auth system where individual users sign up, log in, and carry an httpOnly session cookie for subsequent requests.

The existing `users` table already has the schema needed (email, password hash, salt). This spec adds the sessions table, the auth API endpoints, the session-based authentication plugin, and the web application login and registration pages.

The primary beneficiaries are end users of the Mercado web application who currently have no way to create accounts or log in directly. Auth is the prerequisite for features like checkout, order history, and any user-specific personalization.

## Goals and Non-Goals

### Goals

- Allow users to register with an email address and password
- Allow registered users to log in and receive a session cookie
- Allow users to log out and invalidate the session
- Provide a `/api/auth/me` endpoint so clients can retrieve the currently authenticated user
- Replace the static Bearer token authentication plugin with a session-cookie-based plugin for all protected routes
- Deliver `/login` and `/register` pages in the web application

### Non-Goals

- Password reset / forgot-password flow (deferred)
- Email verification on registration (deferred — `confirmed_email_at` column already exists for future use)
- Social / OAuth login (Google, GitHub, etc.)
- Two-factor authentication
- Admin-only user management (creating/deleting users via API)
- Remember-me with extended token lifetime (all sessions use the same configurable expiry)
- Role-based access control beyond the existing `is_admin` flag

## Functional Requirements

### FR-1: User Registration

- The system SHALL allow a new user to register with a first name, last name, email address, and password.
- The system SHALL reject registration if the email address is already in use, returning an error that does not confirm whether the email exists (to prevent user enumeration).
- The system SHALL enforce a minimum password length of 8 characters.
- The system SHALL hash and salt the password before storing it; the plaintext password SHALL NOT be persisted.
- On successful registration, the system SHALL create a session and return a session cookie (the user is logged in immediately after registration).

### FR-2: User Login

- The system SHALL allow an existing user to authenticate with their email address and password.
- The system SHALL reject login with an identical error response for both "user not found" and "wrong password" cases to prevent user enumeration.
- On successful login, the system SHALL create a new session record and return it as an httpOnly session cookie.
- The system SHALL NOT return the session token in the response body.
- If a `cart_token` cookie is present on the login request, the system SHALL automatically merge the guest cart into the user's cart within the same database transaction as session creation. After merge, the `cart_token` cookie SHALL be cleared in the login response. The cart page SHALL reflect the merged cart immediately after login without any additional client request.

### FR-3: Session Cookie

- The session cookie SHALL be httpOnly to prevent client-side JavaScript access.
- The session cookie SHALL be marked Secure in non-development environments.
- The session cookie SHALL use SameSite=Lax.
- The session SHALL have a configurable expiry (default: 7 days).
- The session expiry SHALL use a sliding window: each authenticated request SHALL extend the session expiry by the full duration.

### FR-4: Authenticated Requests

- All protected API routes SHALL require a valid, non-expired session cookie.
- The system SHALL attach the resolved user (id, email, first name, last name, is admin) to the request context.
- The system SHALL reject requests with a missing, invalid, or expired session cookie with HTTP 401.

### FR-5: Current User Endpoint

- The system SHALL provide a `GET /api/auth/me` endpoint that returns the authenticated user's profile.
- The endpoint SHALL return: user id, email, first name, last name, is admin flag, and account creation date.
- The password hash and salt SHALL never be included in any API response.

### FR-6: Logout

- The system SHALL provide a `POST /api/auth/logout` endpoint that invalidates the current session in the database.
- On logout, the system SHALL clear the session cookie from the browser.
- Requests to `/api/auth/logout` with an invalid or missing session SHALL return HTTP 200 (idempotent; there is nothing to invalidate).

### FR-7: Web Application — Login Page

- The login page SHALL be accessible at `/login`.
- The page SHALL present an email and password input and a submit button.
- The page SHALL include a link to the registration page.
- On successful login, the page SHALL redirect to the page the user was trying to access, or to the product catalog as default.
- On failure, the page SHALL display a generic error ("Invalid email or password") without field-level distinction.
- The submit button SHALL be disabled while the request is in flight.

### FR-8: Web Application — Registration Page

- The registration page SHALL be accessible at `/register`.
- The page SHALL present: first name, last name, email, password, and confirm-password inputs.
- The page SHALL validate client-side that the password and confirm-password fields match.
- The page SHALL enforce the minimum password length client-side.
- The page SHALL include a link to the login page.
- On successful registration, the page SHALL redirect to the product catalog.
- On failure (e.g., email already taken), the page SHALL display the error message returned by the API.

### FR-9: Auth-Guarded Routes (Web Application)

- Routes that require authentication SHALL redirect unauthenticated users to `/login`.
- After login, the user SHALL be redirected back to the originally requested URL.

## Technical Requirements

### TR-1: Sessions Table

A new `sessions` table SHALL be added to the database schema:

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key, generated randomly |
| user id | UUID | Foreign key to `users.id`, cascade on delete |
| token | text | Cryptographically secure random token (32 bytes, hex-encoded); unique |
| expires at | timestamp with time zone | Absolute expiry time |
| created at | timestamp with time zone | Creation timestamp |
| last used at | timestamp with time zone | Updated on each authenticated request (for the sliding window) |

- The system SHALL create a unique index on the session token column.
- The system SHALL create an index on `user_id` for efficient session lookup by user.
- The system SHALL create an index on `expires_at` to support efficient cleanup of expired sessions.

### TR-2: Password Hashing

- The system SHALL use **argon2id** for password hashing (via the `argon2` npm package).
- The existing `password` and `salt` columns SHALL be used; the argon2id output includes the salt, so the `salt` column MAY store a static pepper or be left empty for this implementation.
- The system SHALL use argon2id's default recommended parameters (memory cost, time cost, parallelism).

### TR-3: Auth API Endpoints

All auth routes SHALL be under the `/api/auth` prefix and SHALL NOT require authentication (public routes):

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Log in and receive session cookie |
| POST | `/api/auth/logout` | Log out and clear session cookie |
| GET | `/api/auth/me` | Get currently authenticated user (requires auth) |

### TR-4: Session Authentication Plugin

- The existing Bearer token authentication plugin (`infra/auth/`) SHALL be replaced with a session-based plugin.
- The new plugin SHALL read the session token from the request cookie, look it up in the database, and verify it has not expired.
- On a valid session, the plugin SHALL update `last_used_at` and extend `expires_at` (sliding expiration) in the database.
- The plugin SHALL attach the full user record to the request context (replacing the current `request.user` shape).
- The `X-User-Id`, `X-User-Email`, and `X-User-Name` header-based user context extraction SHALL be removed.
- The `API_BEARER_TOKENS` environment variable SHALL no longer be required.

### TR-5: Auth Module

- The auth feature SHALL be implemented as a module at `modules/auth/`.
- The module SHALL expose: `register`, `login`, `logout`, and `getMe` handlers.
- Password hashing and session token generation SHALL live in the auth service layer.
- Session reads and writes SHALL live in the auth repository layer.

### TR-6: Web Application — API Client

- The web application API client SHALL include `credentials: 'include'` in all requests so the session cookie is sent automatically.
- No authentication header manipulation is required in the frontend.

### TR-7: Expired Session Cleanup

- 🚧 The system SHOULD periodically delete expired sessions from the database to prevent unbounded table growth (scheduled job or cron).

### TR-8: Cookie Configuration

- The cookie name SHALL be `sid`.
- The cookie path SHALL be `/`.
- The `Secure` flag SHALL be set based on the `NODE_ENV` environment variable (enabled in production, disabled in development).
- The `Max-Age` SHALL reflect the session expiry duration in seconds.

## Data Flow

### Registration

1. **User** submits `POST /api/auth/register` with first name, last name, email, and password.
2. **Auth API handler** validates the request body (required fields, password length, email format).
3. **Auth service** checks that the email is not already in use.
4. If the email exists, the service returns HTTP 409 with a generic conflict message.
5. **Auth service** hashes the password using argon2id.
6. **Auth service** inserts the new user into the `users` table.
7. **Auth service** generates a 32-byte cryptographically secure session token.
8. **Auth service** inserts a session record into the `sessions` table with the token and expiry.
9. **Auth API handler** sets the `sid` httpOnly cookie on the response and returns HTTP 201 with the user profile.

### Login

1. **User** submits `POST /api/auth/login` with email and password. The browser automatically includes any `cart_token` cookie if present.
2. **Auth API handler** validates the request body.
3. **Auth service** looks up the user by email.
4. If the user is not found, the service waits a fixed duration (to prevent timing-based enumeration) and returns HTTP 401 with a generic message.
5. **Auth service** verifies the submitted password against the stored argon2id hash.
6. If the hash does not match, the service returns HTTP 401 with the same generic message.
7. **Auth service** begins a database transaction: creates a session record, then checks for a `cart_token` cookie.
8. If a `cart_token` cookie is present and valid, **auth service** calls the cart merge service within the same transaction (merging or reassigning the guest cart to the user).
9. **Auth service** commits the transaction.
10. **Auth API handler** sets the `sid` httpOnly cookie, clears the `cart_token` cookie, and returns HTTP 200 with the user profile.

### Authenticated Request

1. **Client** sends a request to a protected route with the `sid` cookie.
2. **Session auth plugin** reads the `sid` cookie value.
3. **Plugin** queries the `sessions` table for a non-expired record matching the token.
4. If not found or expired, the plugin rejects the request with HTTP 401.
5. **Plugin** updates `last_used_at` and extends `expires_at` for the session (sliding expiry).
6. **Plugin** attaches the resolved user to `request.user`.
7. **Route handler** processes the request with the user context available.

### Logout

1. **Client** sends `POST /api/auth/logout` with the `sid` cookie.
2. **Auth service** deletes the session record matching the token (if it exists).
3. **Auth API handler** clears the `sid` cookie (Max-Age=0) and returns HTTP 200.

## Security Considerations

- Passwords SHALL be hashed with argon2id and never stored in plaintext or returned in any response.
- Session tokens SHALL be generated with `crypto.randomBytes(32)` to ensure cryptographic unpredictability.
- Login and registration endpoints SHALL use identical error messages and timing behavior for both "not found" and "wrong password" cases to prevent user enumeration.
- The `sid` cookie SHALL be httpOnly and Secure (in production) to mitigate XSS and network interception.
- SameSite=Lax provides CSRF protection for state-changing requests from cross-origin navigations.
- 🚧 Rate limiting on `/api/auth/login` and `/api/auth/register` SHOULD be applied to mitigate brute-force attacks (recommended: 10 attempts per IP per 15-minute window).

## Monitoring and Observability

- Log each successful registration with user id (no PII beyond id) and timestamp.
- Log each successful login with user id, session id, and source IP.
- Log each failed login attempt with source IP (but not the submitted email, to avoid logging PII in failure paths).
- Log each logout with session id.
- 🚧 Alert on an elevated rate of failed login attempts per IP (potential brute-force).

## Error Scenarios

| Scenario | Response |
|----------|----------|
| Registration with existing email | HTTP 409 — "An account with this email address already exists" |
| Registration with invalid email format | HTTP 400 — validation error |
| Registration with password shorter than 8 characters | HTTP 400 — "Password must be at least 8 characters" |
| Login with unknown email | HTTP 401 — "Invalid email or password" |
| Login with wrong password | HTTP 401 — "Invalid email or password" |
| Request to protected route with missing cookie | HTTP 401 — "Authentication required" |
| Request to protected route with expired session | HTTP 401 — "Session expired" |
| Request to protected route with invalid token | HTTP 401 — "Authentication required" |
| Logout with no active session | HTTP 200 — success (idempotent) |

## Testing and Validation

### Unit Tests

- Registration service: successful registration creates user and session
- Registration service: rejects duplicate email
- Registration service: rejects short password
- Login service: successful login returns session token
- Login service: rejects unknown email with generic error (no enumeration)
- Login service: rejects wrong password with generic error
- Login service: equivalent response time for not-found vs. wrong-password paths
- Session plugin: valid non-expired session attaches user and extends expiry
- Session plugin: missing cookie rejects with 401
- Session plugin: expired session rejects with 401
- Session plugin: unknown token rejects with 401
- Logout service: deletes session record
- Logout service: succeeds even if no session exists

### Integration Tests

- Full registration flow: register → protected route with cookie → user context available
- Full login flow: login → session cookie set → protected route succeeds
- Logout flow: login → logout → protected route rejected with 401
- Concurrent login: same user logs in from two sessions — both sessions valid simultaneously
- Session expiry: create session with past expiry → protected route rejected

### Web Application Tests

- Login page: successful login redirects to catalog
- Login page: failed login displays generic error
- Registration page: mismatched passwords blocked client-side
- Registration page: short password blocked client-side
- Registration page: successful registration redirects to catalog
- Protected routes redirect unauthenticated users to `/login` with return URL
- After login from redirect, user lands on the originally requested page

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Argon2id is slow by design, vulnerable to DoS if many concurrent login attempts | High CPU under attack | Rate limiting on auth endpoints (🚧) |
| Session table grows unboundedly | Slow session lookups over time | Periodic cleanup of expired sessions (🚧 TR-7) |
| Timing attack on login (email enumeration) | User privacy | Fixed-duration wait on not-found path; identical error messages |
| Cookie theft via XSS | Account takeover | httpOnly cookie prevents JS access; Content-Security-Policy headers recommended |
| Concurrent sliding expiry updates cause race | Session may expire unexpectedly | Last-write-wins on `expires_at` update is acceptable; no correctness risk |
| Removing Bearer token auth breaks existing integrations | Auth regressions | All protected routes must be tested with new session auth before Bearer token plugin is removed |
