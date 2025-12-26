import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestApp } from '../../../app.js';

// Mock the createTemporalClient function
vi.mock('../../../shared/workflows/index.js', () => ({
  createTemporalClient: vi.fn().mockResolvedValue({
    workflow: {
      start: vi.fn().mockResolvedValue({
        workflowId: 'postmark-email-test-12345-mock-id',
        result: vi.fn(),
        terminate: vi.fn(),
      }),
    },
    connection: {
      close: vi.fn(),
    },
  }),
  TASK_QUEUE: 'hello-world',
}));

// Import after mocking
import { createTemporalClient } from '../../../shared/workflows/index.js';

// Type definitions for webhook enqueueing response
interface WebhookEnqueueResponse {
  success: boolean;
  messageId: string;
  workflowId: string;
  message: string;
  requestId?: string;
  error?: string;
}

describe('Postmark Webhook Routes - Enqueueing', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    fastify = await buildTestApp();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (fastify) {
      await fastify.close();
    }
  });

  describe('POST /api/v2/webhooks/postmark/inbound', () => {
    it('should enqueue workflow with correct payload and params', async () => {
      // ARRANGE
      const postmarkPayload = {
        MessageID: 'test-message-12345',
        From: 'john.customer@example.com',
        To: '"John Customer" <test-company@example.com>',
        OriginalRecipient: 'test-company@example.com',
        Subject: 'Invoice Question - Account #12345',
        Date: '2024-01-15T14:30:00.000Z',
        Attachments: [
          {
            Name: 'receipt.pdf',
            Content: 'VGVzdCBQREYgcmVjZWlwdA==',
            ContentType: 'application/pdf',
            ContentLength: 1234,
          },
        ],
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v2/webhooks/postmark/inbound',
        headers: { 'Content-Type': 'application/json' },
        payload: postmarkPayload,
      });

      // ASSERT
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload) as WebhookEnqueueResponse;
      expect(body.success).toBe(true);
      expect(body.messageId).toBe('test-message-12345');
      expect(body.workflowId).toBe('postmark-email-test-12345-mock-id');
      expect(body.message).toBe('Email queued for background processing');

      // Verify Temporal client was called correctly
      expect(createTemporalClient).toHaveBeenCalledOnce();

      // Get the mocked client and verify workflow.start was called
      const client = await createTemporalClient();
      expect(client.workflow.start).toHaveBeenCalledWith(expect.any(Function), {
        taskQueue: 'hello-world',
        args: [postmarkPayload],
        workflowId: 'postmark-email-test-message-12345',
      });
    });

    it('should return 500 when Temporal client creation fails', async () => {
      // ARRANGE
      vi.mocked(createTemporalClient).mockRejectedValueOnce(
        new Error('Temporal server unavailable')
      );

      const postmarkPayload = {
        MessageID: 'test-message-error',
        From: 'john.customer@example.com',
        To: '"John Customer" <test-company@example.com>',
        OriginalRecipient: 'test-company@example.com',
        Subject: 'Test Error Handling',
        Date: '2024-01-15T14:30:00.000Z',
        Attachments: [],
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v2/webhooks/postmark/inbound',
        headers: { 'Content-Type': 'application/json' },
        payload: postmarkPayload,
      });

      // ASSERT
      expect(response.statusCode).toBe(500);

      const body = JSON.parse(response.payload) as WebhookEnqueueResponse;
      expect(body.success).toBe(false);
      expect(body.error).toBe('Failed to queue email for processing');
      expect(body.requestId).toBeDefined();
    });

    it('should return 500 when workflow creation fails', async () => {
      // ARRANGE
      const mockClient = {
        workflow: {
          start: vi.fn().mockRejectedValue(new Error('Failed to start workflow')),
        },
        connection: {
          close: vi.fn(),
        },
      } as unknown as Awaited<ReturnType<typeof createTemporalClient>>;

      vi.mocked(createTemporalClient).mockResolvedValueOnce(mockClient);

      const postmarkPayload = {
        MessageID: 'test-workflow-failure',
        From: 'john.customer@example.com',
        To: '"John Customer" <test-company@example.com>',
        OriginalRecipient: 'test-company@example.com',
        Subject: 'Test Workflow Creation Failure',
        Date: '2024-01-15T14:30:00.000Z',
        Attachments: [],
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v2/webhooks/postmark/inbound',
        headers: { 'Content-Type': 'application/json' },
        payload: postmarkPayload,
      });

      // ASSERT
      expect(response.statusCode).toBe(500);

      const body = JSON.parse(response.payload) as WebhookEnqueueResponse;
      expect(body.success).toBe(false);
      expect(body.error).toBe('Failed to queue email for processing');
      expect(body.requestId).toBeDefined();

      // Verify workflow start was attempted
      expect(mockClient.workflow.start).toHaveBeenCalledOnce();
    });

    it('should use MessageID for workflow deduplication', async () => {
      const messageId = 'duplicate-message-test-12345';
      const postmarkPayload = {
        MessageID: messageId,
        From: 'john.customer@example.com',
        To: '"John Customer" <test-company@example.com>',
        OriginalRecipient: 'test-company@example.com',
        Subject: 'Test Deduplication',
        Date: '2024-01-15T14:30:00.000Z',
        Attachments: [],
      };

      // First request should succeed
      const response1 = await fastify.inject({
        method: 'POST',
        url: '/api/v2/webhooks/postmark/inbound',
        headers: { 'Content-Type': 'application/json' },
        payload: postmarkPayload,
      });

      expect(response1.statusCode).toBe(200);
      const body1 = JSON.parse(response1.payload) as WebhookEnqueueResponse;
      expect(body1.success).toBe(true);
      expect(body1.messageId).toBe(messageId);

      // Verify workflow ID format for deduplication
      const client = await createTemporalClient();
      expect(client.workflow.start).toHaveBeenCalledWith(expect.any(Function), {
        taskQueue: 'hello-world',
        args: [postmarkPayload],
        workflowId: `postmark-email-${messageId}`,
      });

      // Second request with same MessageID should also succeed
      // (Temporal handles deduplication internally)
      vi.clearAllMocks();

      const response2 = await fastify.inject({
        method: 'POST',
        url: '/api/v2/webhooks/postmark/inbound',
        headers: { 'Content-Type': 'application/json' },
        payload: postmarkPayload,
      });

      expect(response2.statusCode).toBe(200);
      const body2 = JSON.parse(response2.payload) as WebhookEnqueueResponse;
      expect(body2.success).toBe(true);
      expect(body2.messageId).toBe(messageId);

      // Verify same workflow ID is used for deduplication
      const client2 = await createTemporalClient();
      expect(client2.workflow.start).toHaveBeenCalledWith(expect.any(Function), {
        taskQueue: 'hello-world',
        args: [postmarkPayload],
        workflowId: `postmark-email-${messageId}`,
      });
    });
  });
});
