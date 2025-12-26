# Postmark Inbound Email Webhooks

## Overview

This feature provides webhook handling for inbound emails received through Postmark's email processing service. The system will receive, validate, and process webhook notifications when emails are sent to configured email addresses, enabling email-based interactions and automated processing workflows.

## Functional Requirements

### Webhook Reception

- The system SHALL expose a webhook endpoint to receive Postmark inbound email notifications
- The system SHALL handle concurrent webhook requests efficiently
- The system SHALL respond with appropriate HTTP status codes to Postmark

### Email Data Processing

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

### TR-1: Webhook Security

- 🚧 The system SHALL verify webhook authenticity using IP whitelisting (Postmark provides static IP addresses)
- The system SHALL implement rate limiting for webhook endpoints
- 🚧 The system SHALL validate request headers and payload format
- 🚧 The system SHALL reject unauthorized or malformed requests with appropriate error responses

### TR-2: Error Handling

- The system SHALL implement robust error handling for webhook processing failures
- The system SHALL log webhook processing errors with sufficient detail for debugging
- The system SHALL return appropriate HTTP status codes to indicate processing status
- 🚧 The system SHALL implement dead letter queue for failed webhook processing

### TR-3: Performance

- The system SHALL process webhook requests within Postmark's timeout requirements (< 30 seconds)
- The system SHALL handle high-volume email processing efficiently
- The system SHALL implement asynchronous processing for time-intensive operations
- 🚧 The system SHALL provide monitoring and alerting for webhook processing performance

### TR-4: Configuration

- The system SHALL support configuration for:
  - 🚧 Postmark webhook endpoint configuration and IP whitelist
  - 🚧 Allowed sender domains/addresses for email filtering
  - Core API endpoint URLs and authentication credentials
  - File upload settings (max file size, allowed file types)
  - 🚧 Attachment processing rules and virus scanning configuration
  - Database connection for company lookup via companies.billing_inbound_token
  - Temporal server connection settings (address, namespace, TLS configuration)
  - Temporal workflow configurations (timeouts, retention policies)
  - Workflow execution policies and activity configurations
  - 🚧 Rate limiting configuration for Core API requests
  - 🚧 Worker scaling and resource allocation settings

### TR-5: Database Requirements

- The system SHALL require a companies table with the following columns:
  - id: Primary key identifier for the company
  - billing_inbound_token: Unique token used in email addresses for identifying the company
- The system SHALL perform efficient lookups on companies.billing_inbound_token (should be indexed)
- The system SHALL handle database connection failures gracefully

### TR-6: Workflow Processing with Temporal

- The system SHALL use Temporal for durable workflow orchestration of webhook processing
- The system SHALL use Postmark's MessageID as the Temporal workflow ID to prevent duplicate processing of the same email
- The system SHALL handle failed activities gracefully with appropriate error handling
- The system SHALL configure appropriate workflow timeouts and activity timeouts
- 🚧 The system SHALL implement activity rate limiting to prevent Core API overload

## Data Flow

### Webhook Reception and Workflow Processing

1. Postmark receives inbound email sent to configured address (format: `<billing-inbound-token>@something.com`)
2. Postmark sends webhook notification to configured endpoint with email data and base64-encoded attachments
3. **Webhook Handler** validates webhook authenticity and payload format
4. **Webhook Handler** starts the `PostmarkInboundEmailWorkflow` using Postmark's MessageID as the workflow ID (for deduplication) with the payload and responds to Postmark with HTTP 200
5. **PostmarkInboundEmailWorkflow** executes a single activity **ProcessInboundEmailActivity**:
   1. Extract and process email metadata (sender, subject, body, headers)
   2. Parse recipient email address to extract billing inbound token
   3. Convert billing inbound token to lowercase and query database for companies.billing_inbound_token using case-insensitive matching
   4. Validate the extracted company exists in the system
   5. Decode base64 attachment content and validate file types/sizes
   6. Upload attachments to Core API files/upload endpoint with company ID context and MessageID as externalId
   7. Store email metadata in Core API with references to uploaded files and company association
   8. Apply business logic and routing rules based on email content and company context
   9. Trigger relevant workflows and notifications
6. Failed activities are handled gracefully by Temporal's built-in resilience mechanisms, and workflow failures are tracked for investigation

## Webhook Integration Details

### Endpoint Configuration

**Endpoint**: `POST /api/v2/webhooks/postmark/inbound`

- Accepts Postmark inbound webhook payload format
- Secured via IP whitelisting and/or HTTP Basic Authentication (Postmark does not send webhook signatures)
- Returns HTTP 200 for successful processing
- Returns HTTP 4xx/5xx for validation/processing errors

### Webhook Payload Structure

Postmark sends webhook notifications with the following structure:

```json
{
  "FromName": "Sender Name",
  "From": "sender@example.com",
  "FromFull": {
    "Email": "sender@example.com",
    "Name": "Sender Name"
  },
  "To": "recipient@yourdomain.com",
  "ToFull": [
    {
      "Email": "recipient@yourdomain.com",
      "Name": "Recipient Name"
    }
  ],
  "Cc": "",
  "CcFull": [],
  "Bcc": "",
  "BccFull": [],
  "Subject": "Email Subject",
  "MessageID": "unique-message-id",
  "Date": "2023-12-07T10:00:00Z",
  "TextBody": "Plain text email content",
  "HtmlBody": "<html>HTML email content</html>",
  "Headers": [
    {
      "Name": "Header-Name",
      "Value": "Header-Value"
    }
  ],
  "Attachments": [
    {
      "Name": "attachment.pdf",
      "Content": "base64-encoded-content",
      "ContentType": "application/pdf",
      "ContentLength": 12345
    }
  ]
}
```

