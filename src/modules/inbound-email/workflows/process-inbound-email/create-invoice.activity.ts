/**
 * Create Invoice Activity
 *
 * Creates invoice record from inbound email
 */
import { Context } from '@temporalio/activity';
import { createInvoiceService } from '../../../../modules/invoices/services/invoices.service.js';
import type { PostmarkWebhookPayload } from '../../services/postmark-webhook-processor.js';

/**
 * Create invoice record
 * @lintignore
 * Knip can't detect Temporal's dynamic activity wiring, but this export is required.
 */
export async function createInvoiceActivity(
  payload: PostmarkWebhookPayload,
  companyId: string
): Promise<string> {
  const context = Context.current();

  context.log.info('Creating invoice record', {
    messageId: payload.MessageID,
    companyId,
  });

  try {
    const invoiceData = {
      companyId,
      type: 'purchase' as const,
      status: 'new' as const,
      invoiceNumber: null,
      issueDate: null,
      currency: null,
      totalAmount: null,
    };

    const invoice = await createInvoiceService(invoiceData);

    context.log.info('Successfully created invoice record', {
      messageId: payload.MessageID,
      invoiceId: invoice.id,
      companyId,
    });

    return invoice.id;
  } catch (error) {
    context.log.error('Failed to create invoice record', {
      messageId: payload.MessageID,
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Re-throw to fail the activity - invoice creation is mandatory
    throw error;
  }
}
