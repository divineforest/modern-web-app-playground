# Internal Authentication

## Overview

This feature provides simple API token-based authentication for internal APIs, enabling secure service-to-service communication within the EasyBiz microservices ecosystem. The authentication system validates API tokens passed in request headers, optionally extracts user identity information (email) from custom headers, and makes it available to downstream business logic. This ensures that only authorized services can access internal endpoints while maintaining full traceability of which user initiated each request.

The system is designed for internal service-to-service communication where each calling service is provisioned with an API token (stored in environment variables or secret management). User context can be passed via additional headers when requests are made on behalf of specific users. This approach maintains security boundaries while enabling seamless integration between microservices with minimal overhead.

## Goals and Non-Goals

### Goals

- Provide secure API token-based authentication for all internal API endpoints
- Support passing user identity (email) via custom request headers
- Enable service-to-service authentication with minimal configuration
- Maintain backward compatibility with existing health check endpoints (no authentication required)
- Support multiple API tokens for different services or environments
- Provide clear error responses for authentication failures
- Enable request tracing and audit logging with user context

### Non-Goals

- Complex token management or cryptographic validation (use simple bearer tokens)
- OAuth2, JWT, or SAML implementation
- User session management or token refresh mechanisms
- Multi-factor authentication
- Rate limiting per user (already handled at application level)
- Token rotation or automatic expiration (tokens are long-lived)
- Public API authentication (internal services only)

## Functional Requirements

### FR-1: API Token Validation

- The system SHALL validate API tokens provided in the `Authorization` header using the Bearer scheme
- The system SHALL verify token against a list of valid tokens configured via environment variables
- The system SHALL support multiple valid tokens (comma-separated in configuration)
- The system SHALL reject invalid or missing tokens with HTTP 401
- The system SHALL reject requests without authentication tokens on protected endpoints with HTTP 401
- The system SHALL perform constant-time string comparison to prevent timing attacks

### FR-2: User Identity Extraction

- The system SHALL extract user email from the `X-User-Email` custom header if provided
- The system SHALL extract optional user ID from the `X-User-Id` custom header if provided
- The system SHALL extract optional user name from the `X-User-Name` custom header if provided
- The system SHALL make user identity available to all downstream services and business logic
- The system SHALL include user email in all log entries for request tracing when provided
- The system SHALL allow requests without user identity headers (service-to-service calls without user context)

### FR-3: Protected Endpoint Coverage

- The system SHALL protect all `/api/internal/*` endpoints with API Bearer token authentication universally via Fastify plugin encapsulation
- The system SHALL exempt infrastructure endpoints (`/healthz`, `/ready`) from authentication
- The system SHALL allow API documentation endpoints (`/docs`, `/docs/*`) without authentication
- The system SHALL return HTTP 401 for unauthenticated requests to protected endpoints
- The system SHALL use Fastify plugin architecture to create clean separation between protected and unprotected routes

### FR-4: Error Handling and Responses

- The system SHALL return HTTP 401 for missing authentication tokens
- The system SHALL return HTTP 401 for invalid tokens
- The system SHALL include descriptive error messages in authentication failures
- The system SHALL NOT expose the list of valid tokens in error responses
- The system SHALL log authentication failures with request details (excluding token value)

### FR-5: Request Context Propagation

- The system SHALL attach authenticated user information to the Fastify request object
- The system SHALL make user context available to all route handlers
- The system SHALL include user email in structured logs for all authenticated requests
- The system SHALL enable downstream services to access user identity without re-parsing tokens

## Technical Requirements

### TR-1: Token Validation Implementation

- The system SHALL use Node.js `crypto.timingSafeEqual` for constant-time token comparison
- The system SHALL support multiple valid tokens via comma-separated environment variable
- The system SHALL trim whitespace from configured tokens during parsing
- The system SHALL validate that at least one valid token is configured at startup

### TR-2: Fastify Plugin Integration

