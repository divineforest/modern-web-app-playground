# AI-Friendliness Assessment

**Score: 9.2/10** - Exceptional. No major improvements needed.

## What Works (Keep Doing)

- **97% type coverage** - Enforced via `pnpm type-coverage`
- **Consistent patterns** - Same structure across all modules
- **Machine-enforced conventions** - Pre-commit hooks catch issues
- **Working code examples** - 5 modules to learn from

## What Doesn't Help AI (Don't Add)

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

**Reality**: AI infers intent from types and patterns. 97% type coverage provides:
- Precise function signatures AI can rely on
- Compile-time validation of AI suggestions
- Self-documenting code through explicit types

**Rule**: Invest in type coverage before writing explanatory docs.

## Practical Actions

### If AI struggles with a task

Ask: "What specific friction did you encounter?"

Only fix if:
1. Friction was in code quality (not documentation)
2. Fix improves patterns/types/consistency
3. AI confirms the fix would have helped

### Maintenance

Run these checks - they're what actually helps AI:
```bash
pnpm type-coverage  # Keep at 97%+
pnpm lint           # Consistent patterns
pnpm test           # Working examples
```
