/**
 * Postmark Inbound Email Workflow
 *
 * Orchestrates the processing of inbound emails received via Postmark webhooks
 */
import { proxyActivities } from '@temporalio/workflow';
import type { PostmarkWebhookPayload } from '../../services/postmark-webhook-processor.js';
import type * as activities from './index.js';

// Proxy activities with timeout configuration (using default retry settings)
const {
  archiveToS3Activity,
  extractCompanyIdActivity,
  createInvoiceActivity,
  processWebhookActivity,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 minutes', // Max time for each activity
});

/**
 * PostmarkInboundEmailWorkflow
 *
 * This workflow processes a single inbound email from Postmark by:
 * 1. Archiving the raw payload to S3
 * 2. Extracting company ID from billing inbound token
 * 3. Creating an invoice record (if company found)
 * 4. Processing the email via the existing service (if company found)
 *
 * Each step is a separate activity with independent retry behavior.
 *
 * @param payload - The Postmark webhook payload
 * @returns Promise<void> - Throws on processing failure
 */

export async function postmarkInboundEmailWorkflow(payload: PostmarkWebhookPayload): Promise<void> {
  // Step 1: Archive to S3 (mandatory per FR-2)
  await archiveToS3Activity(payload);

  // Step 2: Extract company ID
  const companyResult = await extractCompanyIdActivity(payload);

  // If no company found, workflow completes successfully
  if (!companyResult) {
    return;
  }

  // Step 3: Create invoice record
  await createInvoiceActivity(payload, companyResult.companyId);

  // Step 4: Process webhook
  await processWebhookActivity(payload);
}