- The system SHALL implement authentication as a Fastify plugin with onRequest hook
- The system SHALL use Fastify plugin encapsulation to separate protected and unprotected routes
- The system SHALL register infrastructure routes before the authentication plugin
- The system SHALL register all business API routes within the authenticated plugin scope
- The system SHALL integrate with existing Fastify request lifecycle

### TR-3: Environment Configuration

- The system SHALL read API tokens from `API_TOKENS` environment variable (comma-separated list)
- The system SHALL validate required environment variables at application startup
- The system SHALL fail fast on missing required API token configuration
- The system SHOULD support loading tokens from secret management systems in production

### TR-4: TypeScript Type Definitions

- The system SHALL extend Fastify request types to include user identity
- The system SHALL provide type-safe access to authenticated user information
- The system SHALL define user identity types in shared domain types
- The system SHALL maintain full type safety across authentication flow

### TR-5: Logging and Observability

- The system SHALL log all authentication attempts (success and failure)
- The system SHALL include user email in all structured log entries when provided
- The system SHALL log authentication failures without including token values
- The system SHALL track authentication metrics for monitoring

### TR-6: Testing Strategy

- The system SHALL provide test utilities for setting valid test tokens
- The system SHALL enable easy mocking of authentication in integration tests
- The system SHALL test all authentication failure scenarios
- The system SHALL validate authentication middleware behavior with Fastify test utilities
- The system SHALL test user identity header extraction

## User Identity Model

### Authenticated Request Context

```typescript
{
  userId?: string;      // User ID from X-User-Id header (optional)
  email?: string;       // User email from X-User-Email header (optional)
  name?: string;        // User display name from X-User-Name header (optional)
  authenticated: true;  // Request is authenticated via valid API token
}
```

**Custom Headers Mapping:**

- `X-User-Id` → User ID (optional, for user-initiated requests)
- `X-User-Email` → User email address (optional, for user-initiated requests)
- `X-User-Name` → User display name (optional, for user-initiated requests)

**Note**: User identity headers are optional. Service-to-service calls that are not user-initiated may omit these headers. When present, they provide context about which user initiated the request through the calling service.

## Data Flow

### Successful Authentication Flow

1. **External Service** makes API request with API token in `Authorization: Bearer <token>` header
2. **External Service** optionally includes user context via `X-User-Email`, `X-User-Id`, `X-User-Name` headers
3. **Fastify Server** receives request and invokes authentication preHandler hook
4. **Authentication Middleware** extracts token from Authorization header
5. **Token Validator** performs constant-time comparison against configured valid tokens
6. **User Extractor** extracts optional user identity from custom headers
7. **Request Context** attaches authentication status and user identity to Fastify request object
8. **Logger** includes user email in request-scoped child logger (if provided)
9. **Route Handler** accesses authenticated context via `request.user`
10. **Business Logic** processes request with user context (if available)
11. **Response** returned to external service with appropriate status

### Failed Authentication Flow

1. **External Service** makes API request (missing or invalid token)
2. **Fastify Server** receives request and invokes authentication preHandler hook
3. **Authentication Middleware** attempts token extraction and validation
4. **Token Validator** detects authentication failure (invalid or missing token)
5. **Error Handler** logs authentication failure without exposing token value
6. **Response** returns HTTP 401 with error message describing failure reason
7. **Request Processing** terminates without invoking route handler

### Infrastructure Endpoint Flow

1. **Monitoring System** makes health check request to `/healthz`
2. **Fastify Server** receives request
3. **Route Matcher** identifies infrastructure endpoint
4. **Authentication Middleware** skips authentication (pre-configured exclusion)
5. **Health Handler** processes request without user context
6. **Response** returns health status

## API Specification

### Authentication Header Format

All protected endpoints require authentication via API token bearer token:

```
Authorization: Bearer <api-token>
```

**Example Service-to-Service Request (no user context):**

```
GET /api/internal/contacts
Authorization: Bearer sk_live_abc123xyz789
```

**Example User-Initiated Request (with user context):**

```
POST /api/internal/contacts
Authorization: Bearer sk_live_abc123xyz789
X-User-Email: john.doe@example.com
X-User-Id: user-uuid-123
X-User-Name: John Doe
Content-Type: application/json
```

