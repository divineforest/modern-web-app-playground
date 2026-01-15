/**
 * Extract Company ID Activity
 *
 * Extracts company ID from billing inbound token in recipient email
 */
import { Context } from '@temporalio/activity';
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
 * Extract company ID from billing inbound token
 * @lintignore
 * Knip can't detect Temporal's dynamic activity wiring, but this export is required.
 */
export async function extractCompanyIdActivity(
  payload: PostmarkWebhookPayload
): Promise<{ companyId: string } | null> {
  const context = Context.current();

  context.log.info('Extracting company ID from billing inbound token', {
    messageId: payload.MessageID,
  });

  try {
    const billingInboundToken = extractBillingInboundToken(payload.OriginalRecipient);
    if (!billingInboundToken) {
      context.log.warn('No billing inbound token found in recipient email', {
        messageId: payload.MessageID,
        originalRecipient: payload.OriginalRecipient,
      });
      return null;
    }

    const company = await getCompanyByBillingInboundToken(billingInboundToken);
    if (!company) {
      context.log.warn('No company found for billing inbound token', {
        messageId: payload.MessageID,
        billingInboundToken,
      });
      return null;
    }

    context.log.info('Successfully extracted company ID', {
      messageId: payload.MessageID,
      companyId: company.id,
    });

    return { companyId: company.id };
  } catch (error) {
    context.log.error('Failed to extract company ID', {
      messageId: payload.MessageID,
      error: error instanceof Error ? error.message : String(error),
    });
    // Re-throw to fail the activity - unexpected errors should fail
    throw error;
  }
}
