import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, it } from 'vitest';
import type { PostmarkWebhookPayload } from '../../src/modules/inbound-email/services/postmark-webhook-processor.js';
import { env } from '../../src/lib/env.js';
import { createS3Client, verifyS3Archival } from './helpers/s3.js';
import {
  createTemporalClient,
  verifyWorkflowExecution,
  waitForWorkflow,
} from './helpers/temporal.js';
import { createTestCompany, deleteTestCompany } from './helpers/database.js';

/**
 * Prepare webhook payload with PDF attachment
 */
function prepareWebhookPayload(testToken: string, testMessageId: string): PostmarkWebhookPayload {
  console.log('[SMOKE] Preparing webhook payload...');

  // Read invoice PDF fixture
  const invoicePath = join(process.cwd(), 'tests', 'fixtures', 'Invoice-UJYG5HZG-0007.pdf');
  const invoiceBuffer = readFileSync(invoicePath);
  const invoiceBase64 = invoiceBuffer.toString('base64');
  const invoiceSize = invoiceBuffer.length;

  console.log(
    `[SMOKE] Using real Temporal invoice: Invoice-UJYG5HZG-0007.pdf (${invoiceSize} bytes)`
  );

  return {
    MessageID: testMessageId,
    From: 'AR@temporal.io',
    To: `EasyBiz <${testToken}@example.com>`,
    OriginalRecipient: `${testToken}@example.com`,
    Subject: 'Invoice UJYG5HZG-0007 from Temporal Technologies',
    Date: new Date().toISOString(),
    Attachments: [
      {
        Name: 'Invoice-UJYG5HZG-0007.pdf',
        Content: invoiceBase64,
        ContentType: 'application/pdf',
        ContentLength: invoiceSize,
      },
    ],
  };
}

/**
 * Send webhook and return workflow ID
 */
async function sendWebhookAndGetWorkflowId(
  webhookUrl: string,
  payload: PostmarkWebhookPayload
): Promise<string> {
  console.log('[SMOKE] Sending Postmark webhook...');

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Smoke-Test': 'true',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Webhook request failed: ${response.status} ${response.statusText}\n${errorBody}`
    );
  }

  const responseBody = (await response.json()) as {
    success: boolean;
    workflowId: string;
    messageId: string;
  };

  if (!responseBody.success || !responseBody.workflowId) {
    throw new Error(`No workflow ID in response: ${JSON.stringify(responseBody)}`);
  }

  const workflowId = responseBody.workflowId;
  console.log(`[SMOKE] ✓ Webhook sent, workflow started: ${workflowId}`);

  return workflowId;
}

/**
 * Log test results
 */
function logTestResults(
  workflowId: string,
  testCompanyId: string | null,
  testToken: string,
  testMessageId: string
): void {
  console.log('');
  console.log('[SMOKE] ===================================');
  console.log('[SMOKE] ✅ SMOKE TEST PASSED');
  console.log('[SMOKE] ===================================');
  console.log(`[SMOKE] Workflow ID: ${workflowId}`);
  console.log(`[SMOKE] Company ID: ${testCompanyId}`);
  console.log(`[SMOKE] Billing Token: ${testToken}`);
  console.log(`[SMOKE] Message ID: ${testMessageId}`);
  console.log('');
  console.log('[SMOKE] View workflow in Temporal UI:');
  console.log(`[SMOKE]   http://localhost:8233/namespaces/default/workflows/${workflowId}`);
}

describe('Smoke Tests - Email Intake Workflow', () => {
  // Use the same defaults as vitest.config.smoke.ts
  const host = process.env['HOST'] || 'localhost';
  const port = parseInt(process.env['PORT'] || '3001', 10);
  const serverUrl = `http://${host}:${port}`;
  const webhookUrl = `${serverUrl}/api/v2/webhooks/postmark/inbound`;

  // Test data
  const testToken = `smoke-test-${randomUUID()}`;
  const testMessageId = `smoke-test-${randomUUID()}`;
  let testCompanyId: string | null = null;
  let workflowId: string | null = null;

  // Clients
  let temporalClient: Awaited<ReturnType<typeof createTemporalClient>> | null = null;
  let s3Client: ReturnType<typeof createS3Client> | null = null;

  beforeAll(async () => {
    console.log('[SMOKE] ===================================');
    console.log('[SMOKE] Email Intake Workflow Smoke Test');
    console.log('[SMOKE] ===================================');
    console.log('');
    console.log('[SMOKE] NOTE: This test expects Core API to be unavailable.');
    console.log('[SMOKE] The workflow will fail at file upload stage - this is expected.');
    console.log('');

    // Verify server is accessible
    try {
      const response = await fetch(`${serverUrl}/healthz`, {
        signal: AbortSignal.timeout(1000),
      });
      if (!response.ok) {
        throw new Error(`Server not responding: ${response.status}`);
      }
    } catch {
      throw new Error(
        `Smoke test setup failed - server not accessible at ${serverUrl}. Check setup logs above for infrastructure requirements.`
      );
    }

    // Initialize clients
    temporalClient = await createTemporalClient();
    s3Client = createS3Client();

    // Create test company
    testCompanyId = await createTestCompany(testToken);
  }, 60000);

  afterAll(async () => {
    console.log('[SMOKE] Cleaning up test data...');

    // Delete test company
    if (testCompanyId) {
      try {
        await deleteTestCompany(testCompanyId);
      } catch (error) {
        console.error(
          `[SMOKE] Failed to delete test company: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    // Close Temporal client
    if (temporalClient) {
      try {
        await temporalClient.connection.close();
      } catch (error) {
        console.error(
          `[SMOKE] Failed to close Temporal client: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    console.log('[SMOKE] Cleanup complete');
  }, 10000);

  it('should process email intake workflow end-to-end', async () => {
    if (!temporalClient || !s3Client) {
      throw new Error('Required clients not initialized');
    }

    // ARRANGE: Prepare webhook payload
    const payload = prepareWebhookPayload(testToken, testMessageId);

    // ACT: Send webhook and get workflow ID
    workflowId = await sendWebhookAndGetWorkflowId(webhookUrl, payload);

    // ACT: Wait for workflow to complete or reach expected state
    await waitForWorkflow(temporalClient, workflowId, 60000);

    // ASSERT: Verify workflow executed
    await verifyWorkflowExecution(temporalClient, workflowId);

    // ASSERT: Verify S3 archival
    await verifyS3Archival(s3Client, env.S3_BUCKET_NAME, testMessageId);

    // Log success details
    logTestResults(workflowId, testCompanyId, testToken, testMessageId);
  }, 120000); // 2 minute timeout for E2E workflow
});
