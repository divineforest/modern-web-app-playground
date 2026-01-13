/**
 * Postmark Email Processing Activity
 *
 * Processes inbound emails by:
 * 1. Archiving raw payload to S3 (FR-2 requirement)
 * 2. Processing email via existing service
 */
import { Context } from '@temporalio/activity';
import { createS3StorageService } from '../../../shared/data-access/s3/index.js';
import {
  type PostmarkWebhookPayload,
  processWebhook,
} from '../services/postmark-webhook-processor.js';

/**
 * Process Postmark inbound email
 * First archives the raw payload to S3, then processes via existing service
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
  const s3Service = createS3StorageService();
  const receivedDate = payload.Date ? new Date(payload.Date) : undefined;

  try {
    const s3Key = await s3Service.archiveInboundEmailPayload(
      payload,
      payload.MessageID,
      receivedDate
    );

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

  // Step 2: Use the existing service to process the webhook - throws on failure
  await processWebhook(payload);

  context.log.info('Postmark email processing completed successfully', {
    messageId: payload.MessageID,
    attachmentCount: payload.Attachments?.length || 0,
  });
}
