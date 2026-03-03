/**
 * Payment Webhook Workflow
 *
 * Orchestrates the processing of Stripe payment webhooks to mark orders as paid
 */
import { proxyActivities } from '@temporalio/workflow';
import type * as activities from './index.js';

const { markOrderPaidActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 minutes',
});

export interface PaymentWebhookInput {
  eventId: string;
  clientReferenceId: string;
  paymentIntentId: string;
}

/**
 * PaymentWebhookWorkflow
 *
 * This workflow processes a Stripe payment event by marking the corresponding order as paid.
 *
 * @param input - Payment webhook input data
 * @returns Promise<void>
 */
export async function paymentWebhookWorkflow(input: PaymentWebhookInput): Promise<void> {
  await markOrderPaidActivity(input);
}
