# Job Templates

## Overview

This feature provides basic CRUD operations for managing job templates within the accounting system. Job templates are reusable structures that define standardized job configurations for accounting operations. The feature is exposed as an internal API for use by other microservices and internal tools.

## Functional Requirements

### FR-1: Create Job Template

- The system SHALL accept job template creation requests via internal API
- The system SHALL validate required fields (code, name, titlePattern) before creating a job template
- The system SHALL enforce unique constraint on code field
- The system SHALL validate code field format (uppercase alphanumeric with underscores only)
- The system SHALL generate a unique identifier for each job template
- The system SHALL store job templates with timestamps (createdAt, updatedAt)
- The system SHALL return the created job template including generated fields

### FR-2: Read Job Template

- The system SHALL retrieve a single job template by its unique identifier
- The system SHALL return complete job template data including all fields
- The system SHALL return appropriate error when job template is not found

### FR-3: Update Job Template

- The system SHALL accept partial updates to existing job templates
- The system SHALL validate updated fields before persisting changes
- The system SHALL update the updatedAt timestamp on successful update
- The system SHALL preserve fields not included in the update request
- The system SHALL return the updated job template with all current values
- The system SHALL return appropriate error when job template is not found

### FR-4: Delete Job Template

- The system SHALL delete job templates permanently from the database
- The system SHALL return success response after successful deletion
- The system SHALL return appropriate error when job template is not found
- The system SHALL prevent deletion of job templates in active use (future enhancement)

### FR-5: List Job Templates

- The system SHALL retrieve multiple job templates
- The system SHALL support filtering by isActive status
- The system SHALL return job templates ordered by creation date (newest first)

## Data Model

### Job Template Entity

```typescript
{
  id: string; // UUID, primary key
  createdAt: Date; // Creation timestamp
  updatedAt: Date; // Last update timestamp
  code: string; // Unique template code (uppercase alphanumeric with underscores, e.g., "INVOICE_REVIEW")
  name: string; // Template name (required, max 255 chars)
  description: string | null; // Optional description
  isActive: string; // Active status as string ("true" or "false"), default "true"
  defaultAssigneeId: string | null; // UUID of default assignee
  titlePattern: string; // Title pattern for jobs created from this template
}
```

## Technical Requirements

### TR-1: Database Schema

- The system SHALL store job templates in a `job_templates` table
- The system SHALL use UUID for primary key (id)
- The system SHALL enforce unique constraint on code field
- The system SHALL validate code field format (uppercase alphanumeric with underscores) using CHECK constraint
- The system SHALL set default value for isActive to "true" (string)
- The system SHALL create an index on the code field for efficient lookups

### TR-2: Module Organization

- The system SHALL place all job templates code in `src/modules/jobs/`
- The system SHALL colocate tests with source files

### TR-3: API Endpoints

- All endpoints SHALL be prefixed with `/api/internal/job-templates`
- The system SHALL implement five operations: Create (POST), Read (GET), Update (PATCH), Delete (DELETE), List (GET)
- The system SHALL support filtering by `isActive` query parameter on list endpoint
- The system SHALL order list results by creation date (newest first)

## API Specification

### Internal API Endpoints

All endpoints are prefixed with `/api/internal/job-templates`

#### Create Job Template

```
POST /api/internal/job-templates
```

**Request Body:**

```json
{
  "code": "INVOICE_REVIEW",
  "name": "Standard Accounting Job",
  "description": "Template for standard accounting operations",
  "isActive": "true",
  "defaultAssigneeId": "assignee-uuid",
  "titlePattern": "Invoice Review - {company_name}"
}
```

**Response (201 Created):**

```json
{
  "id": "uuid-string",
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z",
  "code": "INVOICE_REVIEW",
  "name": "Standard Accounting Job",
  "description": "Template for standard accounting operations",
  "isActive": "true",
  "defaultAssigneeId": "assignee-uuid",
  "titlePattern": "Invoice Review - {company_name}"
}
```

