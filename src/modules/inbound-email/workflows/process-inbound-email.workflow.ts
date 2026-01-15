/**
 * Postmark Inbound Email Workflow
 *
 * Orchestrates the processing of inbound emails received via Postmark webhooks
 */
import { proxyActivities } from '@temporalio/workflow';
import type { PostmarkWebhookPayload } from '../services/postmark-webhook-processor.js';
import type * as activities from './postmark-email-processor.activity.js';

// Proxy activities with timeout configuration (using default retry settings)
const { processInboundEmailActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes', // Max time for processing
});

/**
 * PostmarkInboundEmailWorkflow
 *
 * This workflow processes a single inbound email from Postmark by:
 * 1. Executing the ProcessInboundEmailActivity (which uses existing service)
 * 2. Handling retries and failures using Temporal's default mechanisms
 *
 * @param payload - The Postmark webhook payload
 * @returns Promise<void> - Throws on processing failure
 */
export async function postmarkInboundEmailWorkflow(payload: PostmarkWebhookPayload): Promise<void> {
  // Single activity execution as per specification - throws on failure
  await processInboundEmailActivity(payload);
}
