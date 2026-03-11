---
name: create-spec
description: >
  Write technical specification documents for new features or changes to existing features.
  Use proactively when the user asks to add a new feature, modify an existing feature, or
  explicitly requests a spec. Covers requirements gathering, clarification, edge cases,
  and iterative scoring. Outputs only spec .md files — does not implement code.
---

# Create Specification

Write feature specs following the project's specification framework (`docs/specification-guide.md`).
Your role is spec author only — never implement code.

## Workflow

### Phase 1: Understand

1. Read `docs/specification-guide.md` for the template and conventions
2. Read `docs/architecture/overview.md` for system context
3. Analyze the user's request — identify the core feature, affected modules, and integration points
4. List what you know vs. what's ambiguous

### Phase 2: Clarify

Ask the user targeted questions before writing anything. Focus on:

- **Scope boundaries**: What's in vs. out of scope?
- **User-facing behavior**: What does success look like for the end user?
- **Edge cases**: Concurrent requests, empty states, partial failures, idempotency
- **Integration points**: External systems, webhooks, existing modules affected
- **Data model impact**: New tables, schema changes, migrations
- **Error handling**: What happens when things go wrong?
- **Security**: Auth, authorization, input validation, rate limiting
- **E2E scenarios**: For user-facing features, what are the 3-5 main user flows that should be verified end-to-end?

Use the AskQuestion tool for structured questions when possible. Group related questions.

Do NOT proceed to drafting until you have enough clarity. It's better to ask one extra question than to guess.

### Phase 3: Draft

1. Create the spec file at `docs/specs/<feature-name>.md`
2. Use the template from `docs/specification-guide.md`
3. Follow these conventions strictly:
   - RFC 2119 language (SHALL, SHOULD, MAY)
   - Numbered requirements (FR-X, TR-X)
   - Natural language naming ("order status", not "orderStatus")
   - 🚧 markers for planned-but-undesigned items
   - Feature-specific technical details only — never repeat standard stack info
   - Bold for system components in data flows
4. Think carefully about:
   - Happy path AND failure paths in data flows
   - Idempotency for webhook/event-driven features
   - Retry strategies and dead-letter handling for async operations
   - Database index needs for query patterns
   - Backward compatibility if modifying existing features
   - E2E test scenarios for user-facing features (main success path + key alternate paths)

### Phase 4: Review and Iterate

After drafting, self-evaluate the spec across three dimensions:

| Dimension | What it measures |
|-----------|-----------------|
| **Clarity** | Can a developer implement this without asking questions? Are requirements unambiguous? |
| **Completeness** | Are all scenarios covered? Edge cases? Error handling? Testing strategy? For user-facing features: are E2E scenarios listed for the main success path? |
| **Technical approach** | Is the design sound? Does it follow project patterns? Are risks identified? |

**Rules:**
- Minimum passing bar: all three dimensions must be strong (roughly 8/10 each)
- If any dimension is weak, identify the specific gaps, revise the spec, and re-evaluate
- Do NOT append scores or a score table to the spec file — evaluation is internal only

### Phase 5: Finalize

Once the score meets the threshold:

1. Present the final spec to the user
2. Summarize key decisions made during the process
3. List any deferred items (marked with 🚧) that need future attention
4. Do NOT implement any code — the spec is the deliverable

## Updating Existing Specs

When modifying an existing feature:

1. Read the existing spec from `docs/specs/`
2. Identify which sections need changes
3. Preserve unchanged requirements — don't rewrite what still holds
4. Add new requirements with the next available FR-X / TR-X numbers
5. Note what changed and why in the Overview or a changelog note

## Common Pitfalls to Catch

- Requirements that are too vague to test ("the system should be fast")
- Missing error scenarios for external integrations
- No consideration of concurrent access or race conditions
- Forgetting non-functional requirements (monitoring, logging, alerts)
- Scope creep — gently push back and suggest non-goals
- Repeating standard tech stack details already in `architecture.md`
