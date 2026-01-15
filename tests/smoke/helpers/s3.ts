import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../../../src/lib/env.js';

/**
 * Create S3 client for smoke tests (connects to LocalStack)
 */
export function createS3Client(): S3Client {
  return new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
    ...(env.S3_ENDPOINT && {
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    }),
  });
}

/**
 * Verify that email payload was archived to S3
 */
export async function verifyS3Archival(
  s3Client: S3Client,
  bucketName: string,
  messageId: string
): Promise<void> {
  console.log('[SMOKE] Verifying S3 archival...');

  // Generate expected S3 key (same format as workflow uses)
  const now = new Date();
  const datePath = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${String(now.getUTCDate()).padStart(2, '0')}`;
  const s3Key = `inbound-emails/${datePath}/${messageId}.json`;

  console.log(`[SMOKE] Expected S3 key: s3://${bucketName}/${s3Key}`);

  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
      })
    );

    console.log('[SMOKE] ✓ Payload archived to S3 successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFound') {
      throw new Error(`Payload not found in S3 at: ${s3Key}`);
    }

    throw new Error(
      `Failed to verify S3 archival: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
