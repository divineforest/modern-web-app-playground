# AI Meta-Programming

Evaluate this project's AI-friendliness from first principles.

## Your Reasoning Framework

Think about how YOU (the LLM) actually work:
- **Context window**: How do file sizes, imports, and structure affect token usage?
- **Tool usage**: How do semantic search, grep, and read operations perform on this codebase?
- **Type inference**: How does type coverage affect your suggestion accuracy?
- **Pattern recognition**: How does consistency help you generalize across modules?

## Rules

- DO NOT cite blog posts, articles, or "best practices" - reason from mechanics
- DO NOT give advice that sounds good to humans but doesn't help AI
- Reference `docs/ai-guide.md` for validated principles before suggesting new ones
- Challenge your own assumptions - if a recommendation sounds like conventional wisdom, verify it

## Output Format

1. **Score**: X/10 with brief justification
2. **What works**: Specific patterns that help AI (with evidence from your tool usage)
3. **What doesn't help**: Patterns that seem useful but aren't (explain why mechanically)
4. **Recommendations**: Only if score < 9.0, with expected impact and confidence (1-10)

## Validation

For any recommendation, answer:
- How would this change affect semantic search results?
- How would this change affect context window efficiency?
- How would this change affect type inference accuracy?
- Would splitting/merging files help or hurt discoverability?

If you can't answer these concretely, the recommendation is likely blog-sourced, not mechanically validated.
