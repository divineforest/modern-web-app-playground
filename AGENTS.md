# AGENTS.md

Backend e-commerce system (Mercado). Integrates with Core microservice.

## Monorepo Structure

This project uses a **pnpm workspace monorepo**:
- Backend application: `apps/backend/` (package name: `@mercado/backend`)
- Web application: `apps/web/` (package name: `@mercado/web`)
- Workspace root: manages shared tooling (biome, cspell, husky) and delegates backend commands via `--filter`
- All backend code, tests, and configs live in `apps/backend/`
- Run commands from root: `pnpm <command>` automatically targets the backend package

## Project Stack

Node.js 22+, TypeScript, Fastify, PostgreSQL, Temporal workflows, ts-rest (type-safe APIs), Drizzle ORM, Vitest, Vite, React.

## Convention Over Configuration

Prefer sensible defaults over explicit configuration. Don't ask for or require values that can be reasonably inferred:

- **Local URLs**: Use `http://localhost:3000` for the backend server unless told otherwise
- **Web dev server**: Use `http://localhost:5173` for the Vite dev server unless told otherwise
- **Database**: Assume standard local dev connection (see docker-compose or .env.example)
- **Test environments**: Smoke tests run against local dev server by default
- **File paths**: Use project-standard locations (e.g., `apps/backend/src/`, `apps/web/src/`, `apps/backend/tests/`, `scripts/`)

When in doubt, use the most common/standard value and proceed. Only ask when the default genuinely won't work.

## Running Scripts

**Always use pnpm to run scripts instead of executing them directly.**

 1. Check `package.json` "scripts" section first - use `pnpm <script-name>` if it exists
2. Otherwise, use `pnpm exec ./path/to/script` (e.g., `pnpm exec ./scripts/custom-script.sh`)
3. Never run scripts directly like `./scripts/smoke-test.sh` or `bash scripts/smoke-test.sh`

## File Operations

When renaming or moving files, use `git mv` via Shell instead of Write + Delete:

```bash
git mv old/path/file.ts new/path/file.ts
```

This avoids the Delete permission prompt that breaks auto-agent mode.

## Code Style

- **Biome** for formatting and basic linting - run `pnpm check:fix`
- **ESLint** for advanced TypeScript linting - run `pnpm lint:eslint`
- **Both tools**: Run `pnpm lint` for unified linting (Biome + ESLint)
- **Enforced**: `import type` for TypeScript type imports
- Style: 2-space indent, 100 char width, single quotes, semicolons required

## After Changes

Before considering work complete, ensure all checks pass locally:

### Verification Strategy

Use a two-phase approach to avoid timeouts on large codebases:

**Phase 1: Check modified files first**
- Run TypeScript check on changed files only: `npx tsc --noEmit path/to/file1.ts path/to/file2.ts`
- Include direct importers of modified files
- This catches 95% of issues in <5 seconds
- Example: If you modified `apps/backend/src/modules/foo/bar.ts`, also check `apps/backend/src/modules/foo/index.ts` and any files that import from it

**Phase 2: Run full project checks**
- Only after Phase 1 passes, run full checks:
- `pnpm lint`
- `pnpm test`
- `pnpm typecheck`
- `pnpm type-coverage`
- If implementing from `docs/specs/`: Remove 🚧 from completed items

**Phase 3: Browser QA (for UI changes)**
- If the task touched `apps/web/` or added/modified user-facing features:
  1. Start dev servers if not running (backend and web)
  2. Use the browser tool to walk through the primary user flow end-to-end
  3. Verify: page loads, interactive elements work, data persists across navigation
  4. Check edge cases: empty states, error states, loading states
- Skip this phase for backend-only changes with no UI impact

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
