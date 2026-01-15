# AI Evaluate

Evaluate the entire project's AI-friendliness from first principles.

**Principles**: See `docs/ai-principles.md`.

## Instructions

Perform a systematic evaluation of the codebase:

1. **Explore the codebase** - Use tools to understand structure, patterns, conventions
2. **Check for known issues** from `docs/ai-principles.md` (inconsistencies, implicit deps, scattered code)
3. **Note friction** you actually experience while exploring

## Output Format

1. **Score**: X/10 with brief justification
2. **What works**: Specific patterns that help AI (with evidence from your tool usage)
3. **What doesn't help**: Patterns that seem useful but aren't (explain why mechanically)
4. **Recommendations**: Concrete improvements with:
   - Expected impact on LLM mechanics
   - Confidence: 1-10 that this actually helps AI

## Quality Bar

- Only include findings based on actual evidence from tool usage
- Each recommendation must pass the validation rule from `docs/ai-principles.md`
- Prefer fewer high-confidence recommendations over many speculative ones
