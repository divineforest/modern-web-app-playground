# AI-Friendliness Guide

> **Meta-programming file**: This document captures validated insights about what makes a codebase AI-friendly. Consult this only when explicitly working on improving AI-friendliness (e.g., refining tooling, adjusting quality metrics, or evaluating AI friction reports). This is NOT a ruleset for everyday production code work.

---

**Current Score: 9.4/10** - Exceptional. Achieved 98%+ type coverage in production code.

## Current State (What Works)

Factors that contribute to the high AI-friendliness score:

- **98%+ type coverage** (production code) - Enforced via `pnpm type-coverage`
- **Consistent patterns** - Same structure across all modules
- **Machine-enforced conventions** - Pre-commit hooks catch issues
- **Working code examples** - 5 modules to learn from

## Anti-Patterns (What Doesn't Help AI)

Additions that seem helpful but provide no measurable AI benefit:

- Step-by-step guides and tutorials
- Visual diagrams (ER, sequence, architecture)
- Documentation indexes
- Module-level READMEs
- Process documentation

## AI-Centric Principles (Validated)

Insights validated through actual AI interaction with this codebase:

### Cohesion > File Size

**Myth**: "Large files (>300 lines) should be split for AI readability"

**Reality**: AI semantic search returns chunks, not files. A 600-line cohesive service is ONE search hit with full context. Splitting creates:
- Multiple files to discover and correlate
- Import/export boilerplate overhead
- Fuzzy boundaries that obscure logic flow

**Rule**: Split files only when they violate single responsibility, not based on line count.

### Type Coverage > Documentation

**Myth**: "More documentation helps AI understand code"

**Reality**: AI infers intent from types and patterns. High type coverage provides:
- Precise function signatures AI can rely on
- Compile-time validation of AI suggestions
- Self-documenting code through explicit types

**Rule**: Invest in type coverage before writing explanatory docs.

### Type Coverage: Production > Tests

**Myth**: "High type coverage everywhere (including tests) helps AI"

**Reality**: Test type coverage has diminishing returns for AI. Value breakdown:
- Production code types: **9/10** - Essential for understanding APIs and data flow
- Test utilities/factories: **7/10** - Naturally typed via TypeScript inference
- Test response bodies (`JSON.parse`): **2/10** - Low signal, high ceremony

**Evidence**: ~550 of 789 untyped identifiers were in test files, mostly `JSON.parse()` results. Fixing them adds tokens without adding information - AI infers response shape from assertions anyway.

**Rule**: Exclude test files from type-coverage metric. Trust TypeScript inference for test utilities. Focus type quality efforts on production code.

## When to Update This Guide

### Collecting Friction Reports

When AI struggles with a task, ask: "What specific friction did you encounter?"

Only act on friction if:
1. Friction was in code quality (not documentation)
2. Fix improves patterns/types/consistency
3. AI confirms the fix would have helped (score >= 7/10)

### Adding New Insights

New entries in "AI-Centric Principles" should:
- Be validated through actual AI interaction (not theoretical)
- Include concrete evidence (metrics, examples)
- Follow the Myth/Reality/Rule format

## Quality Checks (Reference)

These checks maintain AI-friendliness - enforced automatically via CI:
```bash
pnpm type-coverage  # 98%+ (production code only, tests excluded)
pnpm lint           # Consistent patterns
pnpm test           # Working examples
```
