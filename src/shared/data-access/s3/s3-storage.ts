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
   * Upload JSON payload to S3
   * Generic method for storing any JSON data to S3
   * @param key - S3 key (path) where the file will be stored
   * @param payload - JSON-serializable payload to upload
   * @param metadata - Optional metadata to attach to the S3 object
   * @returns Promise<string> - S3 key where payload was stored
   */
  async uploadJson(
    key: string,
    payload: unknown,
    metadata?: Record<string, string>
  ): Promise<string> {
    logger.info(
      {
        key,
        bucketName: this.config.bucketName,
      },
      'Uploading JSON to S3'
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
          Metadata: metadata,
        })
      );

      logger.info(
        {
          key,
          bucketName: this.config.bucketName,
          size: contentBuffer.length,
        },
        'Successfully uploaded JSON to S3'
      );

      return key;
    } catch (error) {
      const errorMessage = `Failed to upload JSON to S3: ${
        error instanceof Error ? error.message : String(error)
      }`;

      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
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
