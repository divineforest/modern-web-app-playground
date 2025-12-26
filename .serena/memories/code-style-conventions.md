# Code Style and Conventions

## Code Style Configuration
- **Formatter**: Biome (fast, Rust-based)
- **Advanced Linting**: ESLint with TypeScript-specific rules
- **Style**: 2-space indent, 100 char width, single quotes, semicolons required
- **Type Imports**: Enforced `import type` for TypeScript type imports

## Biome Configuration
```json
{
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "es5",
      "semicolons": "always"
    }
  }
}
```

## TypeScript Conventions
- **Strict Mode**: All TypeScript strict options enabled
- **No Implicit Any**: Explicit typing required
- **Type Coverage**: Minimum 97% enforced via type-coverage tool
- **Module System**: ES Modules with `.js` extension imports
- **Type Safety**: Runtime validation with Zod schemas

## Code Organization Patterns

### Module Structure
Each domain module follows this structure:
```
module-name/
├── api/                    # HTTP routes and contracts (ts-rest)
├── services/               # Business logic and orchestration
├── repositories/           # Data access layer (if needed)
├── workflows/              # Temporal workflows and activities (if needed)
├── domain/                 # Entities, types, and domain models
└── index.ts               # Public API exports
```

### Naming Conventions
- **Modules**: dashed-lowercase (e.g., `contacts-sync`, `inbound-email`)
- **Files**: kebab-case for files, PascalCase for classes
- **Functions**: camelCase with descriptive names
- **Constants**: UPPER_SNAKE_CASE for constants
- **Types**: PascalCase for interfaces and types

### Import Organization
- **Type Imports**: Must use `import type` for type-only imports
- **External Imports**: Third-party libraries first
- **Internal Imports**: Local modules after external
- **Relative Imports**: Use relative paths for local modules

## Database Conventions
- **Timestamps**: Always use `timestamp('column_name', { mode: 'date', withTimezone: true })`
- **Table Names**: snake_case for PostgreSQL tables
- **Column Names**: snake_case for PostgreSQL columns
- **Schema Files**: Separate core and local schema definitions

## Testing Conventions
- **Test Files**: Colocated with source files (`.test.ts` suffix)
- **Test Structure**: Flat describe blocks, avoid nested describes
- **Business Setup**: Never put business setup in beforeEach - use factory functions
- **Test Data**: Create fresh data per test, no shared state
- **Authentication**: Use `{ authorization: 'Bearer test_token_12345' }` for protected routes

## Error Handling Patterns
- **Domain Errors**: Use ValidationError with user-friendly messages
- **Database Errors**: Transform constraint violations to ValidationError
- **HTTP Errors**: Standardized error response format
- **Logging**: Structured logging with Pino, include context

## API Design Patterns
- **Contracts**: Define ts-rest contracts before implementation
- **Validation**: Use Zod schemas for request/response validation
- **Authentication**: Bearer token authentication for internal APIs
- **Error Responses**: Consistent error format with proper HTTP status codes

## Workflow Patterns
- **Activities**: External operations and side effects
- **Workflows**: Business logic orchestration only
- **Error Handling**: Automatic retries and compensation patterns
- **Testing**: Workflow tests colocated with definitions

## Code Quality Standards
- **Type Safety**: No `any` types unless absolutely necessary
- **Error Boundaries**: Comprehensive error handling
- **Documentation**: JSDoc comments for public APIs
- **Performance**: Efficient database queries and connection management

## Layer Type Separation

### Repository Layer

- **Own Types**: Repositories define and use their own types (Drizzle-inferred types like `GlobalContact`, `NewGlobalContact`)
- **No Domain Types**: Repositories should NOT import or return domain types
- **Caller Responsibility**: It is the caller's (service layer) responsibility to convert repository types to domain types

### Service Layer

- **Type Conversion**: Services convert between repository types and domain types
- **Domain Types**: Services work with domain types (`Contact`) for business logic
- **API Types**: Services return API-appropriate types (`ContactResponse`) to the API layer

### API Layer

- **Contract Types**: Uses Zod schemas for request/response validation
- **Response Types**: Works with response-specific types (`ContactResponse`)

### Example Flow

```text
Repository (GlobalContact) → Service (toContact → Contact) → API (toContactResponse → ContactResponse)
```

### Conversion Functions

- `toContact(globalContact: GlobalContact): Contact` - Converts Drizzle type to domain type
- `toContactResponse(contact: Contact): ContactResponse` - Converts domain type to API response type
