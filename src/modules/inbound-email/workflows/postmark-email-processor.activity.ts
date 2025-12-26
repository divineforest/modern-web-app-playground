/**
 * Postmark Email Processing Activity
 *
 * Simple wrapper around existing postmark-webhook-processor service
 */
import { Context } from '@temporalio/activity';
import {
  type PostmarkWebhookPayload,
  processWebhook,
} from '../services/postmark-webhook-processor.js';

/**
 * Process Postmark inbound email using existing service
 * This activity simply wraps the existing processWebhook function
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

  // Use the existing service to process the webhook - throws on failure
  await processWebhook(payload);

  context.log.info('Postmark email processing completed successfully', {
    messageId: payload.MessageID,
    attachmentCount: payload.Attachments?.length || 0,
  });
}
