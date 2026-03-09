# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See [AGENTS.md](./AGENTS.md) for the full project context, commands, architecture, and conventions shared across all AI agents.

## Claude Code-Specific

### Proactive Skills

When the user asks to add or modify a feature, **proactively invoke the `create-spec` skill** (`.agents/skills/create-spec/`) via the Skill tool before writing any code. Do not wait to be asked. The skill handles requirements gathering, clarification, drafting, and scoring — the spec is the deliverable before implementation begins.

When the user asks to write an ADR or document an architecture decision, **proactively invoke the `adr-writer` skill** (`.agents/skills/adr-writer/`) via the Skill tool. Do not write ADRs manually. The skill handles context gathering, structure, AI-friendliness scoring, and correct filename format (`YYYY-MM-DD-HH-MM-<slug>.md`).
