# ADR AI-Friendliness Scoring Rubric

Score each dimension 0.0–1.0. Total: 10.0. Target: >9.5.

---

## 1. Structured Parseability (0.0–1.0)

Can an LLM extract sections programmatically from the document structure?

| Score | Criteria |
|-------|----------|
| 1.0 | Consistent heading hierarchy. Every section uses the template headings. Status/date in bold key-value format. No ambiguous nesting. |
| 0.7 | Minor deviations — extra or renamed sections, but structure is clear. |
| 0.4 | Inconsistent headings, mixed formats, prose-heavy sections without clear boundaries. |
| 0.0 | Free-form text, no headings, or headings that don't reflect content. |

**Check**: Could `grep -E '^#{1,3} '` extract a useful table of contents?

---

## 2. Self-Contained Context (0.0–1.0)

Can an LLM understand the decision from this document alone, without reading other files?

| Score | Criteria |
|-------|----------|
| 1.0 | All necessary context is inline. References to other files are supplementary, not required. Current state is described concretely (not "see X for details"). |
| 0.7 | One or two references to external files that are important but not blocking. |
| 0.4 | Key information requires reading 2+ other files to understand the decision. |
| 0.0 | Document is mostly pointers to other files. |

**Check**: If this were the only file in context, would an LLM make the right implementation choices?

---

## 3. Concrete Over Abstract (0.0–1.0)

Does the ADR show rather than tell?

| Score | Criteria |
|-------|----------|
| 1.0 | Code examples for every pattern change. File trees for structural changes. Schema definitions for data changes. Before/after comparisons where relevant. |
| 0.7 | Most decisions have examples, but 1-2 are described only in prose. |
| 0.4 | Mostly prose with occasional code snippets. |
| 0.0 | Entirely abstract descriptions. No code, no schemas, no file trees. |

**Check**: Count code blocks. An ADR proposing code changes should have ≥3 code blocks.

---

## 4. Explicit Trade-offs (0.0–1.0)

Are alternatives presented with honest, specific comparisons?

| Score | Criteria |
|-------|----------|
| 1.0 | ≥2 alternatives. Each has: concrete description, specific technical reasons for rejection, AI-friendliness sub-score with rationale. Recommended option's weaknesses are acknowledged. |
| 0.7 | Alternatives listed with reasons, but some reasons are vague ("too complex"). |
| 0.4 | Alternatives mentioned but not substantively compared. |
| 0.0 | No alternatives. Decision presented as the only possibility. |

**Check**: Would an LLM asked "why not Option B?" find the answer in this document?

---

## 5. Terminology Consistency (0.0–1.0)

Is the same concept always called the same thing?

| Score | Criteria |
|-------|----------|
| 1.0 | One term per concept, matching codebase naming. No synonyms. Domain terms match what appears in actual code. |
| 0.7 | Mostly consistent, 1-2 slips (e.g., "endpoint" vs "route" used interchangeably). |
| 0.4 | Frequent synonym switching. Reader must infer that different terms mean the same thing. |
| 0.0 | Chaotic — same concept has 3+ names, or terms conflict with codebase usage. |

**Check**: Search for the 3 most important domain terms. Are they used identically every time?

---

## 6. Actionable Consequences (0.0–1.0)

Can an LLM derive implementation tasks from the consequences and migration sections?

| Score | Criteria |
|-------|----------|
| 1.0 | Migration path has numbered steps. Each step is independently testable. Consequences map to specific files/modules. Negative consequences include mitigation. |
| 0.7 | Migration steps exist but some are vague ("update the frontend"). |
| 0.4 | Consequences listed but no migration path, or migration is hand-wavy. |
| 0.0 | No migration path. Consequences are abstract ("improves maintainability"). |

**Check**: Could an LLM create a PR checklist from the migration section?

---

## 7. Searchability (0.0–1.0)

Will an LLM's semantic search find this ADR when relevant?

| Score | Criteria |
|-------|----------|
| 1.0 | Title is descriptive (not "ADR-005"). Key technical terms appear in the first 2 paragraphs. Module names, package names, and technology names are mentioned explicitly. |
| 0.7 | Searchable but some key terms only appear deep in the document. |
| 0.4 | Generic title or context section. Key terms buried or absent. |
| 0.0 | Title is a number/code. Context is vague. An LLM searching for the topic would miss this file. |

**Check**: What 3 queries would an LLM use to find this? Do they match text in the first 200 words?

---

## 8. Unambiguous Language (0.0–1.0)

Is every statement precise enough for an LLM to act on?

| Score | Criteria |
|-------|----------|
| 1.0 | RFC 2119 keywords (SHALL, SHOULD, MAY) for requirements. No hedging without fallback ("might" is ok if followed by "if X, then Y"). Quantities are specific, not "some" or "a few". |
| 0.7 | Mostly precise, 1-2 vague statements. |
| 0.4 | Frequent hedging. LLM would need to guess intent for several decisions. |
| 0.0 | Pervasively vague. "We could", "it might", "probably should" without resolution. |

**Check**: Search for "might", "could", "maybe", "probably", "some". Each needs a concrete resolution nearby.

---

## 9. Token Efficiency (0.0–1.0)

Is every sentence earning its place in an LLM's context window?

| Score | Criteria |
|-------|----------|
| 1.0 | No filler paragraphs. No restating the same idea in different words. Code examples are minimal but complete. No "as mentioned above" back-references. |
| 0.7 | Mostly dense, 1-2 paragraphs could be tightened. |
| 0.4 | Noticeable bloat — intro paragraphs that repeat the title, verbose explanations of simple concepts. |
| 0.0 | Document is 2x longer than it needs to be. Significant redundancy. |

**Check**: Try removing every paragraph that doesn't add new information. Did you remove >20% of the content?

---

## 10. Import-Chain Traceability (0.0–1.0)

Can an LLM follow the decision's impact through the codebase via imports?

| Score | Criteria |
|-------|----------|
| 1.0 | Shows actual import statements. File paths map to real or proposed locations. An LLM could `grep` for the imports to find all affected code. Consumer usage examples show the full import → usage chain. |
| 0.7 | File paths shown but import statements omitted, or vice versa. |
| 0.4 | Mentions module names but not file paths or imports. |
| 0.0 | No file paths, no imports, no indication of where code lives. |

**Check**: Could an LLM build a dependency graph from the code examples in this ADR?

---

## Score Sheet Template

Copy this when scoring:

```
AI-Friendliness Score: X.X/10.0

 1. Structured parseability:    X.X — [rationale]
 2. Self-contained context:     X.X — [rationale]
 3. Concrete over abstract:     X.X — [rationale]
 4. Actionable consequences:    X.X — [rationale]
 5. Terminology consistency:    X.X — [rationale]
 6. Explicit trade-offs:        X.X — [rationale]
 7. Searchability:              X.X — [rationale]
 8. Unambiguous language:        X.X — [rationale]
 9. Token efficiency:           X.X — [rationale]
10. Import-chain traceability:  X.X — [rationale]
```
