# Odoo Contacts Sync Requirements

## Overview

This feature provides synchronization of contacts from Odoo ERP system using its JSON-RPC API. The contacts data will be retrieved from Odoo and upserted to the Core API for integration with the broader system.

## Functional Requirements

### FR-1: Contact Retrieval

- The system SHALL fetch contacts from Odoo using the JSON-RPC API
- The system SHALL retrieve all active contacts from the `res.partner` model
- The system SHALL handle pagination for large contact datasets

### FR-2: Data Processing

- The system SHALL transform Odoo contact data into a standardized format
- The system SHALL include essential contact fields:
  - Name (name)
  - Email
  - Phone
  - Write date (for tracking updates)
  - Active status
- The system SHALL normalize contacts to upsert payload format with:
  - Company ID
  - Source system ('odoo')
  - Source ID (Odoo partner ID)

### FR-3: API Integration

- The system SHALL upsert retrieved contacts to the Core API
- The system SHALL process contacts in batches (200 contacts per batch)
- The system SHALL handle API responses and retry failed requests

## Technical Requirements

### TR-1: Authentication

- The system SHALL authenticate using Odoo database credentials
- The system SHALL handle JSON-RPC session management securely

### TR-2: Error Handling

- The system SHALL implement retry logic for failed API calls
- The system SHALL log errors appropriately
- The system SHALL gracefully handle network timeouts

### TR-3: Configuration

- The system SHALL support configuration for:
  - Odoo server URL
  - Database name
  - Authentication credentials
  - Core API URL and credentials
  - Batch size (default: 200)
  - Retry configuration (attempts, delays, timeouts)

## Data Flow

1. Authenticate with Odoo database via JSON-RPC API
2. Query contacts from `res.partner` model via JSON-RPC API
3. Process and transform contact data into upsert payloads
4. Submit batches of contacts to Core API (`/api/v1/contacts/upsert`)
5. Handle API responses and retry failed requests
6. Log sync completion status with metrics

## Sync Algorithm

### Initialize per company

- Load Odoo credentials for the company
- Initialize Core SDK with API configuration

### Fetch all contacts from Odoo

- Authenticate with Odoo using JSON-RPC API
- Search all `res.partner` records from Odoo with fields: `id`, `name`, `email`, `phone`, `write_date`, `active`
- Apply reasonable limit (1000 records) to prevent memory issues

### Normalize contacts to upsert payloads

Transform each Odoo contact to standardized format:

- `company_id`: Company identifier
- `source_system`: 'odoo'
- `source_id`: Odoo partner ID as string
- `name`: Contact name

### Batch processing and API upsert

- Process contacts in batches of 200
- For each batch:
  1. Create Core SDK instance
  2. Call `coreSdk.upsertContacts(payloads)`
  3. Handle API response and log metrics

### API Integration Details

**Endpoint**: `POST /api/v1/contacts/upsert`

- Request body contains array of contact payloads
- Includes retry logic with exponential backoff
- Supports authentication via Bearer token
- Returns upsert metrics: `{ success: boolean, upserted: number, skipped: number, errors?: string[] }`

### Error handling and observability

- Log batch processing metrics (count, success/failure)
- Implement retry logic for network failures and timeouts
- Handle API errors gracefully with detailed logging
- Track overall sync progress and completion status
