# 🧭 Meta Technical Specification Framework

## Purpose

This document defines the framework, structure, and conventions for writing technical specifications in this organization.
It acts as a meta-specification — a shared guide that ensures every spec is consistent, complete, and easily interpreted by humans **and** AI tools such as Cursor.

---

## Audience

**Writers:** Engineers, architects, and product managers creating specifications
**Readers:** Developers implementing features, reviewers validating designs, QA engineers, AI assistants, and future maintainers

---

## For AI Assistants: Implementation Context

**When implementing features from specifications:**

1. **Tech Stack & Patterns**: Consult `architecture.md` and `AGENTS.md` for:
   - Standard tech stack (Fastify, ts-rest, Drizzle ORM, Zod, Temporal, etc.)
   - Architectural patterns (modular structure, layers, conventions)
   - Code style and formatting rules
   - Database conventions and schema patterns

2. **Feature Requirements**: Individual specs in `docs/specs/` define:
   - Business requirements (what the feature does)
   - Feature-specific technical constraints
   - Data models and API contracts
   - Feature-specific error handling

3. **Implementation Approach**: Combine both sources:
   - Use standard patterns from `architecture.md`
   - Apply feature requirements from the spec
   - Follow conventions defined in `AGENTS.md`

**Key Principle:** Specs describe **what** and **why**. Architecture docs describe **how** and **with what tools**.

---

## Quick Reference (TL;DR)

Every specification must include the following core sections:

- Title
- Overview
- Goals and Non-Goals
- Functional Requirements (FR-X)
- Technical Requirements (TR-X)
- Data Flow
- Risks and Mitigations
- Testing and Validation
- Review and Version Control

Optional sections may include Security, Monitoring, API details, Performance, Configuration, or Future Enhancements.

---

## When to Write a Specification

Write a specification when:

- Building a new feature or integration with multiple components
- Implementing a third-party API or webhook
- Making architectural or schema changes that affect multiple modules
- Creating new workflows or introducing compliance, performance, or security-critical features

You may skip a specification for trivial bug fixes, cosmetic UI changes, or internal refactors that do not affect behavior.
For emergency hotfixes, document retrospectively.

---

## Creating vs. Updating Specifications

### Creating a New Specification

1. Copy the template from the bottom of this guide
2. Fill in all required sections (Title, Overview, Goals, FR-X, TR-X, Data Flow, Risks, Testing)
3. Use 🚧 for planned but not yet designed features
4. Get peer review before formal approval

### Updating an Existing Specification

- **During implementation:** Update requirements that change, add clarifications
- **After implementation:** Remove 🚧 markers, update examples to match reality
- **When requirements change:** Document what changed and why, obtain re-approval if significant
- **Maintenance:** Update specs in the same PR as code changes; treat as living documentation

---

## Document Structure

### 1. Title

Use a descriptive feature name as the H1 heading.
Example: `# Billing - Chargebee Migration`

---

### 2. Overview

Write two to four paragraphs explaining:

- What the feature does
- Why it is needed
- Who benefits
- How it fits into the larger system

Keep it concise and contextual.

---

### 3. Goals and Non-Goals

**Goals** describe what success looks like and measurable outcomes.
**Non-Goals** describe explicitly what is out of scope to prevent feature creep.

---

### 4. Functional Requirements (FR-X)

Describe what the system does from the user or business perspective.
Use numbered sections and RFC 2119 language.

Example:

```markdown
### FR-1: Contact Retrieval

- The system SHALL fetch contacts from the external ERP system using its REST API.
- The system SHALL retrieve all active contacts.
- The system SHALL handle pagination for large datasets.
```

---

### 5. Technical Requirements (TR-X)

Describe how the system will be built — architecture, design, and constraints.
Include diagrams, schema changes, dependencies, configuration, and error handling.

**DO NOT include standard tech stack details** that are already defined in `architecture.md` and `AGENTS.md`.

**Examples of what NOT to include:**
- ❌ "The system SHALL use Fastify for HTTP handling"
- ❌ "The system SHALL use ts-rest for API contracts"
- ❌ "The system SHALL use Zod for validation"
- ❌ "The system SHALL use Drizzle ORM for database operations"
- ❌ "The system SHALL follow modular architecture"
- ❌ Implementation file paths: `Implementation: apps/backend/src/modules/foo/bar.ts`
- ❌ Function/class names: `(archiveInboundEmailPayload)`

**Why no implementation references?** Specs define requirements, not code locations. Implementation paths create maintenance burden (specs become stale when code moves) and blur the line between "what to build" and "what was built." Let the code be discoverable through search and architecture docs.

**Examples of what TO include:**
- ✅ Feature-specific architectural decisions (e.g., webhook processing flow)
- ✅ Database schema changes specific to this feature
- ✅ Integration points with external systems
- ✅ Feature-specific error handling strategies
- ✅ Performance requirements unique to this feature

**Rationale:** The project's tech stack is defined once in `architecture.md`. Repeating it in every spec creates maintenance burden. AI assistants and developers should consult `architecture.md` and `AGENTS.md` for implementation patterns.

Example:

```markdown
### TR-1: Authentication

- The system SHALL authenticate using API key authentication.
- The system SHALL manage sessions securely.

### TR-2: Database Schema

- The system SHALL add a `contacts` table with fields: id, name, email, external_id.
- The system SHALL create an index on external_id for efficient lookups.
```

---

### 6. Data Flow

Explain the step-by-step process and lifecycle of the feature.
List all components and actors.

Example:

```markdown
## Data Flow

### Webhook Reception and Workflow Processing

1. Stripe processes a payment event.
2. Stripe sends webhook notification.
3. **Webhook Handler** validates payload and authenticity.
4. **Handler** starts a Temporal workflow and returns HTTP 200.
5. **Workflow** executes activities: parse, update order status, notify.
6. Temporal retries failed activities automatically.
```