### Protected Endpoints

All endpoints under `/api/internal/*` require API Bearer token authentication:

- `POST /api/internal/contacts`
- `GET /api/internal/contacts/:id`
- `GET /api/internal/contacts`
- All future internal API endpoints

### Unprotected Endpoints

The following endpoints do NOT require authentication:

- `GET /healthz` - Liveness probe
- `GET /ready` - Readiness probe
- `GET /docs` - API documentation (Swagger UI)
- `GET /docs/*` - API documentation assets

### Authentication Errors

#### Missing Token (401 Unauthorized)

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Missing authentication token"
}
```

#### Invalid Token Signature (401 Unauthorized)

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Invalid token signature"
}
```


## Environment Configuration

### Required Environment Variables

```bash
# API Token Authentication (Required)
# Multiple tokens can be provided as comma-separated values
API_TOKENS="sk_live_abc123xyz789,sk_live_def456uvw012"
```

### Development Configuration

For local development:

```bash
# Simple token for testing
API_TOKENS="dev_token_12345"
```

### Production Configuration

For production deployments:

- Use long, randomly generated tokens (minimum 32 characters)
- Store tokens in secure secret management service (AWS Secrets Manager, HashiCorp Vault, etc.)
- Use different tokens per calling service for better traceability
- Rotate tokens periodically as part of security policy
- Never commit tokens to version control

**Example Production Config:**

```bash
# Token provisioned for core-service
API_TOKENS="sk_prod_core_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"

# Multiple services (comma-separated)
API_TOKENS="sk_prod_core_abc123,sk_prod_frontend_xyz789,sk_prod_billing_def456"
```

**Token Generation Example (Node.js):**

```bash
# Generate a secure random token
node -e "console.log('sk_live_' + require('crypto').randomBytes(32).toString('hex'))"
```

## Security Considerations

### Token Validation Security

- **Constant-Time Comparison**: Always use `crypto.timingSafeEqual` to prevent timing attacks
- **Token Strength**: API tokens must be at least 32 characters with high entropy
- **Token Storage**: Store tokens in secure environment variables or secret management systems
- **Token Isolation**: Use different tokens per calling service for better security isolation
- **No Token Logging**: Never log token values in application logs

### Header Validation

- **Optional Headers**: User identity headers are optional and should not cause authentication failure if missing
- **Header Sanitization**: Validate email format and length to prevent injection attacks
- **Header Limits**: Enforce reasonable length limits on custom headers (e.g., 255 characters)
- **Header Types**: Validate header values before using in business logic

### Error Response Security

- **No Token Leakage**: Never include token values in error responses or logs
- **Generic Messages**: Provide descriptive but not overly specific error messages
- **No Timing Attacks**: Use constant-time comparison for token validation
- **Log Security**: Log authentication failures without exposing token values

### Infrastructure Security

- **Token Storage**: Store API tokens in secure environment variables or secret management systems
- **Token Rotation**: Support periodic token rotation by allowing multiple valid tokens
- **HTTPS Only**: Always use HTTPS in production to prevent token interception
- **Token Transport**: Only accept tokens via Authorization header (not query params or cookies)

### Rate Limiting

- Authentication failures do NOT bypass existing application-level rate limiting
- Consider adding additional rate limiting specifically for authentication failures
- Track repeated authentication failures per IP for abuse detection

## Testing and Validation

### Unit Tests

- **Token Validation**: Test token comparison with valid and invalid tokens
- **Header Extraction**: Test parsing of all optional user identity headers
- **Multiple Tokens**: Test validation against multiple configured tokens
- **Timing Safety**: Test that constant-time comparison is used
- **Error Scenarios**: Test all authentication failure paths

### Integration Tests

- **Middleware Integration**: Test authentication middleware with Fastify test utilities
- **Protected Routes**: Test that protected routes require authentication
- **Unprotected Routes**: Test that infrastructure routes work without authentication
- **User Context**: Test that user identity headers are properly extracted
- **Multiple Tokens**: Test that any configured token grants access
- **Error Responses**: Test correct HTTP status codes and error messages

