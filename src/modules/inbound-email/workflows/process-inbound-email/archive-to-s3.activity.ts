/**
 * Archive to S3 Activity
 *
 * Archives raw payload to S3 (FR-2 requirement)
 */
import { Context } from '@temporalio/activity';
import { archiveInboundEmailPayload } from '../../services/email-archiver.js';
import type { PostmarkWebhookPayload } from '../../services/postmark-webhook-processor.js';

/**
 * Activity 1: Archive raw payload to S3
 * @lintignore
 * Knip can't detect Temporal's dynamic activity wiring, but this export is required.
 */
export async function archiveToS3Activity(payload: PostmarkWebhookPayload): Promise<string> {
  const context = Context.current();

  context.log.info('Archiving payload to S3', {
    messageId: payload.MessageID,
  });

  try {
    const s3Key = await archiveInboundEmailPayload(payload);

    context.log.info('Successfully archived payload to S3', {
      messageId: payload.MessageID,
      s3Key,
    });

    return s3Key;
  } catch (error) {
    context.log.error('Failed to archive payload to S3', {
      messageId: payload.MessageID,
      error: error instanceof Error ? error.message : String(error),
    });
    // Re-throw to fail the activity - archival is mandatory per FR-2
    throw error;
  }
}
