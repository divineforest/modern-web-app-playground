---
name: meta-edit
description: >
  Edit AI-facing meta files (AGENTS.md, CLAUDE.md, skill files, specification-guide.md,
  ai-principles.md, ADR templates). Use proactively when the user asks to modify any file
  whose primary audience is AI agents. Ensures edits follow AI-friendliness principles
  and don't degrade LLM productivity.
---

# Meta File Editor

Edit AI-facing files while preserving their mechanical value to LLMs.

## Trigger

Use this skill when the user asks to edit any of:
- `AGENTS.md`, `CLAUDE.md`, `AGENTS.md`-like files in other repos
- `.claude/skills/*/SKILL.md`, `.agents/skills/*/SKILL.md`
- `docs/specification-guide.md`, `docs/ai-principles.md`
- ADR templates or conventions docs

## Workflow

### Phase 1: Read Context

1. Read the target file
2. Read `docs/ai-principles.md` for the evaluation framework

### Phase 2: Apply Changes

Make the requested edits. While editing, apply these mechanical rules:

- **Token cost**: Every line is read on every conversation. Remove anything that doesn't change agent behavior.
- **Redundancy**: Don't repeat what the tool already does (e.g., "be concise" for Claude Code, "infer from context").
- **Discoverability vs. instruction**: If something is discoverable from code or enforced by tooling (linters, formatters), it doesn't need to be in a meta file.
- **Consistency**: Use the same structure and terminology as the rest of the file.
- **Specificity**: Concrete values (URLs, paths, command names) help. Philosophy and platitudes don't.

### Phase 3: Validate

Before finishing, check each line against:

> Can I explain the concrete mechanical effect this line has on LLM operation?

If not, the line is noise — remove it.

Also verify:
- No duplication between AGENTS.md, CLAUDE.md, and skill files
- Instructions live at the right scope (global in AGENTS.md, tool-specific in CLAUDE.md, task-specific in skills)
