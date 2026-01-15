# AGENTS.md

Backend accounting system for practice management. Integrates with Odoo ERP and Core microservice.

## Project Stack

Node.js 22+, TypeScript, Fastify, PostgreSQL, Temporal workflows, ts-rest (type-safe APIs), Drizzle ORM, Vitest.

## Convention Over Configuration

Prefer sensible defaults over explicit configuration. Don't ask for or require values that can be reasonably inferred:

- **Local URLs**: Use `http://localhost:3000` for the web server unless told otherwise
- **Database**: Assume standard local dev connection (see docker-compose or .env.example)
- **Test environments**: Smoke tests run against local dev server by default
- **File paths**: Use project-standard locations (e.g., `src/`, `tests/`, `scripts/`)

When in doubt, use the most common/standard value and proceed. Only ask when the default genuinely won't work.

## Running Scripts

**Always use pnpm to run scripts instead of executing them directly.**

 1. Check `package.json` "scripts" section first - use `pnpm <script-name>` if it exists
2. Otherwise, use `pnpm exec ./path/to/script` (e.g., `pnpm exec ./scripts/custom-script.sh`)
3. Never run scripts directly like `./scripts/smoke-test.sh` or `bash scripts/smoke-test.sh`

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
- If implementing from `docs/specs/`: Remove 🚧 from completed items

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
