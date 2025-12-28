# Jobs

## Overview

This feature provides basic CRUD operations for managing jobs within the accounting system. Jobs represent individual work items that need to be completed for a specific company, typically based on job templates. The feature is exposed as an internal API for use by other microservices and internal tools.

## Functional Requirements

### FR-1: Create Job

- The system SHALL accept job creation requests via internal API
- The system SHALL validate required fields (companyId, serviceTypeId, title) before creating a job
- The system SHALL validate that referenced companyId exists
- The system SHALL validate status field against allowed values (planned, in_progress, completed, canceled)
- The system SHALL set default status to "planned" if not provided
- The system SHALL generate a unique identifier for each job
- The system SHALL store jobs with timestamps (createdAt, updatedAt)
- The system SHALL return the created job including generated fields

### FR-2: Read Job

- The system SHALL retrieve a single job by its unique identifier
- The system SHALL return complete job data including all fields
- The system SHALL return appropriate error when job is not found

### FR-3: Update Job

- The system SHALL accept partial updates to existing jobs
- The system SHALL validate updated fields before persisting changes
- The system SHALL update the updatedAt timestamp on successful update
- The system SHALL preserve fields not included in the update request
- The system SHALL automatically set completedAt timestamp when status changes to "completed"
- The system SHALL return the updated job with all current values
- The system SHALL return appropriate error when job is not found

### FR-4: Delete Job

- The system SHALL delete jobs permanently from the database
- The system SHALL return success response after successful deletion
- The system SHALL return appropriate error when job is not found
- The system SHALL cascade delete related data as defined by foreign key constraints

### FR-5: List Jobs

- The system SHALL retrieve multiple jobs
- The system SHALL support filtering by:
  - companyId (exact match)
  - status (exact match)
  - assigneeId (exact match)
  - dueAt range (date range filtering)
- The system SHALL return jobs ordered by creation date (newest first)
- The system SHALL support pagination for large result sets (future enhancement)

## Data Model

### Job Entity

```typescript
{
  id: string; // UUID, primary key
  createdAt: Date; // Creation timestamp
  updatedAt: Date; // Last update timestamp
  companyId: string; // UUID, foreign key to companies table (required)
  serviceTypeId: string; // UUID, reference to service type (required)
  title: string; // Job title (required)
  status: "planned" | "in_progress" | "completed" | "canceled"; // Job status, default "planned"
  dueAt: Date | null; // Optional due date with timezone
  completedAt: Date | null; // Completion timestamp with timezone (auto-set when status becomes "completed")
  assigneeId: string | null; // UUID of assigned user
  periodStart: Date | null; // Start date of the period this job covers
  periodEnd: Date | null; // End date of the period this job covers
}
```

## Technical Requirements

### TR-1: Database Schema

- The system SHALL store jobs in a `jobs` table
- The system SHALL use UUID for primary key (id)
- The system SHALL enforce foreign key constraint on companyId with CASCADE delete
- The system SHALL enforce NOT NULL constraint on companyId, serviceTypeId, title, and status
- The system SHALL set default value for status to "planned"
- The system SHALL use timestamps with timezone for dueAt and completedAt fields
- The system SHALL use date type for periodStart and periodEnd fields
- The system SHALL enforce status values using CHECK constraint: planned, in_progress, completed, canceled
- The system SHALL create indexes on: company_id, status, assignee_id, due_at

### TR-2: Module Organization

- The system SHALL place all jobs code in `src/modules/practice-management/`
- The system SHALL colocate tests with source files

### TR-3: API Endpoints

- All endpoints SHALL be prefixed with `/api/internal/jobs`
- The system SHALL implement five operations: Create (POST), Read (GET), Update (PATCH), Delete (DELETE), List (GET)
- The system SHALL support filtering on list endpoint by: companyId, status, assigneeId, dueBefore, dueAfter
- The system SHALL order list results by creation date (newest first)

### TR-4: Business Logic

- The system SHALL automatically set completedAt timestamp when status changes to "completed"
- The system SHALL validate date ranges (periodStart <= periodEnd when both provided)
- The system SHALL handle foreign key constraint violations with clear error messages

## API Specification

### Response Format