### Test Utilities

```typescript
// Use configured test token
const testToken = "test_token_12345"; // Match API_TOKENS in test env

// Make authenticated test request (no user context)
const response1 = await fastify.inject({
  method: "GET",
  url: "/api/internal/contacts",
  headers: {
    authorization: `Bearer ${testToken}`
  }
});

// Make authenticated test request (with user context)
const response2 = await fastify.inject({
  method: "POST",
  url: "/api/internal/contacts",
  headers: {
    authorization: `Bearer ${testToken}`,
    "x-user-email": "test@example.com",
    "x-user-id": "user-123",
    "x-user-name": "Test User"
  },
  payload: { /* ... */ }
});
```

### Test Coverage Requirements

- **Authentication Middleware**: 100% coverage (all branches and error paths)
- **Token Validation**: 100% coverage (all failure scenarios)
- **Header Extraction**: 100% coverage (all optional headers)
- **Integration Tests**: All protected and unprotected routes

### Manual Testing

- Test with tokens configured in staging environment
- Test authentication with malformed authorization headers
- Verify logging includes user email when provided in headers
- Test performance impact of authentication middleware
- Test with missing user context headers (should succeed)

## Error Scenarios

### Client Errors (4xx)

| Scenario | HTTP Status | Response Message |
|----------|-------------|------------------|
| Missing Authorization header | 401 | Missing authentication token |
| Malformed Authorization header | 401 | Malformed authentication token |
| Invalid Bearer token format | 401 | Malformed authentication token |
| Invalid API token | 401 | Invalid authentication token |

### Server Errors (5xx)

| Scenario | HTTP Status | Response Message |
|----------|-------------|------------------|
| Missing API_TOKENS configuration | 500 | Internal server error |
| Token comparison error | 500 | Internal server error |
| Unexpected validation error | 500 | Internal server error |

**Note**: Server errors (5xx) should be logged with full details server-side but return generic messages to clients.

## Monitoring and Observability

### Metrics

- 🚧 `auth.attempts.total`: Counter for total authentication attempts
- 🚧 `auth.success.total`: Counter for successful authentications
- 🚧 `auth.failure.total`: Counter for failed authentications (labeled by reason)
- 🚧 `auth.duration`: Histogram of authentication middleware execution time

### Logging

- **Authentication Success**: Log user email (if provided), request path, and method at INFO level
- **Authentication Failure**: Log failure reason, request path, and IP address at WARN level (never log token value)
- **Configuration Issues**: Log missing or invalid API_TOKENS configuration at ERROR level
- **User Context**: Include user email in all structured logs for authenticated requests when provided

**Example Log Entries:**

```json
{
  "level": "info",
  "msg": "Authentication successful",
  "user": "user@example.com",
  "path": "/api/internal/contacts",
  "method": "POST"
}

{
  "level": "info",
  "msg": "Authentication successful",
  "path": "/api/internal/contacts",
  "method": "GET",
  "note": "Service-to-service call (no user context)"
}

{
  "level": "warn",
  "msg": "Authentication failed",
  "reason": "invalid_token",
  "path": "/api/internal/contacts",
  "ip": "10.0.1.5"
}
```

### Alerts

- 🚧 Alert if authentication failure rate exceeds 5% over 5 minutes
- 🚧 Alert if API_TOKENS is missing or empty at startup
- 🚧 Alert if authentication middleware latency exceeds 5ms (p95)
- 🚧 Alert on repeated authentication failures from same IP (possible attack)

## Risks and Mitigations

### Risk: API Token Compromise

**Impact**: Stolen tokens can access all internal APIs

**Mitigations**:
- Use long, high-entropy tokens (minimum 32 characters, recommended 64+)
- Store tokens in secure secret management service (never in code)
- Use different tokens per calling service for better traceability
- Rotate tokens periodically as part of security policy
- Use HTTPS to prevent token interception
- Monitor for suspicious authentication patterns
- Consider IP allowlisting for known internal services

