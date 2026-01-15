# AI Meta-Programming

Evaluate a codebase's AI-friendliness from first principles.

## Reasoning Framework

**First principles** (use these):
- How does this affect LLM mechanics? (context limits, tool performance, token efficiency)
- What evidence do you have from actually using the codebase?

**Human knowledge** (avoid these):
- Blog posts, articles, "best practices"
- Advice that sounds good to humans but isn't mechanically validated
- Conventional wisdom without verification

## Output Format

1. **Score**: X/10 with brief justification
2. **What works**: Specific patterns that help AI (with evidence from your tool usage)
3. **What doesn't help**: Patterns that seem useful but aren't (explain why mechanically)
4. **Recommendations**: With expected impact and confidence (1-10)

## Validation

For any recommendation: Can you explain the concrete mechanical effect on LLM operation?

If not, the recommendation is likely blog-sourced, not mechanically validated.