All successful responses that return a job entity follow the structure defined in the [Job Entity](#job-entity) data model above.

### Internal API Endpoints

All endpoints are prefixed with `/api/internal/jobs`

#### Create Job

```
POST /api/internal/jobs
```

**Request Body:**

All fields except `companyId`, `serviceTypeId`, and `title` are optional. `status` defaults to "planned" if not provided.

```json
{
  "companyId": "company-uuid",
  "serviceTypeId": "service-type-uuid",
  "title": "Monthly Bookkeeping - January 2024",
  "status": "planned",
  "dueAt": "2024-02-15T17:00:00.000Z",
  "assigneeId": "assignee-uuid",
  "periodStart": "2024-01-01",
  "periodEnd": "2024-01-31"
}
```

**Response (201 Created):** Returns the complete Job entity with generated `id`, `createdAt`, and `updatedAt` fields.

#### Get Job

```
GET /api/internal/jobs/:id
```

**Response (200 OK):** Returns the complete Job entity.

#### Update Job

```
PATCH /api/internal/jobs/:id
```

**Request Body:** All fields are optional (partial update).

```json
{
  "status": "completed",
  "assigneeId": "new-assignee-uuid"
}
```

**Response (200 OK):** Returns the complete updated Job entity with:
- Updated `updatedAt` timestamp
- Automatically set `completedAt` if status changed to "completed"

#### Delete Job

```
DELETE /api/internal/jobs/:id
```

**Response (200 OK):**

```json
{
  "success": true,
  "id": "uuid-string"
}
```

#### List Jobs

```
GET /api/internal/jobs
```

**Query Parameters:**

- `companyId` (optional): Filter by company UUID
- `status` (optional): Filter by status ("planned", "in_progress", "completed", "canceled")
- `assigneeId` (optional): Filter by assignee UUID
- `dueBefore` (optional): Filter jobs due before this date (ISO 8601 format)
- `dueAfter` (optional): Filter jobs due after this date (ISO 8601 format)

**Response (200 OK):** Returns an object with a `jobs` array containing Job entities, ordered by creation date (newest first).

```json
{
  "jobs": [
    { /* Job entity */ },
    { /* Job entity */ }
  ]
}
```

## Error Responses

### Validation Error (400 Bad Request)

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "title",
      "message": "Title is required"
    }
  ]
}
```

### Not Found Error (404 Not Found)

```json
{
  "error": "Job not found"
}
```

### Foreign Key Violation (400 Bad Request)

```json
{
  "error": "Invalid company reference",
  "details": "Company with the provided ID does not exist"
}
```

### Internal Error (500 Internal Server Error)

```json
{
  "error": "Internal server error"
}
```

## Database Schema

The `jobs` table should be created in `src/db/schema.ts` with the following structure:

```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  service_type_id UUID NOT NULL,
  title TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'planned',
  due_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  assignee_id UUID,
  period_start DATE,
  period_end DATE,
  CONSTRAINT status_check CHECK (status IN ('planned', 'in_progress', 'completed', 'canceled'))
);

CREATE INDEX idx_jobs_company_id ON jobs(company_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_assignee_id ON jobs(assignee_id);
CREATE INDEX idx_jobs_due_at ON jobs(due_at);
```

## Testing Strategy

### Integration Tests

- API routes: End-to-end request/response flow
- Database: Schema validation, constraints, indexes
- Foreign key relationships and cascade behavior
- Status transitions and automatic completedAt updates

### Unit Tests

- Service layer: Business logic and validation
- Repository layer: Data access operations
- Date range validation
- Filter combinations

### Test Coverage

- All CRUD operations must be covered
- Error scenarios must be tested
- Validation rules must be verified
- Database constraints must be validated
- Status transitions must be tested
- Foreign key relationships must be validated

## Security Considerations

- The system SHALL be accessible only to internal services (authentication TBD)
- The system SHALL validate foreign key references to prevent unauthorized access
- The system SHALL enforce data access permissions at the service layer (future enhancement)

## Future Enhancements

- 🚧 Pagination support for list endpoint
- 🚧 Job history and audit trail
- 🚧 Job comments and attachments
- 🚧 Job dependencies and workflows
- 🚧 Automated job creation from templates
- 🚧 Job notifications and reminders
- 🚧 Advanced search and filtering capabilities
- 🚧 Job analytics and reporting
- 🚧 Bulk operations (create, update, delete)
- 🚧 Job time tracking
- 🚧 Job subtasks and checklists
- 🚧 Job priority and SLA management
- 🚧 Integration with external calendaring systems

## Success Criteria

- All five CRUDL operations are fully functional
- API endpoints return correct HTTP status codes
- Data validation prevents invalid data from being stored
- Foreign key relationships are properly enforced
- Status transitions work correctly with automatic completedAt updates
- Tests achieve minimum 80% code coverage
- Performance meets requirements (< 100ms for single operations)
- Filtering and sorting work as expected