Best practices:

- Use bold for system components and actors
- Include both success and failure paths
- Reference FR/TR identifiers where relevant

---

### 7. Security Considerations

When applicable, describe:

- Authentication and authorization
- Encryption at rest and in transit
- Input validation and sanitization
- Rate limiting or DDoS protection
- Secret management
- Vulnerability scanning or compliance requirements

---

### 8. Monitoring and Observability

Define how the feature will be monitored in production.

Include:

- Metrics (latency, throughput, error rates)
- Logging requirements (what, when, level)
- Alert conditions (thresholds, escalation path)
- Dashboards or reports needed

Example:

```markdown
## Monitoring and Observability

- 🚧 Track webhook success rate.
- Log all failed webhook payloads with request ID.
- 🚧 Alert if more than 2 percent failures occur in 10 minutes.
```

---

### 9. Error Scenarios

Document expected error cases and handling behavior.

Example:

```markdown
### Error Scenarios

- Invalid input → HTTP 400 Bad Request
- Authentication failure → HTTP 401 or 403
- Rate limiting → HTTP 429 with retry-after
- External service unavailable → HTTP 503 with exponential backoff
```

---

### 10. Testing and Validation

Every specification must describe how correctness will be verified.

Include:

- Unit, integration, and end-to-end test coverage expectations
- Mocking or stubbing strategy for external systems
- Manual QA or acceptance test cases
- Observability signals that confirm success
- Rollback or feature-flag validation strategy

---

### 11. Risks and Mitigations

List known risks, their potential impact, and mitigation or rollback plans.
Keep this section short and focused.

Example:

```markdown
## Risks and Mitigations

- External API downtime → Add retry logic and dead-letter queue.
- Migration failure → Perform database backup before deploy.
- Token scope misconfiguration → Validate credentials in staging.
```

---

### 12. Optional and Extended Sections

Add these when relevant:

- API integration details (endpoints, request and response examples)
- Performance requirements (latency, throughput, scalability)
- Database changes (schemas, indexes, migrations)
- Deployment strategy (rollout, feature flags, rollback)
- Future enhancements or roadmap notes
- Local testing examples (curl requests, environment setup)

---

### 13. Requirement Language

Use **RFC 2119** keywords for precision:

- MUST or SHALL → mandatory
- MUST NOT or SHALL NOT → prohibited
- SHOULD → recommended
- SHOULD NOT → discouraged
- MAY or CAN → optional

Good example:

> The system SHALL validate webhook authenticity using IP whitelisting.

Bad example:

> The system will validate webhooks.

---

### 14. Writing Style

Specifications are human-readable documents, not code. Use natural language instead of code-level naming conventions.

**Naming:**

- ✅ "invoice number", "issue date", "total amount"
- ❌ "invoiceNumber", "issueDate", "totalAmount"
- ✅ "billing inbound token", "company ID"
- ❌ "billingInboundToken", "companyId"

**Rationale:** Specifications describe business requirements for a broad audience — product managers, QA engineers, and future maintainers. Code-level naming creates unnecessary coupling to implementation details and reduces readability.

---

### 15. Status Indicators

Use emoji to mark implementation state:

- 🚧 planned or not yet implemented
- (no icon) ready or implemented
- ✅ explicitly completed

Example:

```markdown
- The system SHALL process webhook requests within timeout.
- 🚧 The system SHALL implement dead-letter queue for failed messages.
- The system SHALL log all processing errors.
```

---

### 16. Review and Approval Process

1. Draft — author writes the initial version.
2. Technical Review — peers and architect validate feasibility.
3. Stakeholder Review — product or business validates alignment.
4. Approval — marked ready for implementation.
5. Implementation — update spec as changes occur.
6. Post-Implementation — remove 🚧 markers and document final behavior.

---

### 17. Version Control

- Store specifications in `docs/specs/` or a dedicated folder.
- Use descriptive filenames such as `billing-chargebee-migration.md`.
- Reference the specification in related pull requests.
- Keep specifications up to date with actual behavior.
- Treat specifications as versioned documentation reviewed like code.

---

## Specification Template

Copy this block when creating a new specification:

```markdown
# [Feature Name]

## Overview

Describe what the feature does, why it exists, and who benefits.

## Goals and Non-Goals

- Goal: …
- Non-Goal: …

## Functional Requirements

### FR-1: [Title]

- The system SHALL …
- 🚧 The system SHALL …

## Technical Requirements

### TR-1: [Title]

- The system SHALL …
- The system SHOULD …

**Note:** Focus on feature-specific architecture. Standard tech stack (Fastify, ts-rest, Drizzle, etc.) is defined in `architecture.md` — do not repeat it here.

## Data Flow

### [Process Name]

1. **Actor** initiates.
2. **System Component** processes.
3. **External Service** responds.
4. **System Component** stores result.

## Security Considerations

Describe relevant security aspects.

## Monitoring and Observability

Describe metrics, logs, and alerts.

## Error Scenarios

List expected errors and responses.

## Testing and Validation

Describe tests, QA steps, and verification.

## Risks and Mitigations

Describe known risks and mitigation strategies.
```

---

## Best Practices Checklist

Before finalizing a specification:

- Title and overview are clear
- Goals and non-goals are defined
- All requirements use SHALL / SHOULD / MAY language
- Requirements are numbered (FR-X, TR-X, NFR-X)
- Technical requirements focus on feature-specific architecture (no generic tech stack repetition)
- Data flow is complete and step-by-step
- Security considerations are addressed
- Monitoring and error handling are defined
- Testing and validation are included
- Risks and mitigations are documented
- 🚧 markers are used for deferred work
