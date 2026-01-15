/**
 * Create Invoice Activity
 *
 * Creates invoice record from inbound email
 */
import { Context } from '@temporalio/activity';
import { createInvoiceService } from '../../../../modules/invoices/services/invoices.service.js';
import { getCompanyByBillingInboundToken } from '../../../../shared/data-access/core/companies.repository.js';
import type { PostmarkWebhookPayload } from '../../services/postmark-webhook-processor.js';

function extractBillingInboundToken(email?: string): string | undefined {
  if (!email) return undefined;

  // Split by @ and use the part before @ as billing inbound token
  const parts = email.split('@');
  if (parts.length !== 2) {
    return undefined;
  }

  const billingInboundToken = parts[0];
  return billingInboundToken || undefined;
}

/**
 * Create invoice record
 * @lintignore
 * Knip can't detect Temporal's dynamic activity wiring, but this export is required.
 */
export async function createInvoiceActivity(payload: PostmarkWebhookPayload): Promise<string> {
  const context = Context.current();

  context.log.info('Creating invoice record', {
    messageId: payload.MessageID,
  });

  try {
    const billingInboundToken = extractBillingInboundToken(payload.OriginalRecipient);
    if (!billingInboundToken) {
      const error = 'No billing inbound token found in recipient email';
      context.log.error(error, {
        messageId: payload.MessageID,
        originalRecipient: payload.OriginalRecipient,
      });
      throw new Error(error);
    }

    const company = await getCompanyByBillingInboundToken(billingInboundToken);
    if (!company) {
      const error = 'No company found for billing inbound token';
      context.log.error(error, {
        messageId: payload.MessageID,
        billingInboundToken,
      });
      throw new Error(error);
    }

    const today = new Date();
    const invoiceData = {
      companyId: company.id,
      type: 'purchase' as const,
      status: 'draft' as const,
      invoiceNumber: `EMAIL-${payload.MessageID}`,
      issueDate: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`, // YYYY-MM-DD format
      currency: 'USD',
      totalAmount: 0,
    };

    const invoice = await createInvoiceService(invoiceData);

    context.log.info('Successfully created invoice record', {
      messageId: payload.MessageID,
      invoiceId: invoice.id,
      companyId: company.id,
      invoiceNumber: invoiceData.invoiceNumber,
    });

    return invoice.id;
  } catch (error) {
    context.log.error('Failed to create invoice record', {
      messageId: payload.MessageID,
      error: error instanceof Error ? error.message : String(error),
    });
    // Re-throw to fail the activity - invoice creation is mandatory
    throw error;
  }
}
