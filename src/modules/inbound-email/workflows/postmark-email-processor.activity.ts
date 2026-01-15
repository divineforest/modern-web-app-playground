/**
 * Postmark Email Processing Activity
 *
 * Processes inbound emails by:
 * 1. Archiving raw payload to S3 (FR-2 requirement)
 * 2. Processing email via existing service
 */
import { Context } from '@temporalio/activity';
import { createInvoiceService } from '../../../modules/invoices/services/invoices.service.js';
import { getCompanyByBillingInboundToken } from '../../../shared/data-access/core/companies.repository.js';
import { archiveInboundEmailPayload } from '../services/email-archiver.js';
import {
  type PostmarkWebhookPayload,
  processWebhook,
} from '../services/postmark-webhook-processor.js';

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
 * Process Postmark inbound email
 * First archives the raw payload to S3, then creates invoice record, then processes via existing service
 */
/**
 * @lintignore
 * Knip can't detect Temporal's dynamic activity wiring, but this export is required.
 */
export async function processInboundEmailActivity(payload: PostmarkWebhookPayload): Promise<void> {
  const context = Context.current();

  context.log.info('Processing Postmark email via existing service', {
    messageId: payload.MessageID,
    from: payload.From,
    to: payload.To,
    attachmentCount: payload.Attachments?.length || 0,
  });

  // Step 1: Archive raw payload to S3 before any processing (FR-2 requirement)
  try {
    const s3Key = await archiveInboundEmailPayload(payload);

    context.log.info('Successfully archived payload to S3', {
      messageId: payload.MessageID,
      s3Key,
    });
  } catch (error) {
    context.log.error('Failed to archive payload to S3', {
      messageId: payload.MessageID,
      error: error instanceof Error ? error.message : String(error),
    });
    // Re-throw to fail the activity - archival is mandatory per FR-2
    throw error;
  }

  // Step 2: Create invoice record after S3 archival
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
  } catch (error) {
    context.log.error('Failed to create invoice record', {
      messageId: payload.MessageID,
      error: error instanceof Error ? error.message : String(error),
    });
    // Re-throw to fail the activity - invoice creation is mandatory
    throw error;
  }

  // Step 3: Use the existing service to process the webhook - throws on failure
  await processWebhook(payload);

  context.log.info('Postmark email processing completed successfully', {
    messageId: payload.MessageID,
    attachmentCount: payload.Attachments?.length || 0,
  });
}