#### Get Job Template

```
GET /api/internal/job-templates/:id
```

**Response (200 OK):**

```json
{
  "id": "uuid-string",
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z",
  "code": "INVOICE_REVIEW",
  "name": "Standard Accounting Job",
  "description": "Template for standard accounting operations",
  "isActive": "true",
  "defaultAssigneeId": "assignee-uuid",
  "titlePattern": "Invoice Review - {company_name}"
}
```

#### Update Job Template

```
PATCH /api/internal/job-templates/:id
```

**Request Body (partial update):**

```json
{
  "name": "Updated Template Name",
  "isActive": "false"
}
```

**Response (200 OK):**

```json
{
  "id": "uuid-string",
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "code": "INVOICE_REVIEW",
  "name": "Updated Template Name",
  "description": "Template for standard accounting operations",
  "isActive": "false",
  "defaultAssigneeId": "assignee-uuid",
  "titlePattern": "Invoice Review - {company_name}"
}
```

#### Delete Job Template

```
DELETE /api/internal/job-templates/:id
```

**Response (200 OK):**

```json
{
  "success": true,
  "id": "uuid-string"
}
```

#### List Job Templates

```
GET /api/internal/job-templates
```

**Query Parameters:**

- `isActive` (optional): Filter by active status ("true" or "false" as strings)

**Response (200 OK):**

```json
{
  "jobTemplates": [
    {
      "id": "uuid-string-1",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z",
      "code": "INVOICE_REVIEW",
      "name": "Template 1",
      "description": "Description 1",
      "isActive": "true",
      "defaultAssigneeId": "assignee-uuid-1",
      "titlePattern": "Invoice Review - {company_name}"
    },
    {
      "id": "uuid-string-2",
      "createdAt": "2024-01-14T15:30:00.000Z",
      "updatedAt": "2024-01-14T15:30:00.000Z",
      "code": "EXPENSE_APPROVAL",
      "name": "Template 2",
      "description": "Description 2",
      "isActive": "true",
      "defaultAssigneeId": null,
      "titlePattern": "Expense Approval - {expense_type}"
    }
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
      "field": "name",
      "message": "Name is required"
    }
  ]
}
```

### Not Found Error (404 Not Found)

```json
{
  "error": "Job template not found"
}
```

### Internal Error (500 Internal Server Error)

```json
{
  "error": "Internal server error"
}
```

## Database Schema

The `job_templates` table already exists in `src/db/schema.ts` with the following structure:

```sql
CREATE TABLE job_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  code TEXT NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active VARCHAR(10) NOT NULL DEFAULT 'true',
  default_assignee_id UUID,
  title_pattern TEXT NOT NULL,
  CONSTRAINT code_check CHECK (code ~ '^[A-Z0-9_]+$')
);
```

## Testing Strategy

### Integration Tests

- API routes: End-to-end request/response flow
- Database: Schema validation, constraints, indexes

### Test Coverage

- All CRUD operations must be covered
- Error scenarios must be tested
- Validation rules must be verified
- Database constraints must be validated

## Security Considerations

- The system SHALL be accessible only to internal services (authentication TBD)
- The system SHALL sanitize code field input to prevent injection through CHECK constraint

## Future Enhancements

- 🚧 Template versioning and change history
- 🚧 Template cloning and duplication
- 🚧 Template validation rules and constraints
- 🚧 Template usage tracking and analytics
- 🚧 Advanced filtering and search capabilities
- 🚧 Template categories and tags
- 🚧 Bulk operations (create, update, delete)
- 🚧 Template import/export functionality
- 🚧 Template inheritance and composition

## Success Criteria

- All five CRUD operations are fully functional
- API endpoints return correct HTTP status codes
- Data validation prevents invalid data from being stored
- Tests achieve minimum 80% code coverage
- Performance meets requirements (< 100ms for single operations)
