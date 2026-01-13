# Billing Inbound Email Webhook

## Overview

This specification covers the webhook endpoint that receives inbound emails from Postmark's email processing service. The webhook handler validates incoming requests and initiates the email processing workflow.

For the actual email processing logic, see [Billing Inbound Email Workflow](./workflow.md).

## Functional Requirements

### FR-1: Webhook Reception

- The system SHALL expose a webhook endpoint to receive Postmark inbound email notifications
- The system SHALL handle concurrent webhook requests efficiently
- The system SHALL respond with appropriate HTTP status codes to Postmark

### FR-2: Payload Validation

- The system SHALL validate webhook payload structure and required fields
- The system SHALL handle malformed or incomplete payloads gracefully
- The system SHALL reject payloads missing the MessageID field

### FR-3: Workflow Initiation

- The system SHALL start the `PostmarkInboundEmailWorkflow` using Postmark's MessageID as the workflow ID (for deduplication)
- The system SHALL pass the validated payload to the workflow
- The system SHALL respond to Postmark with HTTP 200 after successfully starting the workflow

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

### TR-3: Performance

- The system SHALL process webhook requests within Postmark's timeout requirements (< 30 seconds)
- The system SHALL handle high-volume webhook requests efficiently
- The system SHALL respond quickly by deferring processing to the workflow
- 🚧 The system SHALL provide monitoring and alerting for webhook processing performance

### TR-4: Configuration

- The system SHALL support configuration for:
  - 🚧 Postmark webhook endpoint configuration and IP whitelist
  - Temporal server connection settings (address, namespace, TLS configuration)
  - Rate limiting configuration

## Endpoint Configuration

**Endpoint**: `POST /api/v2/webhooks/postmark/inbound`

- Accepts Postmark inbound webhook payload format
- Secured via IP whitelisting and/or HTTP Basic Authentication (Postmark does not send webhook signatures)
- Returns HTTP 200 for successful workflow initiation
- Returns HTTP 4xx/5xx for validation/processing errors

## Webhook Payload Structure

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

## Data Flow

1. Postmark receives inbound email sent to configured address (format: `<billing-inbound-token>@something.com`)
2. Postmark sends webhook notification to configured endpoint with email data and base64-encoded attachments
3. **Webhook Handler** validates webhook authenticity and payload format
4. **Webhook Handler** starts the `PostmarkInboundEmailWorkflow` using Postmark's MessageID as the workflow ID (for deduplication)
5. **Webhook Handler** responds to Postmark with HTTP 200

## Processing Phases

### Validation Phase

- 🚧 Verify request origin and format
- Validate payload structure and required fields

### Response Phase

- Log processing results
- Return success response to Postmark

## Security Validation

- Verify request originates from Postmark's IP addresses
- Validate request headers and payload format
- Optional: Implement HTTP Basic Authentication for additional security

## Error Scenarios

### Webhook Reception Errors

- **Invalid Request Origin**: Return HTTP 401 Unauthorized
- **Malformed Payload**: Return HTTP 400 Bad Request
- **Missing MessageID**: Return HTTP 400 Bad Request
- **Rate Limiting**: Return HTTP 429 Too Many Requests
- **Workflow Creation Failure**: Return HTTP 500 Internal Server Error (causes Postmark to retry webhook)
- **Temporal Server Connection Failure**: Return HTTP 500 Internal Server Error (causes Postmark to retry webhook)

## Monitoring and Observability

### Webhook Reception Monitoring

- 🚧 Track webhook processing metrics (volume, success rate, latency)
- Log webhook failures with detailed error information
- 🚧 Monitor webhook endpoint availability and response times
- 🚧 Alert on webhook processing delays or high error rates

## Security Considerations

- 🚧 All webhook requests must originate from Postmark's verified IP addresses
- 🚧 Email content should be sanitized to prevent XSS attacks

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
