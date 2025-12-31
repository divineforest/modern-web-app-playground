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

Before considering work complete, ensure all checks pass locally:

- `pnpm lint`
- `pnpm test`
- `pnpm typecheck`
- `pnpm type-coverage`

## AI Feedback Loop

After completing a task, briefly evaluate:

1. **Friction encountered**: What slowed you down or was difficult to find/understand?
2. **Improvement idea**: If you have a concrete suggestion to reduce that friction, propose it
3. **Score**: Rate your suggestion 1-10 (10 = high confidence it helps AI, not just "seems useful")

**Rules**:
- Only report friction you actually experienced, not theoretical issues
- Skip if the task was smooth - no feedback needed
- Be brutally honest: documentation rarely helps AI; code quality improvements usually do
- Low-confidence suggestions (score < 7) should probably be skipped
