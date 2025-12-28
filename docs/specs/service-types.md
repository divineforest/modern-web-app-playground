# Service Types

## Overview

Service Types is an internal reference table that categorizes the different types of accounting and financial services offered. This table provides a controlled vocabulary for service classification and will be referenced by jobs to indicate what type of service work is being performed. The table is designed as a foundational data structure with no direct API exposure, serving as a lookup table for other features in the system.

Service types enable consistent categorization across the platform and support future reporting, filtering, and business logic based on service categories. Examples include payroll processing, accounting services, VAT returns, tax preparation, and other specialized financial services.

## Goals and Non-Goals

### Goals

- Provide a stable, versioned reference table for service type classification
- Support referential integrity for jobs and other features requiring service categorization
- Enable status tracking for service types (active vs deprecated)
- Allow for clear service type identification through human-readable codes and names
- Establish a foundation for service-based business logic and reporting

### Non-Goals

- No public or internal API endpoints (pure data model)
- No direct CRUD operations exposed to services (managed through migrations/seeds)
- No complex business logic or validation rules
- No hierarchical or nested service type structures (flat structure only)
- No service type versioning or historical tracking (status field only)

## Functional Requirements

### FR-1: Service Type Definition

- The system SHALL store service type records with unique identifiers
- The system SHALL enforce unique service type codes
- The system SHALL maintain service type names and optional descriptions
- The system SHALL track service type status (active or deprecated)
- The system SHALL record creation and modification timestamps

### FR-2: Service Type Status Management

- The system SHALL support two status values: "active" and "deprecated"
- The system SHALL default new service types to "active" status
- The system SHALL allow service types to be marked as deprecated without deletion
- The system SHALL maintain referential integrity when service types are deprecated

### FR-3: Service Type Codes

- The system SHALL enforce uppercase format for service type codes
- The system SHALL use semantic, business-meaningful codes (e.g., PAYROLL, VAT, ACCOUNTING)
- The system SHALL treat codes as immutable identifiers
- The system SHALL validate code uniqueness at the database level

### FR-4: Reference Support

- The system SHALL allow other tables to reference service types via foreign key
- The system SHALL support nullable foreign keys for optional service type associations
- 🚧 The system SHALL prevent deletion of service types that are in active use
- The system SHOULD provide meaningful error messages for referential integrity violations

## Technical Requirements

### TR-1: Database Schema

- The system SHALL store service types in a `service_types` table
- The system SHALL use UUID for primary key (id)
- The system SHALL enforce unique constraint on code field
- The system SHALL set default value for status to "active"
- The system SHALL use `TIMESTAMPTZ` for timestamp fields
- The system SHALL create appropriate indexes for foreign key lookups

### TR-2: Data Model Location

- The system SHALL define the schema in `src/db/schema.ts`
- The system SHALL follow Drizzle ORM conventions for table definitions
- The system SHALL export the table definition for use in queries and relations
- The system SHALL include schema in database migration files

### TR-3: Type Safety

- The system SHALL define TypeScript types for service type entities
- The system SHALL use Zod schemas for runtime validation where needed
- The system SHALL ensure type safety for foreign key references
- The system SHALL define status as a string literal type union

### TR-4: Database Migrations

- The system SHALL create a migration file for the service_types table
- The system SHALL include appropriate indexes in the migration
- 🚧 The system SHOULD include seed data for initial service types
- The system SHALL ensure migration is idempotent and reversible

### TR-5: Referential Integrity

- The system SHALL use foreign key constraints for references to service_types
- The system SHALL use `ON DELETE RESTRICT` to prevent deletion of referenced types
- The system SHALL allow NULL foreign keys for optional associations
- The system SHALL use `ON UPDATE CASCADE` for primary key updates

## Data Model

### Service Type Entity

```typescript
{
  id: string; // UUID, primary key
  code: string; // Unique service code (uppercase, e.g., "PAYROLL", "VAT", "ACCOUNTING")
  name: string; // Service type name (required, e.g., "Payroll Processing")
  description: string | null; // Optional detailed description
  status: "active" | "deprecated"; // Service type status, default "active"
  createdAt: Date; // Creation timestamp with timezone
  updatedAt: Date; // Last update timestamp with timezone
}
```

### Example Service Types

```typescript
// Example seed data
[
  {
    code: "PAYROLL",
    name: "Payroll Processing",
    description: "Employee payroll calculation and processing services",
    status: "active"
  },
  {
    code: "ACCOUNTING",
    name: "Accounting Services",
    description: "General accounting and bookkeeping services",
    status: "active"
  },
  {
    code: "VAT",
    name: "VAT Returns",
    description: "Value Added Tax calculation and filing services",
    status: "active"
  },
  {
    code: "TAX_PREP",
    name: "Tax Preparation",
    description: "Income tax preparation and filing services",
    status: "active"
  },
  {
    code: "AUDIT",
    name: "Audit Services",
    description: "Financial audit and compliance review services",
    status: "active"
  }
]
```

## Database Schema

### Table Definition

