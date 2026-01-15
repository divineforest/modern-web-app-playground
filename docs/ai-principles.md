# AI-Friendliness Principles

Shared reasoning framework for evaluating code from an LLM's perspective.

## First Principles (use these)

- How does this affect LLM mechanics? (context limits, tool performance, token efficiency)
- What evidence do you have from actually using the codebase?

## Human Knowledge (avoid these)

- Blog posts, articles, "best practices"
- Advice that sounds good to humans but isn't mechanically validated
- Conventional wisdom without verification

## Known AI-Unfriendly Patterns

1. **Code inconsistencies** - Same concept implemented differently across the codebase. Inconsistencies force AI to learn multiple approaches instead of one.
2. **Implicit dependencies** - Magic that requires reading multiple files to understand context.
3. **Scattered related code** - Related logic spread across many small files vs. co-located.

## Validation Rule

For any recommendation: Can you explain the concrete mechanical effect on LLM operation?

If not, the recommendation is likely blog-sourced, not mechanically validated.
