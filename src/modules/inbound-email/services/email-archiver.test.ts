import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostmarkWebhookPayload } from './postmark-webhook-processor.js';
import { archiveInboundEmailPayload, generateInboundEmailKey } from './email-archiver.js';

// Mock S3 storage service
const mockUploadJson = vi.fn();
vi.mock('../../../shared/data-access/s3/index.js', () => ({
  createS3StorageService: vi.fn(() => ({
    uploadJson: mockUploadJson,
  })),
}));

describe('Email Archiver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateInboundEmailKey', () => {
    it('should generate correct S3 key with provided date', () => {
      // ARRANGE
      const messageId = 'test-message-123';
      const receivedDate = new Date('2024-01-15T10:30:00Z');

      // ACT
      const key = generateInboundEmailKey(messageId, receivedDate);

      // ASSERT
      expect(key).toBe('inbound-emails/2024/01/15/test-message-123.json');
    });

    it('should generate correct S3 key with current date when not provided', () => {
      // ARRANGE
      const messageId = 'test-message-456';
      const now = new Date('2024-03-20T15:45:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      // ACT
      const key = generateInboundEmailKey(messageId);

      // ASSERT
      expect(key).toBe('inbound-emails/2024/03/20/test-message-456.json');

      // Cleanup
      vi.useRealTimers();
    });

    it('should pad month and day with zeros', () => {
      // ARRANGE
      const messageId = 'test-message-789';
      const receivedDate = new Date('2024-01-05T08:00:00Z');

      // ACT
      const key = generateInboundEmailKey(messageId, receivedDate);

      // ASSERT
      expect(key).toBe('inbound-emails/2024/01/05/test-message-789.json');
    });

    it('should handle different message ID formats', () => {
      // ARRANGE
      const messageId = 'b7bc2f4a-e38e-4336-af7d-e6c392c2f817';
      const receivedDate = new Date('2024-12-31T23:59:59Z');

      // ACT
      const key = generateInboundEmailKey(messageId, receivedDate);

      // ASSERT
      expect(key).toBe('inbound-emails/2024/12/31/b7bc2f4a-e38e-4336-af7d-e6c392c2f817.json');
    });

    it('should use UTC timezone for consistency', () => {
      // ARRANGE - Date that would be different day in non-UTC timezone
      const messageId = 'test-timezone';
      const receivedDate = new Date('2024-01-01T02:00:00+05:00'); // 2023-12-31T21:00:00Z in UTC

      // ACT
      const key = generateInboundEmailKey(messageId, receivedDate);

      // ASSERT - Should use UTC date (2023-12-31), not local date (2024-01-01)
      expect(key).toBe('inbound-emails/2023/12/31/test-timezone.json');
    });
  });

  describe('archiveInboundEmailPayload', () => {
    it('should archive payload with correct key and metadata', async () => {
      // ARRANGE
      const payload: PostmarkWebhookPayload = {
        MessageID: 'test-123',
        From: 'sender@example.com',
        To: 'recipient@example.com',
        OriginalRecipient: 'recipient@example.com',
        Subject: 'Test Email',
        Date: '2024-01-15T10:30:00.000Z',
        Attachments: [],
      };

      mockUploadJson.mockResolvedValue('inbound-emails/2024/01/15/test-123.json');

      // ACT
      const key = await archiveInboundEmailPayload(payload);

      // ASSERT
      expect(key).toBe('inbound-emails/2024/01/15/test-123.json');
      expect(mockUploadJson).toHaveBeenCalledWith(
        'inbound-emails/2024/01/15/test-123.json',
        payload,
        expect.objectContaining({
          messageId: 'test-123',
          source: 'postmark-webhook',
        })
      );
    });

    it('should use current date when payload has no Date field', async () => {
      // ARRANGE
      const payload: PostmarkWebhookPayload = {
        MessageID: 'test-456',
        From: 'sender@example.com',
        To: 'recipient@example.com',
        OriginalRecipient: 'recipient@example.com',
        Subject: 'Test Email',
        Date: '',
        Attachments: [],
      };

      const now = new Date('2024-06-10T12:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      mockUploadJson.mockResolvedValue('inbound-emails/2024/06/10/test-456.json');

      // ACT
      const key = await archiveInboundEmailPayload(payload);

      // ASSERT
      expect(key).toBe('inbound-emails/2024/06/10/test-456.json');

      // Cleanup
      vi.useRealTimers();
    });

    it('should propagate S3 upload errors', async () => {
      // ARRANGE
      const payload: PostmarkWebhookPayload = {
        MessageID: 'test-error',
        From: 'sender@example.com',
        To: 'recipient@example.com',
        OriginalRecipient: 'recipient@example.com',
        Subject: 'Test Email',
        Date: '2024-01-15T10:30:00.000Z',
        Attachments: [],
      };

      const s3Error = new Error('S3 connection failed');
      mockUploadJson.mockRejectedValue(s3Error);

      // ACT & ASSERT
      await expect(archiveInboundEmailPayload(payload)).rejects.toThrow('S3 connection failed');
    });
  });
});