```sql
CREATE TABLE service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_types_code_check CHECK (code ~ '^[A-Z_]+$'),
  CONSTRAINT service_types_status_check CHECK (status IN ('active', 'deprecated'))
);

-- Index for filtering by status
CREATE INDEX idx_service_types_status ON service_types(status);

-- Index for code lookups (unique constraint creates this automatically)
-- CREATE UNIQUE INDEX idx_service_types_code ON service_types(code);
```

### Foreign Key Usage Example

```sql
-- Example: jobs table references service_types
CREATE TABLE jobs (
  id UUID PRIMARY KEY,
  service_type_id UUID REFERENCES service_types(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  -- other job fields...
);

-- Index for foreign key lookups
CREATE INDEX idx_jobs_service_type_id ON jobs(service_type_id);
```

## Integration with Jobs Module

### Job Template Relationship

The jobs module will reference service types to categorize job templates:

```typescript
// Example: job-template.entity.ts
{
  id: string;
  serviceTypeId: string | null; // References service_types.id
  code: string;
  name: string;
  // ...other fields
}
```

### Query Examples

```typescript
// Drizzle ORM query examples

// Get all active service types
const activeServiceTypes = await db
  .select()
  .from(serviceTypes)
  .where(eq(serviceTypes.status, 'active'));

// Get job templates by service type
const jobTemplates = await db
  .select()
  .from(jobTemplates)
  .where(eq(jobTemplates.serviceTypeId, serviceTypeId));

// Get jobs with service type details (join)
const jobsWithServiceTypes = await db
  .select()
  .from(jobs)
  .leftJoin(serviceTypes, eq(jobs.serviceTypeId, serviceTypes.id));
```

## Data Flow

### Service Type Lifecycle

1. **Initial Setup** (Migration)
   - Migration creates `service_types` table with schema and constraints
   - Migration applies indexes for performance
   - Seed data populates initial service types (PAYROLL, ACCOUNTING, VAT, etc.)

2. **Service Type Assignment** (Job Creation)
   - **Job Service** creates a new job or job template
   - **Service** provides service type ID as part of job data
   - **Database** validates foreign key constraint
   - **Database** stores job record with service type reference

3. **Service Type Status Change** (Administrative)
   - **Admin** marks service type as deprecated via direct database update
   - **Database** updates status field and timestamp
   - **System** continues to honor existing references (no cascade delete)

4. **Service Type Queries** (Reporting)
   - **Reporting System** joins jobs with service types
   - **Database** returns combined data using foreign key relationship
   - **Reporting System** filters/groups by service type attributes

## Security Considerations

- The system SHALL NOT expose service types through public APIs

## Monitoring and Observability

Since this is a pure data model without API endpoints, monitoring is not needed.

## Error Scenarios

### Database Level Errors

- **Duplicate code insertion** → Database returns unique constraint violation
- **Invalid status value** → Database returns check constraint violation
- **Invalid code format** → Database returns check constraint violation
- **NULL required field** → Database returns NOT NULL constraint violation

### Foreign Key Errors

- **Invalid service type ID on job creation** → Database returns foreign key violation
- **Attempt to delete referenced service type** → Database returns foreign key violation (RESTRICT)
- **NULL service type ID** → Allowed (optional association)

## Risks and Mitigations

### Risk: Service Type Proliferation

- **Risk:** Uncontrolled growth of service types leading to confusion
- **Mitigation:** Manage service types through migrations only, require review for new types
- **Mitigation:** Use deprecated status instead of creating similar/duplicate types

### Risk: Breaking Changes to Codes

- **Risk:** Changing service type codes breaks existing references
- **Mitigation:** Treat codes as immutable; use migrations to add new types instead
- **Mitigation:** Use deprecation status for obsolete types rather than deletion

### Risk: Missing Foreign Key Indexes

- **Risk:** Poor query performance on jobs filtering by service type
- **Mitigation:** Include foreign key indexes in migration
- **Mitigation:** Monitor query performance and add indexes as needed

### Risk: Premature Deletion

- **Risk:** Attempting to delete service types still in use
- **Mitigation:** Use ON DELETE RESTRICT constraint
- **Mitigation:** 🚧 Implement application-level checks before deletion

## Module Structure

Since this is a data-only feature, structure is minimal:

```
src/db/
├── schema.ts           # Service types table definition
├── migrations/
│   └── XXXX_create_service_types.sql  # Migration file
└── seeds/                    # 🚧 Optional seed data
    └── service_types.sql     # 🚧 Initial service types

src/modules/practice-management/
└── domain/
    └── job-template.types.ts # References service_type_id
```

## Future Enhancements

- 🚧 Service type usage analytics and reporting
- 🚧 Historical tracking of service type changes

## Dependencies

### Internal

- Database connection (`src/db/connection.ts`)
- Database schema definitions (`src/db/schema.ts`)
- Migration system (Drizzle Kit)

### External

- PostgreSQL database (version 14+)
- Drizzle ORM for schema definitions
- Drizzle Kit for migrations

## Success Criteria

- Service types table created with correct schema
- All constraints (unique, check, foreign key) enforced at database level
- Jobs module can reference service types via foreign key
- NULL service type associations are supported
- Attempt to delete referenced service types is prevented
- Schema tests validate all constraints and defaults
- Migration is reversible and idempotent