### Security Validation

- Verify request originates from Postmark's IP addresses
- Validate request headers and payload format
- Optional: Implement HTTP Basic Authentication for additional security

### Processing Workflow

1. **Validation Phase**

   - 🚧 Verify request origin and format
   - Validate payload structure and required fields
   - 🚧 Check sender against allowlist/blocklist

2. **Extraction Phase**

   - Parse email metadata (from, to, subject, date)
   - Extract billing inbound token from recipient email address format `<billing-inbound-token>@something.com`
   - Convert the extracted billing inbound token to lowercase for consistent lookup
   - Query the database for companies.billing_inbound_token using case-insensitive matching against the lowercased token
   - Use the companies.id column value as the company ID for processing
   - Validate extracted company exists in the system
   - Extract and decode email content (text/HTML)
   - Process attachments and validate file types

3. **Business Logic Phase**

   - 🚧 Identify recipient context and business rules
   - 🚧 Route email to appropriate handlers
   - 🚧 Trigger automated workflows if applicable

4. **Storage Phase**

   - Upload attachments to Core API files/upload endpoint with company ID context and MessageID as externalId
   - 🚧 Store email metadata in Core API with file references and company association
   - 🚧 Associate email and files with the identified company entity
   - 🚧 Update contact records and business context for the specific company

5. **Response Phase**
   - Log processing results
   - 🚧 Send notifications if configured
   - Return success response to Postmark

## Security Considerations

- 🚧 All webhook requests must originate from Postmark's verified IP addresses
- 🚧 Email content should be sanitized to prevent XSS attacks
- 🚧 Attachments must be scanned for malware
- 🚧 Access to stored emails should be properly authenticated and authorized
- 🚧 Sensitive email data should be encrypted at rest

## Monitoring and Observability

### Webhook Reception Monitoring

- 🚧 Track webhook processing metrics (volume, success rate, latency)
- Log webhook failures with detailed error information
- 🚧 Monitor webhook endpoint availability and response times
- 🚧 Alert on webhook processing delays or high error rates

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

## Error Scenarios

### Webhook Reception Errors

- **Invalid Request Origin**: Return HTTP 401 Unauthorized
- **Malformed Payload**: Return HTTP 400 Bad Request
- **Rate Limiting**: Return HTTP 429 Too Many Requests
- **Workflow Creation Failure**: Return HTTP 500 Internal Server Error (causes Postmark to retry webhook)

### Workflow Processing Errors

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

## Local Testing

### Example Curl Request

For local development and testing, you can use this curl command to simulate a Postmark inbound webhook:

```bash
curl http://localhost:3000/api/v2/webhooks/postmark/inbound \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
  "FromName": "Postmarkapp Support",
  "From": "support@postmarkapp.com",
  "FromFull": {
    "Email": "support@postmarkapp.com",
    "Name": "Postmarkapp Support",
    "MailboxHash": ""
  },
  "To": "\"Firstname Lastname\" <your-billing-token@inbound.postmarkapp.com>",
  "ToFull": [
    {
      "Email": "your-billing-token@inbound.postmarkapp.com",
      "Name": "Firstname Lastname",
      "MailboxHash": "SampleHash"
    }
  ],
  "Cc": "\"First Cc\" <firstcc@postmarkapp.com>, secondCc@postmarkapp.com",
  "CcFull": [
    {
      "Email": "firstcc@postmarkapp.com",
      "Name": "First Cc",
      "MailboxHash": ""
    },
    {
      "Email": "secondCc@postmarkapp.com",
      "Name": "",
      "MailboxHash": ""
    }
  ],
  "Bcc": "\"First Bcc\" <firstbcc@postmarkapp.com>, secondbcc@postmarkapp.com",
  "BccFull": [
    {
      "Email": "firstbcc@postmarkapp.com",
      "Name": "First Bcc",
      "MailboxHash": ""
    },
    {
      "Email": "secondbcc@postmarkapp.com",
      "Name": "",
      "MailboxHash": ""
    }
  ],
  "OriginalRecipient": "7ffc00a57ee56efbe2163051a22d6aef@inbound.postmarkapp.com",
  "Subject": "Test subject",
  "MessageID": "unique-message-id",
  "ReplyTo": "replyto@postmarkapp.com",
  "MailboxHash": "SampleHash",
  "Date": "Fri, 1 Aug 2014 16:45:32 -04:00",
  "TextBody": "This is a test text body.",
  "HtmlBody": "<html><body><p>This is a test html body.</p></body></html>",
  "StrippedTextReply": "This is the reply text",
  "Tag": "TestTag",
  "Headers": [
    {
      "Name": "X-Header-Test",
      "Value": ""
    },
    {
      "Name": "X-Spam-Status",
      "Value": "No"
    },
    {
      "Name": "X-Spam-Score",
      "Value": "-0.1"
    },
    {
      "Name": "X-Spam-Tests",
      "Value": "DKIM_SIGNED,DKIM_VALID,DKIM_VALID_AU,SPF_PASS"
    }
  ],
  "Attachments": [
    {
      "Name": "test.txt",
      "Content": "VGhpcyBpcyBhdHRhY2htZW50IGNvbnRlbnRzLCBiYXNlLTY0IGVuY29kZWQu",
      "ContentType": "text/plain",
      "ContentLength": 45
    }
  ]
}'
```

**Testing Notes:**

- Replace `your-billing-token@inbound.postmarkapp.com` with a valid billing token
- Ensure you have a company in your database with the corresponding `billing_inbound_token` value