### Risk: Token Replay Attacks

**Impact**: Stolen tokens can be reused indefinitely (tokens don't expire)

**Mitigations**:
- Use HTTPS exclusively to prevent token interception
- Implement IP allowlisting for internal services
- Monitor for unusual access patterns (rate limiting already in place)
- Rotate tokens regularly
- Consider implementing token revocation list if needed
- Log all API access for audit trail

### Risk: Timing Attacks

**Impact**: Attackers could determine valid tokens through timing analysis

**Mitigations**:
- Use `crypto.timingSafeEqual` for all token comparisons
- Ensure consistent response times for all authentication failures
- Do not provide specific error messages that reveal token validity details

### Risk: Missing or Invalid Configuration

**Impact**: Service fails to start or authentication is non-functional

**Mitigations**:
- Validate API_TOKENS at application startup
- Fail fast with clear error messages for missing configuration
- Provide environment variable examples in documentation
- Test configuration validation in CI/CD pipeline
- Require minimum token length (32 characters)

### Risk: Performance Impact

**Impact**: Authentication middleware adds latency to all requests

**Mitigations**:
- Use simple string comparison (very fast, <1ms)
- Profile authentication middleware performance
- Set SLA for authentication latency (target: <5ms p95)
- Minimize overhead in constant-time comparison

### Risk: Log Injection via User Headers

**Impact**: Malicious values in X-User-Email or other headers could corrupt logs

**Mitigations**:
- Use structured logging (Pino) which properly escapes values
- Validate email format before logging
- Enforce length limits on custom headers
- Sanitize user-provided headers before including in logs
- Use log aggregation tools that handle malicious content

## Implementation Structure

### File Organization

```
src/
├── infra/
│   └── auth/
│       ├── auth.plugin.ts                  # Authentication Fastify plugin
│       ├── auth.plugin.test.ts             # Plugin integration tests
│       ├── token-validator.ts              # Token validation logic
│       ├── token-validator.test.ts         # Validator unit tests
│       ├── auth.types.ts                   # Type definitions
│       └── index.ts                        # Auth exports
├── lib/
│   └── env.ts                              # Add API_BEARER_TOKENS environment variable
└── app.ts                                  # Register authentication plugin with route encapsulation
```

### Integration Points

- **Fastify**: Use plugin encapsulation to separate protected and unprotected routes
- **Environment**: Add API_BEARER_TOKENS configuration to `src/lib/env.ts`
- **Types**: Extend Fastify request types with authentication context
- **Logging**: Include user email in all structured logs when provided
- **Routes**: Infrastructure routes registered before plugin, business routes within plugin scope

## Future Enhancements

- 🚧 Token metadata stored in database (service name, issued date, last used)
- 🚧 Token revocation list via Redis or database
- 🚧 Per-route permission checks based on service identity
- 🚧 Token usage analytics and monitoring dashboard
- 🚧 Automatic token rotation mechanism
- 🚧 Request signing for additional security
- 🚧 Multi-tenant support with tenant-specific tokens
- 🚧 Audit logging for all authenticated requests to dedicated audit log
- 🚧 Token scopes or permissions for fine-grained access control
- 🚧 Integration with service mesh for mutual TLS

## Success Criteria

- All `/api/internal/*` endpoints require API token authentication
- Infrastructure endpoints (`/healthz`, `/ready`) work without authentication
- Authentication failures return appropriate HTTP status codes and messages
- User identity headers are properly extracted when provided
- Requests without user context (service-to-service) work correctly
- Test coverage meets minimum 90% for authentication code
- Authentication middleware adds <5ms latency (p95)
- Constant-time token comparison prevents timing attacks
- Tokens are never exposed in logs or error responses
- Documentation complete with examples and troubleshooting guide

## Review Status

**Status**: Draft - Ready for Technical Review

**Drafted by**: AI Assistant  
**Reviewed by**: _Pending_  
**Approved by**: _Pending_

