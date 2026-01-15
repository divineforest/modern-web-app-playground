/**
 * Process Webhook Activity
 *
 * Processes email via existing service
 */
import { Context } from '@temporalio/activity';
import {
  type PostmarkWebhookPayload,
  processWebhook,
} from '../../services/postmark-webhook-processor.js';

/**
 * Activity 3: Process webhook via existing service
 * @lintignore
 * Knip can't detect Temporal's dynamic activity wiring, but this export is required.
 */
export async function processWebhookActivity(payload: PostmarkWebhookPayload): Promise<void> {
  const context = Context.current();

  context.log.info('Processing webhook', {
    messageId: payload.MessageID,
    from: payload.From,
    to: payload.To,
    attachmentCount: payload.Attachments?.length || 0,
  });

  // Use the existing service to process the webhook - throws on failure
  await processWebhook(payload);

  context.log.info('Webhook processing completed successfully', {
    messageId: payload.MessageID,
    attachmentCount: payload.Attachments?.length || 0,
  });
}
