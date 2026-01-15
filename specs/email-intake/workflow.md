# Billing Inbound Email Workflow

## Overview

This specification covers the Temporal workflow that processes inbound emails received via Postmark webhooks. The workflow handles email data extraction, company identification, attachment processing, and Core API integration.

For the webhook endpoint that initiates this workflow, see [Billing Inbound Email Webhook](./webhook.md).

## Functional Requirements

### FR-1: Email Data Processing

- The system SHALL extract and validate email data from webhook payloads including:
  - From address (sender email and name)
  - To addresses (recipients)
  - Subject line
  - Message body (HTML and plain text)
  - Attachments (if present)
  - Message headers
  - Timestamp (received date)
- The system SHALL parse the recipient email address to extract billing inbound token from format `<billing-inbound-token>@something.com`
- The system SHALL convert the extracted billing inbound token to lowercase for consistent lookup
- The system SHALL look up the company ID by querying the database for companies.billing_inbound_token using case-insensitive matching against the lowercased token
- The system SHALL use the companies.id column value as the company ID for processing
- The system SHALL validate the extracted company exists in the system
- The system SHALL handle malformed or incomplete email data gracefully

### FR-2: Original Payload Archival

- The system SHALL store the original webhook payload to S3 before any processing begins
- The system SHALL use a consistent key structure for S3 storage: `inbound-emails/{YYYY}/{MM}/{DD}/{MessageID}.json`
  - Uses UTC timezone for consistency across environments
- The system SHALL store the raw, unmodified payload to preserve the exact data received
- This storage serves debugging and audit purposes and enables workflow replay if needed

### FR-2.1: Invoice Record Creation

- The system SHALL create a new record in the invoices table after the original payload has been successfully uploaded to S3
- The system SHALL extract the company ID from the billing inbound token in the recipient email address (same as used for Core API uploads)
- The system SHALL set the invoice type to "purchase" (received from suppliers/vendors)
- The system SHALL set the invoice status to "draft" (default status)
- The system SHALL generate a unique invoice number using format: `EMAIL-{MessageID}` (where MessageID is from Postmark)
- The system SHALL set the issue date to the current date when the invoice record is created
- The system SHALL set the currency to "USD" as default (can be updated later)
- The system SHALL set totalAmount to 0.00 as default (can be updated later)
- The system SHALL log the created invoice ID for audit purposes

### FR-3: Email Storage and Processing

- 🚧 The system SHALL store processed email data in a structured format
- 🚧 The system SHALL associate emails with relevant business entities (contacts, companies, etc.)
- 🚧 The system SHALL trigger appropriate business logic based on email content and metadata
- 🚧 The system SHALL maintain audit trail of processed emails

### FR-4: Attachment Handling

- The system SHALL process and decode base64-encoded attachments from webhook payloads
- The system SHALL validate attachment types and sizes before processing
- The system SHALL upload processed attachments to Core API files/upload endpoint
- 🚧 The system SHALL scan attachments for security threats (virus scanning)
- The system SHALL associate uploaded files with the originating email record

### FR-5: Core API Integration

- The system SHALL upload email attachments to Core API files/upload endpoint
- The system SHALL include the extracted company ID when uploading invoices to Core API
- The system SHALL include the Postmark MessageID as externalId when uploading files to Core API
- The system SHALL handle Core API authentication and authorization
- The system SHALL process attachments asynchronously to avoid webhook timeouts

## Technical Requirements

### TR-1: Workflow Processing with Temporal

- The system SHALL use Temporal for durable workflow orchestration of email processing
- The system SHALL use Postmark's MessageID as the Temporal workflow ID to prevent duplicate processing of the same email
- The system SHALL handle failed activities gracefully with appropriate error handling
- The system SHALL configure appropriate workflow timeouts and activity timeouts
- 🚧 The system SHALL implement activity rate limiting to prevent Core API overload

### TR-2: Error Handling

- The system SHALL implement robust error handling for processing failures
- The system SHALL log processing errors with sufficient detail for debugging
- 🚧 The system SHALL implement dead letter queue for failed processing

### TR-3: Performance

- The system SHALL handle high-volume email processing efficiently
- The system SHALL implement asynchronous processing for time-intensive operations
- 🚧 The system SHALL provide monitoring and alerting for processing performance

### TR-4: Configuration

- The system SHALL support configuration for:
  - 🚧 Allowed sender domains/addresses for email filtering
  - Core API endpoint URLs and authentication credentials
  - File upload settings (max file size, allowed file types)
  - 🚧 Attachment processing rules and virus scanning configuration
  - Database connection for company lookup via companies.billing_inbound_token and invoice creation
  - Temporal workflow configurations (timeouts, retention policies)
  - Workflow execution policies and activity configurations
  - 🚧 Rate limiting configuration for Core API requests
  - 🚧 Worker scaling and resource allocation settings
  - S3 bucket name and credentials for original payload storage (configured via env vars)

### TR-5: Database Requirements

- The system SHALL require a companies table with the following columns:
  - id: Primary key identifier for the company
  - billing_inbound_token: Unique token used in email addresses for identifying the company
- The system SHALL perform efficient lookups on companies.billing_inbound_token (should be indexed)
- The system SHALL handle database connection failures gracefully

## Workflow Architecture

### PostmarkInboundEmailWorkflow

The workflow executes a single activity **ProcessInboundEmailActivity** that performs all processing steps:

