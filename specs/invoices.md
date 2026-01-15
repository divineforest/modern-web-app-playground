# Invoices

## Overview

This feature provides basic CRUD operations for managing invoices within the accounting system. Invoices represent billing documents linked to companies, supporting both sales invoices (issued to customers) and purchase invoices (received from suppliers). The feature is exposed as an internal API for use by other microservices and internal tools.

## Goals and Non-Goals

### Goals

- Provide CRUD operations for invoice management
- Support sales and purchase invoice types
- Track invoice status through lifecycle
- Link invoices to companies and contacts

### Non-Goals

- Line items management (future enhancement)
- Payment processing
- PDF generation or email delivery
- Tax calculation engine
- Invoice approval workflows

## Functional Requirements

### FR-1: Create Invoice

- The system SHALL accept invoice creation requests via internal API
- The system SHALL validate required fields (companyId, type, invoiceNumber, issueDate, currency, totalAmount)
- The system SHALL validate that referenced companyId exists
- The system SHALL validate type field against allowed values (sales, purchase)
- The system SHALL validate status field against allowed values (draft, sent, paid, overdue, cancelled)
- The system SHALL set default status to "draft" if not provided
- The system SHALL validate that invoiceNumber is unique within the company scope
- The system SHALL generate a unique identifier for each invoice
- The system SHALL store invoices with timestamps (createdAt, updatedAt)
- The system SHALL return the created invoice including generated fields

### FR-2: Read Invoice

- The system SHALL retrieve a single invoice by its unique identifier
- The system SHALL return complete invoice data including all fields
- The system SHALL return appropriate error when invoice is not found

### FR-3: Update Invoice

- The system SHALL accept partial updates to existing invoices
- The system SHALL validate updated fields before persisting changes
- The system SHALL update the updatedAt timestamp on successful update
- The system SHALL preserve fields not included in the update request
- The system SHALL automatically set paidAt timestamp when status changes to "paid"
- The system SHALL return the updated invoice with all current values
- The system SHALL return appropriate error when invoice is not found

### FR-4: Delete Invoice

- The system SHALL delete invoices permanently from the database
- The system SHALL return success response after successful deletion
- The system SHALL return appropriate error when invoice is not found

### FR-5: List Invoices

- The system SHALL retrieve multiple invoices
- The system SHALL support filtering by:
  - companyId (exact match)
  - type (exact match: sales, purchase)
  - status (exact match)
- The system SHALL return invoices ordered by issue date (newest first)

## Data Model

### Invoice Entity

```typescript
{
  id: string; // UUID, primary key
  createdAt: Date; // Creation timestamp
  updatedAt: Date; // Last update timestamp
  companyId: string; // UUID, foreign key to companies table (required)
  contactId: string | null; // UUID, foreign key to global_contacts
  type: "sales" | "purchase"; // Invoice type (required)
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled"; // default "draft"
  invoiceNumber: string; // Unique within company (required)
  issueDate: Date; // Date invoice was issued (required)
  dueDate: Date | null; // Payment due date
  paidAt: Date | null; // Auto-set when status becomes "paid"
  currency: string; // ISO 4217 currency code (required)
  totalAmount: number; // Invoice total (decimal, 2 places)
  description: string | null; // Invoice description
}
```

## Technical Requirements

### TR-1: Database Schema

- The system SHALL store invoices in an `invoices` table
- The system SHALL use UUID for primary key
- The system SHALL enforce foreign key constraint on companyId with CASCADE delete
- The system SHALL enforce NOT NULL constraint on companyId, type, invoiceNumber, issueDate, currency, totalAmount
- The system SHALL set default value for status to "draft"
- The system SHALL use NUMERIC(15,2) for totalAmount
- The system SHALL enforce type values using CHECK constraint: sales, purchase
- The system SHALL enforce status values using CHECK constraint
- The system SHALL create unique index on (company_id, invoice_number)
- The system SHALL create indexes on: company_id, contact_id, status, type, issue_date

### TR-2: Module Organization

- The system SHALL place all invoices code in `src/modules/invoices/`
- The system SHALL colocate tests with source files

### TR-3: API Endpoints

- All endpoints SHALL be prefixed with `/api/internal/invoices`
- The system SHALL implement five operations: Create (POST), Read (GET), Update (PATCH), Delete (DELETE), List (GET)
- The system SHALL support filtering on list endpoint by: companyId, type, status
- The system SHALL order list results by issue date (newest first)

### TR-4: Business Logic

- The system SHALL automatically set paidAt timestamp when status changes to "paid"
- The system SHALL handle foreign key constraint violations with clear error messages

## Database Schema

```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES global_contacts(id) ON DELETE SET NULL,
  type VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  invoice_number TEXT NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  currency VARCHAR(3) NOT NULL,
  total_amount NUMERIC(15,2) NOT NULL,
  description TEXT,
  CONSTRAINT invoices_type_check CHECK (type IN ('sales', 'purchase')),
  CONSTRAINT invoices_status_check CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled'))
);

CREATE UNIQUE INDEX idx_invoices_company_invoice_number ON invoices(company_id, invoice_number);
CREATE INDEX idx_invoices_company_id ON invoices(company_id);
CREATE INDEX idx_invoices_contact_id ON invoices(contact_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_type ON invoices(type);
CREATE INDEX idx_invoices_issue_date ON invoices(issue_date);
```

## API Specification

### Internal API Endpoints

All endpoints are prefixed with `/api/internal/invoices`

#### Create Invoice

```
POST /api/internal/invoices
```

**Request Body:**

```json
{
  "companyId": "company-uuid",
  "contactId": "contact-uuid",
  "type": "sales",
  "invoiceNumber": "INV-2024-001",
  "issueDate": "2024-01-15",
  "dueDate": "2024-02-15",
  "currency": "EUR",
  "totalAmount": 1500.00,
  "description": "Services for January 2024"
}
```

**Response (201 Created):** Returns the complete Invoice entity.

#### Get Invoice

```
GET /api/internal/invoices/:id
```

**Response (200 OK):** Returns the complete Invoice entity.

#### Update Invoice

```
PATCH /api/internal/invoices/:id
```

**Request Body:** All fields optional (partial update).

**Response (200 OK):** Returns the updated Invoice entity.

#### Delete Invoice

```
DELETE /api/internal/invoices/:id
```

**Response (200 OK):**

```json
{
  "success": true,
  "id": "invoice-uuid"
}
```

#### List Invoices

```
GET /api/internal/invoices
```

**Query Parameters:**

- `companyId` (optional): Filter by company UUID
- `type` (optional): Filter by type ("sales", "purchase")
- `status` (optional): Filter by status

**Response (200 OK):**

```json
{
  "invoices": [{ /* Invoice entity */ }]
}
```

## Error Responses

- **400 Bad Request**: Validation failed or foreign key violation
- **404 Not Found**: Invoice not found
- **409 Conflict**: Duplicate invoice number within company
- **500 Internal Server Error**: Unexpected error

## Testing Strategy

- All CRUD operations must be covered
- Error scenarios must be tested
- Database constraints must be validated
- Status transitions must be tested (paidAt auto-set)
- Unique invoice number constraint must be tested

## Future Enhancements

- 🚧 Line items support
- 🚧 Pagination for list endpoint
- 🚧 Additional filters (date ranges, amounts)
- 🚧 Soft delete for audit compliance
- 🚧 Invoice attachments

