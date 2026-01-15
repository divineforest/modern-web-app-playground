/**
 * Postmark Inbound Email Workflow
 *
 * Orchestrates the processing of inbound emails received via Postmark webhooks
 */
import { proxyActivities } from '@temporalio/workflow';
import type { PostmarkWebhookPayload } from '../services/postmark-webhook-processor.js';
import type * as activities from './process-inbound-email/index.js';

// Proxy activities with timeout configuration (using default retry settings)
const { archiveToS3Activity, createInvoiceActivity, processWebhookActivity } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: '2 minutes', // Max time for each activity
});

/**
 * PostmarkInboundEmailWorkflow
 *
 * This workflow processes a single inbound email from Postmark by:
 * 1. Archiving the raw payload to S3
 * 2. Creating an invoice record
 * 3. Processing the email via the existing service
 *
 * Each step is a separate activity with independent retry behavior.
 *
 * @param payload - The Postmark webhook payload
 * @returns Promise<void> - Throws on processing failure
 */

export async function postmarkInboundEmailWorkflow(payload: PostmarkWebhookPayload): Promise<void> {
  // Step 1: Archive to S3 (mandatory per FR-2)
  await archiveToS3Activity(payload);

  // Step 2: Create invoice record
  await createInvoiceActivity(payload);

  // Step 3: Process webhook
  await processWebhookActivity(payload);
}