1. Store original webhook payload to S3 for debugging and audit purposes
2. Extract and process email metadata (sender, subject, body, headers)
3. Parse recipient email address to extract billing inbound token
4. Convert billing inbound token to lowercase and query database for companies.billing_inbound_token using case-insensitive matching
5. Validate the extracted company exists in the system
6. Decode base64 attachment content and validate file types/sizes
7. Upload attachments to Core API files/upload endpoint with company ID context and MessageID as externalId
8. Store email metadata in Core API with references to uploaded files and company association
9. Apply business logic and routing rules based on email content and company context
10. Trigger relevant workflows and notifications

Failed activities are handled gracefully by Temporal's built-in resilience mechanisms, and workflow failures are tracked for investigation.

## Processing Phases

### 1. Archival Phase

- Store original webhook payload to S3 before any processing
- Use key structure: `inbound-emails/{YYYY}/{MM}/{DD}/{MessageID}.json` (UTC timezone)
- Preserve raw, unmodified payload for debugging and audit purposes

### 1.1. Invoice Creation Phase

- Create a new invoice record in the invoices table after S3 archival
- Extract company ID from billing inbound token in recipient email
- Generate invoice number using format: `EMAIL-{MessageID}`
- Set invoice type to "purchase", status to "draft", currency to "USD", totalAmount to 0.00
- Set issue date to current date
- Log created invoice ID for audit purposes

### 2. Extraction Phase

- Parse email metadata (from, to, subject, date)
- Extract billing inbound token from recipient email address format `<billing-inbound-token>@something.com`
- Convert the extracted billing inbound token to lowercase for consistent lookup
- Query the database for companies.billing_inbound_token using case-insensitive matching against the lowercased token
- Use the companies.id column value as the company ID for processing
- Validate extracted company exists in the system
- Extract and decode email content (text/HTML)
- Process attachments and validate file types

### 3. Validation Phase

- 🚧 Check sender against allowlist/blocklist
- Validate attachment types and sizes
- Validate company exists in the system

### 4. Business Logic Phase

- 🚧 Identify recipient context and business rules
- 🚧 Route email to appropriate handlers
- 🚧 Trigger automated workflows if applicable

### 5. Storage Phase

- Upload attachments to Core API files/upload endpoint with company ID context and MessageID as externalId
- 🚧 Store email metadata in Core API with file references and company association
- 🚧 Associate email and files with the identified company entity
- 🚧 Update contact records and business context for the specific company

### 6. Completion Phase

- Log processing results
- 🚧 Send notifications if configured

## Core API Integration

### Files Upload Endpoint

**Endpoint**: `POST /api/v1/files/upload`

**Headers**:

- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Request Body** (multipart form data):

- `file`: The attachment file (decoded from base64)
- `filename`: Original filename from Postmark
- `contentType`: MIME type from Postmark
- `source`: "postmark-webhook"
- `companyId`: Company ID extracted from recipient email address
- `externalId`: MessageID from Postmark for unique identification
- `metadata`: JSON object with email context

**Response**:

```json
{
  "success": true,
  "fileId": "file_abc123",
  "url": "https://api.easybiz.com/files/file_abc123",
  "size": 1234,
  "checksum": "sha256:abc123..."
}
```

**Error Response**:

```json
{
  "success": false,
  "error": "File upload failed",
  "code": "UPLOAD_ERROR"
}
```

## Error Scenarios

### Workflow Processing Errors

- **S3 Storage Failure**: Activity fails and workflow retries; archival is mandatory to ensure audit trail and replay capability
- **Invoice Creation Failure**: Activity fails when creating invoice record; Temporal will retry the activity according to configured retry policy
- **Invalid Billing Inbound Token**: Activity fails and workflow handles the failure appropriately
- **Company Not Found**: Activity fails when companies.billing_inbound_token lookup fails, workflow handles accordingly
- **Processing Failure**: Activities are handled with appropriate failure recovery mechanisms
- **Attachment Too Large**: Skip attachment processing activity but continue with email metadata workflow
- **Core API Upload Failure**: Activity failures are handled with appropriate recovery mechanisms
- **Core API Authentication Error**: Activity failures are handled appropriately, log error and alert operations team
- **🚧 Virus Detected**: Reject attachment, log security incident, continue with email processing workflow
- **Temporal Server Connection Failure**: Workflows pause and resume when connection is restored
- **Worker Overload**: Workflows wait in Temporal task queue until workers become available
- **Activity Timeout**: Activities that exceed timeout limits are marked as failed and handled appropriately
- **Workflow Timeout**: Workflows that exceed overall timeout are terminated and marked as failed

## Monitoring and Observability

### Workflow Processing Monitoring

- 🚧 Monitor workflow execution rates and completion times for all workflow types
- 🚧 Track workflow success rates, failure rates, and error patterns across all activities
- 🚧 Monitor Temporal worker health and availability across all workflow and activity types
- 🚧 Alert on workflow failures and activity timeouts
- 🚧 Track Core API upload success rates and response times through activity monitoring
- 🚧 Monitor Temporal server connection health and workflow state persistence
- 🚧 Measure workflow processing latency from start to completion
- 🚧 Track workflow throughput and worker capacity utilization

### Business Metrics

- 🚧 Monitor attachment processing and storage usage
- 🚧 Track company identification success rates
- 🚧 Monitor email metadata storage completion rates
- 🚧 Provide dashboards for email processing analytics and workflow performance

## Security Considerations

- 🚧 Attachments must be scanned for malware
- 🚧 Access to stored emails should be properly authenticated and authorized
- 🚧 Sensitive email data should be encrypted at rest
