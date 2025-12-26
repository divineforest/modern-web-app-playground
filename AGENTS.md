# AGENTS.md

Backend accounting system for practice management. Integrates with Odoo ERP and Core microservice.

## Project Stack

Node.js 22+, TypeScript, Fastify, PostgreSQL, Temporal workflows, ts-rest (type-safe APIs), Drizzle ORM, Vitest.

## Code Style

- **Biome** for formatting and basic linting - run `pnpm check:fix`
- **ESLint** for advanced TypeScript linting - run `pnpm lint:eslint`
- **Both tools**: Run `pnpm lint` for unified linting (Biome + ESLint)
- **Enforced**: `import type` for TypeScript type imports
- Style: 2-space indent, 100 char width, single quotes, semicolons required

## After Changes

Run `pnpm lint` and `pnpm test` before considering work complete.
