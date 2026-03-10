---
globs:
  - apps/backend/src/db/**
---

# Migration Conventions

## Never Manually Edit Migration Files

Drizzle-kit tracks migrations via `meta/_journal.json`. Manually created `.sql` files are ignored and will NOT be applied, even if the command reports "success".

Only modify these files via `drizzle-kit` commands:
- `apps/backend/src/db/migrations/*.sql`
- `apps/backend/src/db/migrations/meta/_journal.json`
- `apps/backend/src/db/migrations/meta/*_snapshot.json`

## Workflow for Schema Changes

1. Modify schema in `apps/backend/src/db/schema-local.ts`
2. Run `pnpm db:generate` to generate the migration
3. Review the generated SQL
4. Run `pnpm db:migrate` (dev) or `pnpm db:migrate:test` (test)

```bash
pnpm db:generate      # Generate migration from schema changes
pnpm db:migrate       # Apply migrations to dev database
pnpm db:migrate:test  # Apply migrations to test database
pnpm db:studio        # Open Drizzle Studio
```

Note: `db:generate`, `db:push`, `db:introspect`, and `db:check` automatically run `tsc` first (drizzle-kit requires compiled JS to resolve ES module imports).

## UUID Generation

Always use `gen_random_uuid()` — never `uuid_generate_v4()` (requires uuid-ossp extension; `gen_random_uuid()` is built-in PostgreSQL 13+).

```sql
-- ✅ Correct
id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL

-- ❌ Wrong function
id uuid DEFAULT uuid_generate_v4()
```

Naming: primary key is `id`; foreign keys are `{table}_id` (e.g. `user_id`); semantic FKs are `{context}_{table}_id` (e.g. `created_by_user_id`).

## Constrained Values: CHECK vs ENUM

Default to CHECK constraints — they are transactional and easy to modify. Convert to ENUM only after values are stable for 6+ months across 2+ tables.

```sql
-- ✅ CHECK (default for new columns)
CREATE TABLE jobs (
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'))
);

-- Adding a value: transactional and simple
ALTER TABLE jobs DROP CONSTRAINT jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'on_hold'));

-- ENUM (only for stabilized domains)
CREATE TYPE payment_method AS ENUM ('cash', 'card', 'bank_transfer');

-- ⚠️ ALTER TYPE ADD VALUE cannot run in a transaction
ALTER TYPE payment_method ADD VALUE 'crypto';

-- ❌ NEVER
CREATE TYPE payment_method_enum AS ENUM (...)  -- Wrong suffix
CREATE TYPE status AS ENUM ('Active', 'DONE')  -- Wrong case
```

ENUM naming: singular, snake_case, no `_enum`/`_type` suffix; values lowercase snake_case.
