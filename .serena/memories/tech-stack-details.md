# Technology Stack Details

## Core Runtime & Language
- **Node.js**: Version 22+ (specified in .nvmrc)
- **TypeScript**: Latest stable with strict configuration
- **Module System**: ES Modules with `.js` extension imports
- **Package Manager**: pnpm (managed via corepack, version in package.json)

## Web Framework & API
- **Fastify**: High-performance HTTP server (3x faster than Express)
- **ts-rest**: End-to-end type-safe API contracts
- **@fastify/cors**: Cross-Origin Resource Sharing
- **@fastify/helmet**: Security headers and protection
- **@fastify/rate-limit**: Request rate limiting
- **@fastify/swagger**: OpenAPI 3.0 specification generation
- **@fastify/swagger-ui**: Interactive API documentation

## Database & ORM
- **PostgreSQL**: Primary database (containerized via Docker)
- **Drizzle ORM**: Type-safe ORM with SQL-like query builder
- **drizzle-kit**: Schema migrations, introspection, and development tools
- **postgres**: High-performance PostgreSQL client driver
- **Connection Management**: Advanced connection pooling with singleton factory

## Workflow Orchestration
- **Temporal**: Durable workflow execution and orchestration
- **@temporalio/worker**: Workflow and activity execution
- **@temporalio/client**: Workflow management and scheduling
- **@temporalio/workflow**: Workflow development framework
- **@temporalio/activity**: Activity function framework

## Configuration & Environment
- **@t3-oss/env-core**: Type-safe environment variable management
- **dotenv**: Environment file loading
- **Zod**: Runtime type validation and schema definition
- **Single Source of Truth**: All config in src/lib/env.ts

## Development Tools

### Code Quality
- **Biome**: Fast code formatting and basic linting (Rust-based)
- **ESLint**: Advanced linting with TypeScript-specific rules
- **@typescript-eslint/parser**: TypeScript syntax understanding
- **@typescript-eslint/eslint-plugin**: TypeScript-specific linting rules
- **eslint-config-prettier**: Prevents conflicts with Biome

### Type Safety & Analysis
- **type-coverage**: TypeScript type coverage measurement (97%+ required)
- **TypeScript**: Strict mode with no implicit any
- **Knip**: Dead code detection and dependency analysis

### Security & Quality
- **CSpell**: Code spell checking with custom dictionaries
- **Gitleaks**: Secret detection and security scanning
- **Husky**: Git hooks for automated quality gates

## Testing Framework
- **Vitest**: Fast unit and integration testing framework
- **@vitest/coverage-v8**: Code coverage reporting
- **MSW**: Mock Service Worker for API mocking
- **Test Factories**: Custom factory functions for test data

## Logging & Observability
- **Pino**: High-performance structured logging
- **pino-pretty**: Pretty-printed logs for development
- **Sentry**: Error tracking and monitoring (configured)

## Containerization & Infrastructure
- **Docker**: Database containerization
- **Docker Compose**: Multi-container orchestration
- **PostgreSQL Container**: Consistent development environment

## Build & Deployment
- **tsx**: TypeScript execution without compilation (development)
- **TypeScript Compiler**: Production builds to JavaScript
- **ES Modules**: Modern module system for optimal performance

## Key Integration Benefits

### Type Coverage (type-coverage)
- **Current Coverage**: 97.02% (12,638 / 13,025 identifiers)
- **Regression Prevention**: Automated builds fail if coverage drops
- **AI Assistance**: Near-complete type information enables accurate suggestions
- **Team Accountability**: Makes type safety a measurable goal

### Docker & Database
- **Environment Consistency**: Identical PostgreSQL across all machines
- **Multi-Database Setup**: Dev and test databases in single instance
- **Data Persistence**: Volume-based storage survives container restarts
- **Easy Reset**: Clean state with `docker-compose down -v`

### Drizzle ORM
- **Type Safety**: Full TypeScript integration with automatic inference
- **Performance**: Lightweight ORM with minimal overhead
- **Migration Management**: Version-controlled schema changes
- **Developer Experience**: Excellent IntelliSense and compile-time errors

### Fastify + ts-rest
- **Performance**: 3x faster than Express with async/await support
- **Type Safety**: End-to-end type safety from client to server
- **Auto-Documentation**: OpenAPI specs generated from TypeScript contracts
- **Validation**: Runtime request/response validation with zero overhead

### Temporal Workflows
- **Durable Execution**: Workflows survive process restarts and failures
- **Scalability**: Horizontal scaling with distributed execution
- **Advanced Features**: Long-running workflows, signals, queries, scheduling
- **Monitoring**: Built-in workflow monitoring and Web UI

### Configuration Management
- **Type Safety**: Runtime validation with compile-time inference
- **Environment Separation**: Server/client variable distinction
- **Error Handling**: Comprehensive validation errors at startup
- **Security**: Prevents accidental exposure of server-only variables

## Performance Characteristics
- **Development Speed**: Instant TypeScript execution with hot reload
- **Server Performance**: 3x faster than Express with optimized handling
- **Database Performance**: Connection pooling and query optimization
- **Type Safety Performance**: Compile-time checks eliminate runtime validation
- **Workflow Performance**: High-throughput processing with efficient state management

## Security Features
- **Security Headers**: Helmet middleware for comprehensive protection
- **CORS Policies**: Configurable cross-origin resource sharing
- **Rate Limiting**: Configurable request rate limiting
- **Authentication**: Bearer token authentication for internal APIs
- **Secret Detection**: Automated scanning for committed secrets
- **Input Validation**: Zod schema validation for all inputs