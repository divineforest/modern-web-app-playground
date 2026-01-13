import { createS3StorageService } from '../../../shared/data-access/s3/index.js';
import { createModuleLogger } from '../../../lib/logger.js';
import type { PostmarkWebhookPayload } from './postmark-webhook-processor.js';

const logger = createModuleLogger('email-archiver');

/**
 * Generate S3 key for inbound email payload
 * Format: inbound-emails/{YYYY}/{MM}/{DD}/{MessageID}.json
 * Uses UTC date/time for consistent key generation across timezones
 * @param messageId - Postmark MessageID
 * @param receivedDate - Email received date (defaults to now)
 * @returns S3 key string
 */
export function generateInboundEmailKey(messageId: string, receivedDate?: Date): string {
  const date = receivedDate || new Date();
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  const key = `inbound-emails/${year}/${month}/${day}/${messageId}.json`;

  logger.debug(
    {
      messageId,
      receivedDate: date.toISOString(),
      key,
    },
    'Generated S3 key for inbound email'
  );

  return key;
}

/**
 * Archive inbound email payload to S3
 * Stores the raw, unmodified payload for debugging and audit purposes
 * @param payload - Raw Postmark webhook payload
 * @returns Promise<string> - S3 key where payload was stored
 */
export async function archiveInboundEmailPayload(payload: PostmarkWebhookPayload): Promise<string> {
  const messageId = payload.MessageID;
  const receivedDate = payload.Date ? new Date(payload.Date) : undefined;
  const key = generateInboundEmailKey(messageId, receivedDate);

  logger.info(
    {
      messageId,
      key,
    },
    'Archiving inbound email payload to S3'
  );

  const s3Service = createS3StorageService();

  await s3Service.uploadJson(key, payload, {
    messageId: messageId,
    archivedAt: new Date().toISOString(),
    source: 'postmark-webhook',
  });

  logger.info(
    {
      messageId,
      key,
    },
    'Successfully archived inbound email payload to S3'
  );

  return key;
}
