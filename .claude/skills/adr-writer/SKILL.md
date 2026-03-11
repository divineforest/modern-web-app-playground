---
name: adr-writer
description: Write Architecture Decision Records (ADRs) optimized for AI-friendliness. Scores documents on a 10-point AI-friendliness rubric and iterates until score exceeds 9.5. Use when the user asks to write an ADR, document an architecture decision, or evaluate an existing ADR's AI-friendliness.
---

# ADR Writer

Write Architecture Decision Records that maximize AI-friendliness — structured so LLMs can discover, parse, and act on decisions with minimal friction.

## Workflow

### Phase 1: Gather Context

1. Read the project's AI principles: `docs/ai-principles.md` and `docs/ai-guide.md`
2. Read `docs/architecture/overview.md` and `AGENTS.md` for current architecture context
3. Scan `docs/adr/` for existing ADRs to maintain consistency
4. Ask the user about the decision if not already clear:
   - What problem are we solving?
   - What options were considered?
   - What was chosen and why?

### Phase 2: Write the ADR

Create the ADR at `docs/adr/YYYY-MM-DD-HH-MM-<slug>.md` using today's date and current time (24-hour clock).

Use this structure:

```markdown
# <Title>

**Status:** proposed | accepted | deprecated | superseded
**Date:** YYYY-MM-DD HH:MM
**Supersedes:** [link if applicable]

## Context

What is the problem or situation that motivates this decision?

Include:
- Current state with concrete details (file paths, module names, data shapes)
- Pain points with evidence (error rates, friction reports, concrete examples)
- Constraints that narrow the solution space

## Decision

What is the change being proposed or adopted?

Include:
- The chosen approach with enough detail for an LLM to implement it
- Code examples showing the target pattern (before/after or new usage)
- File structure changes (tree diagrams for new directories)
- Schema changes (actual column definitions, not prose descriptions)
- Import chains that show how components connect

## Consequences

### Positive
- Concrete benefits with measurable claims where possible

### Negative
- Honest trade-offs, migration costs, new complexity

### AI-Friendliness Impact
Score each dimension (1-5) and explain why:
- **Discoverability**: Can an LLM find this via search/imports?
- **Cohesion**: Is related information co-located or scattered?
- **Pattern consistency**: Does this follow or break existing patterns?
- **Type coverage**: Does this improve or reduce typed surface area?
- **Traceability**: Can an LLM follow the data flow via import chains?

**Overall AI-friendliness: X/5**

## Options Considered

### Option A: <name> (recommended)
- How it works (concrete, not abstract)
- Trade-offs
- AI-friendliness: X/5 with rationale

### Option B: <name>
- How it works
- Why rejected (specific technical reason)
- AI-friendliness: X/5 with rationale

[Additional options as needed]

## Migration Path
Numbered steps. Each step should be independently shippable and testable.
```

### Phase 3: Score AI-Friendliness

After writing the ADR, score it using the rubric in [references/adr-writer-scoring-rubric.md](references/adr-writer-scoring-rubric.md). Read that file for the full criteria.

**Quick reference — the 10 dimensions (1.0 each, total 10.0):**

1. Structured parseability
2. Self-contained context
3. Concrete over abstract
4. Explicit trade-offs
5. Terminology consistency
6. Actionable consequences
7. Searchability
8. Unambiguous language
9. Token efficiency
10. Import-chain traceability

### Phase 4: Optimize Loop

```
while score <= 9.5:
    identify lowest-scoring dimensions
    rewrite those sections
    re-score
    report delta
```

Report each iteration:

```
Iteration 1: 7.8/10.0
  - Weakest: #3 Concrete over abstract (0.5) — missing code examples
  - Weakest: #10 Import-chain traceability (0.6) — no import paths shown
  → Fixing...

Iteration 2: 9.2/10.0
  - Weakest: #8 Unambiguous language (0.8) — 3 uses of "might" without fallback
  → Fixing...

Iteration 3: 9.6/10.0 ✓ Done
```

Stop when score > 9.5. Present the final score breakdown.

## Scoring Guidelines

Be a **strict grader**. The goal is to produce documents that genuinely help LLMs, not to pass a checkbox exercise.

- 0.0–0.3: Absent or actively harmful
- 0.4–0.6: Present but weak or generic
- 0.7–0.8: Good with minor gaps
- 0.9–1.0: Excellent, no meaningful improvement possible

Common deductions:
- Prose where a code example would be clearer → -0.3 on dimension #3
- "We could do X" without showing what X looks like → -0.2 on #3
- Vague status ("may change") without concrete criteria → -0.3 on #8
- Repeating the same concept in different words → -0.2 on #9

## Key Principles (from project AI guidelines)

- **Cohesion > file count**: Keep the ADR self-contained. Don't split into multiple files.
- **Types > prose**: Show schemas and type definitions, not English descriptions of data shapes.
- **Patterns > explanations**: Show the target code pattern. LLMs learn by example, not instruction.
- **Evidence > theory**: Every claim about AI-friendliness needs a mechanical explanation of how it helps LLM operation.
- **Consistent terminology**: Use the same term for the same concept throughout. Match terms already used in the codebase.

## Evaluating Existing ADRs

When asked to evaluate an existing ADR:

1. Read the ADR
2. Read `docs/ai-principles.md` and scoring rubric
3. Score all 10 dimensions
4. Identify top 3 improvements
5. Ask user if they want auto-optimization or just the report
