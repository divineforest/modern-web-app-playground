import { PutObjectCommand } from '@aws-sdk/client-s3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostmarkWebhookPayload } from '../../services/postmark-webhook-processor.js';
import { archiveToS3Activity } from './index.js';

// Mock AWS SDK S3Client
const mockSend = vi.fn();
vi.mock('@aws-sdk/client-s3', async () => {
  const actual = await vi.importActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: class MockS3Client {
      send = mockSend;
    },
  };
});

// Mock Temporal Activity Context
vi.mock('@temporalio/activity', () => ({
  Context: {
    current: vi.fn(() => ({
      log: {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
      },
    })),
  },
}));

describe('Archive to S3 Activity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({});
  });

  it('should archive payload to S3', async () => {
    // ARRANGE
    const postmarkPayload: PostmarkWebhookPayload = {
      From: 'john.customer@example.com',
      To: '"John Customer" <test-token@example.com>',
      OriginalRecipient: 'test-token@example.com',
      Subject: 'Test Email',
      MessageID: 'test-message-123',
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
    const s3Key = await archiveToS3Activity(postmarkPayload);

    // ASSERT - S3 PutObjectCommand should be called with correct key and payload
    expect(mockSend).toHaveBeenCalledTimes(1);
    const putCommand = mockSend.mock.calls[0]?.[0] as PutObjectCommand;
    expect(putCommand).toBeInstanceOf(PutObjectCommand);
    expect(putCommand.input.Key).toBe('inbound-emails/2024/01/15/test-message-123.json');
    expect(putCommand.input.ContentType).toBe('application/json');
    expect(putCommand.input.Metadata).toEqual(
      expect.objectContaining({
        messageId: 'test-message-123',
        source: 'postmark-webhook',
      })
    );
    // Verify payload was serialized correctly
    const body = putCommand.input.Body as Buffer;
    const parsedPayload = JSON.parse(body.toString('utf-8'));
    expect(parsedPayload).toEqual(postmarkPayload);
    expect(s3Key).toBe('inbound-emails/2024/01/15/test-message-123.json');
  });

  it('should fail activity if S3 archival fails', async () => {
    // ARRANGE
    const postmarkPayload: PostmarkWebhookPayload = {
      From: 'test@example.com',
      To: '"Test" <test@example.com>',
      OriginalRecipient: 'test@example.com',
      Subject: 'Test',
      MessageID: 'test-fail-s3',
      Date: '2024-01-15T14:30:00.000Z',
      Attachments: [],
    };

    // Mock S3 send to throw error
    const s3Error = new Error('S3 connection failed');
    mockSend.mockRejectedValueOnce(s3Error);

    // ACT & ASSERT - Activity should fail when S3 archival fails
    await expect(archiveToS3Activity(postmarkPayload)).rejects.toThrow(
      'Failed to upload JSON to S3'
    );
  });
});
