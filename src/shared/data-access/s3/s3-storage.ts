import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../../../lib/env.js';
import { createModuleLogger } from '../../../lib/logger.js';

const logger = createModuleLogger('s3-storage');

// S3 Storage configuration
export interface S3StorageConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint?: string;
  forcePathStyle: boolean;
}

// Error types
export class S3StorageError extends Error {
  constructor(
    message: string,
    public override cause?: unknown
  ) {
    super(message);
    this.name = 'S3StorageError';
  }
}

/**
 * S3 Storage Service - Handles S3 operations for document storage
 */
export class S3StorageService {
  private s3Client: S3Client;
  private config: S3StorageConfig;

  constructor(config?: Partial<S3StorageConfig>) {
    const endpoint = config?.endpoint ?? env.S3_ENDPOINT;
    this.config = {
      region: config?.region ?? env.AWS_REGION,
      accessKeyId: config?.accessKeyId ?? env.AWS_ACCESS_KEY_ID,
      secretAccessKey: config?.secretAccessKey ?? env.AWS_SECRET_ACCESS_KEY,
      bucketName: config?.bucketName ?? env.S3_BUCKET_NAME,
      ...(endpoint && { endpoint }),
      forcePathStyle: config?.forcePathStyle ?? env.S3_FORCE_PATH_STYLE,
    };

    this.s3Client = new S3Client({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
      ...(this.config.endpoint && {
        endpoint: this.config.endpoint,
        forcePathStyle: this.config.forcePathStyle,
      }),
    });

    logger.debug(
      {
        region: this.config.region,
        bucketName: this.config.bucketName,
        endpoint: this.config.endpoint || 'AWS (production)',
        forcePathStyle: this.config.forcePathStyle,
      },
      'S3 Storage Service initialized'
    );
  }

  /**
   * Generate S3 key for inbound email payload
   * Format: inbound-emails/{YYYY}/{MM}/{DD}/{MessageID}.json
   * Uses UTC date/time for consistent key generation across timezones
   * @param messageId - Postmark MessageID
   * @param receivedDate - Email received date (defaults to now)
   * @returns S3 key string
   */
  generateInboundEmailKey(messageId: string, receivedDate?: Date): string {
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
   * @param payload - Raw webhook payload object
   * @param messageId - Postmark MessageID for key generation
   * @param receivedDate - Email received date (optional, defaults to now)
   * @returns Promise<string> - S3 key where payload was stored
   */
  async archiveInboundEmailPayload(
    payload: unknown,
    messageId: string,
    receivedDate?: Date
  ): Promise<string> {
    const key = this.generateInboundEmailKey(messageId, receivedDate);

    logger.info(
      {
        messageId,
        key,
        bucketName: this.config.bucketName,
      },
      'Archiving inbound email payload to S3'
    );

    try {
      // Convert payload to JSON string
      const payloadJson = JSON.stringify(payload, null, 2);
      const contentBuffer = Buffer.from(payloadJson, 'utf-8');

      // Upload to S3
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.config.bucketName,
          Key: key,
          Body: contentBuffer,
          ContentType: 'application/json',
          Metadata: {
            messageId: messageId,
            archivedAt: new Date().toISOString(),
            source: 'postmark-webhook',
          },
        })
      );

      logger.info(
        {
          messageId,
          key,
          bucketName: this.config.bucketName,
          size: contentBuffer.length,
        },
        'Successfully archived inbound email payload to S3'
      );

      return key;
    } catch (error) {
      const errorMessage = `Failed to archive inbound email payload to S3: ${
        error instanceof Error ? error.message : String(error)
      }`;

      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          messageId,
          key,
          bucketName: this.config.bucketName,
        },
        errorMessage
      );

      throw new S3StorageError(errorMessage, error);
    }
  }
}

/**
 * Factory function to create S3 Storage Service instance
 * @param config - S3 Storage configuration
 * @returns S3StorageService instance
 */
export function createS3StorageService(config?: Partial<S3StorageConfig>): S3StorageService {
  return new S3StorageService(config);
}
