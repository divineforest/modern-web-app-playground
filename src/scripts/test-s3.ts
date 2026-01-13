#!/usr/bin/env tsx

/**
 * LocalStack S3 Integration Test Script
 *
 * This script verifies that the S3 integration is working correctly with LocalStack.
 * It performs the following operations:
 * 1. Lists all buckets
 * 2. Uploads a test file
 * 3. Downloads the test file
 * 4. Verifies the content matches
 * 5. Deletes the test file
 * 6. Cleans up
 *
 * Usage:
 *   pnpm test:s3
 *
 * Requirements:
 *   - LocalStack must be running (docker-compose up -d)
 *   - S3_ENDPOINT must be set in .env (e.g., http://localhost:4566)
 */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';

// Configure S3 client with LocalStack support
const s3Client = new S3Client({
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

const TEST_FILE_KEY = `test/test-file-${Date.now()}.txt`;
const TEST_FILE_CONTENT = 'Hello from LocalStack S3! This is a test file.';

/**
 * Test S3 integration by performing basic operations
 */
async function testS3Integration(): Promise<void> {
  logger.info('🚀 Starting LocalStack S3 integration test...');
  logger.info(
    {
      region: env.AWS_REGION,
      endpoint: env.S3_ENDPOINT || 'AWS (production)',
      bucket: env.S3_BUCKET_NAME,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    },
    'Configuration'
  );

  try {
    // Step 1: List all buckets
    logger.info('\n📋 Step 1: Listing all S3 buckets...');
    const listBucketsResponse = await s3Client.send(new ListBucketsCommand({}));
    const bucketNames = listBucketsResponse.Buckets?.map((b) => b.Name) || [];
    logger.info({ buckets: bucketNames }, `Found ${bucketNames.length} bucket(s)`);

    // Verify our bucket exists
    if (!bucketNames.includes(env.S3_BUCKET_NAME)) {
      throw new Error(
        `Bucket '${env.S3_BUCKET_NAME}' not found. Available buckets: ${bucketNames.join(', ')}`
      );
    }
    logger.info(`✅ Bucket '${env.S3_BUCKET_NAME}' exists`);

    // Step 2: Upload a test file
    logger.info(`\n📤 Step 2: Uploading test file '${TEST_FILE_KEY}'...`);
    await s3Client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET_NAME,
        Key: TEST_FILE_KEY,
        Body: TEST_FILE_CONTENT,
        ContentType: 'text/plain',
        Metadata: {
          testTimestamp: new Date().toISOString(),
          testPurpose: 's3-integration-test',
        },
      })
    );
    logger.info('✅ File uploaded successfully');

    // Step 3: List objects in bucket
    logger.info('\n📋 Step 3: Listing objects in bucket...');
    const listObjectsResponse = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: env.S3_BUCKET_NAME,
        Prefix: 'test/',
      })
    );
    const objectKeys = listObjectsResponse.Contents?.map((obj) => obj.Key) || [];
    logger.info(`Found ${objectKeys.length} object(s) with 'test/' prefix`);
    if (!objectKeys.includes(TEST_FILE_KEY)) {
      throw new Error(`Uploaded file '${TEST_FILE_KEY}' not found in bucket`);
    }
    logger.info('✅ File found in bucket');

    // Step 4: Download the test file
    logger.info(`\n📥 Step 4: Downloading test file '${TEST_FILE_KEY}'...`);
    const getObjectResponse = await s3Client.send(
      new GetObjectCommand({
        Bucket: env.S3_BUCKET_NAME,
        Key: TEST_FILE_KEY,
      })
    );

    if (!getObjectResponse.Body) {
      throw new Error('Downloaded file has no body');
    }

    const downloadedContent = await getObjectResponse.Body.transformToString();
    logger.info('✅ File downloaded successfully');
    logger.info(`Content length: ${downloadedContent.length} bytes`);

    // Step 5: Verify content matches
    logger.info('\n🔍 Step 5: Verifying file content...');
    if (downloadedContent !== TEST_FILE_CONTENT) {
      throw new Error(
        `Content mismatch! Expected: "${TEST_FILE_CONTENT}", Got: "${downloadedContent}"`
      );
    }
    logger.info('✅ Content verification passed');

    // Step 6: Delete the test file
    logger.info(`\n🗑️  Step 6: Deleting test file '${TEST_FILE_KEY}'...`);
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: env.S3_BUCKET_NAME,
        Key: TEST_FILE_KEY,
      })
    );
    logger.info('✅ File deleted successfully');

    // Final verification
    logger.info('\n🔍 Final verification: Confirming file was deleted...');
    const finalListResponse = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: env.S3_BUCKET_NAME,
        Prefix: TEST_FILE_KEY,
      })
    );
    const remainingObjects = finalListResponse.Contents?.map((obj) => obj.Key) || [];
    if (remainingObjects.includes(TEST_FILE_KEY)) {
      throw new Error(`File '${TEST_FILE_KEY}' still exists after deletion`);
    }
    logger.info('✅ File deletion confirmed');

    // Success!
    logger.info('\n✨ All tests passed! LocalStack S3 integration is working correctly.');
  } catch (error) {
    logger.error({ error }, '\n❌ Test failed');
    throw error;
  }
}

// Run the test
testS3Integration()
  .then(() => {
    logger.info('\n🎉 S3 integration test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    logger.error({ error }, '\n💥 S3 integration test failed');
    process.exit(1);
  });
