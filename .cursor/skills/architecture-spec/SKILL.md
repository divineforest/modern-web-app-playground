---
name: architecture-spec
description: >
  Write architecture and technical spec documents for significant design decisions,
  system changes, or new architectural patterns. Use when the user asks to design a system,
  evaluate approaches, write a tech spec, update architecture docs, or document how
  a significant change should be implemented.
---

# Architecture Spec

Write architecture/technical spec documents for significant changes. Evaluate designs through
two lenses: technical merit and AI-assistant effectiveness.

## Inputs

Before writing any spec, gather context:

1. Read `docs/architecture.md` — current system structure and conventions
2. Read `docs/ai-principles.md` — AI-friendliness first principles
3. Read `docs/ai-guide.md` — validated AI-centric insights
4. Read relevant module code — understand existing patterns firsthand
5. Analyze the user's request — identify what needs to be designed and its scope

## Workflow

### Phase 1: Frame the Problem

Identify and state clearly:

- **What** needs to be designed or changed
- **Why** it's needed now (trigger/context)
- **Constraints** — timeline, backward compatibility, existing integrations
- **Scope** — which modules/layers are affected

If the problem is unclear, ask targeted questions using AskQuestion. Don't guess scope.

### Phase 2: Explore Options

For each viable approach:

1. **Describe** the approach concisely
2. **Show concrete code** — real patterns using the project's stack, not pseudocode
3. **Evaluate trade-offs** across these dimensions:

| Dimension | What to assess |
|-----------|---------------|
| Correctness | Does it solve the problem fully? Edge cases? |
| Complexity | Implementation effort, cognitive load, moving parts |
| Consistency | Does it follow existing project patterns? |
| Extensibility | How easy to modify when requirements change? |
| AI-friendliness | See evaluation criteria below |

4. **State the risks** — what could go wrong, migration cost, reversibility

### Phase 3: AI-Friendliness Evaluation

Apply the project's validated principles from `docs/ai-principles.md`:

- **Cohesion over file count** — Does this keep related logic together or scatter it?
- **Type coverage** — Does this maintain or improve type safety?
- **Pattern consistency** — Does this introduce a new pattern or follow existing ones?
- **Discoverability** — Can an AI find and understand this with semantic search?

For each option, rate AI-friendliness 1–5 with a concrete mechanical justification.
Reject justifications that can't explain the effect on LLM operation.

### Phase 4: Recommend and Document

1. State your recommendation with rationale
2. Write the spec document (see format below)
3. If the spec changes `docs/architecture.md`, draft those updates too

Present the recommendation to the user. Do NOT finalize until they confirm.

## Spec Document Format

Store specs at `docs/arch/<slug>.md` — use a short descriptive slug (e.g., `shared-api-contracts.md`, `cart-checkout-flow.md`).

```markdown
# <Title>

**Date:** YYYY-MM-DD

## Overview

What this spec covers and why. The problem or opportunity that triggered it.

## Design

The recommended approach in detail. Be specific — include code patterns when the spec
is about implementation approach.

## Alternatives Considered

### Alternative A: <Name>
<Description with code example, why it was not chosen>

### Alternative B: <Name>
<Description with code example, why it was not chosen>

## Trade-offs

### Positive
- ...

### Negative
- ...

### AI-Friendliness Impact
- ...

## Implementation Plan

Ordered steps to implement the design. Include migration steps if changing existing code.
```

## Code Examples in Specs

Specs about implementation patterns MUST include concrete code. Show the actual
pattern using the project's stack — Fastify, ts-rest, Drizzle, Temporal.

Good — shows the specific pattern being designed:

```typescript
// Option A: Co-located repository with service
export class OrderService {
  constructor(private db: Database) {}

  async getOrder(id: string) {
    return this.db.query.orders.findFirst({ where: eq(orders.id, id) });
  }
}
```

Bad — abstract description without code:

> "We'll create a service that queries the database using the ORM."

## Updating Architecture Docs

When a spec affects `docs/architecture.md`:

1. Draft the specific changes (sections to add/modify)
2. Keep the same style — terse, structural, no tutorials
3. Show the diff to the user before applying
4. Never add content that duplicates what the code already expresses through types

## Common Spec Categories

| Category | Key considerations |
|----------|-------------------|
| New module structure | Follow existing module layout, check `modules/` for patterns |
| Database schema | Timestamps with timezone, migration strategy, index needs |
| External integration | Repository pattern in `shared/data-access/`, error handling |
| Async processing | Temporal workflow vs. direct, retry strategy, idempotency |
| API design | Internal vs. public versioning, ts-rest contract placement |
| Cross-cutting concern | `shared/` vs. `lib/` vs. Fastify plugin |
