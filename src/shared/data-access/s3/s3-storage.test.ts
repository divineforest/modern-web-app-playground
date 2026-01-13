import { PutObjectCommand } from '@aws-sdk/client-s3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { S3StorageError, S3StorageService } from './s3-storage.js';

// Create a mock send function
const mockSend = vi.fn();

// Mock S3Client
vi.mock('@aws-sdk/client-s3', async () => {
  const actual = await vi.importActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: class MockS3Client {
      send = mockSend;
    },
  };
});

describe('S3StorageService', () => {
  let s3Service: S3StorageService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create service with test configuration
    s3Service = new S3StorageService({
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
      bucketName: 'test-bucket',
      endpoint: 'http://localhost:4566',
      forcePathStyle: true,
    });
  });

  describe('generateInboundEmailKey', () => {
    it('should generate correct S3 key with provided date', () => {
      // ARRANGE
      const messageId = 'test-message-123';
      const receivedDate = new Date('2024-01-15T10:30:00Z');

      // ACT
      const key = s3Service.generateInboundEmailKey(messageId, receivedDate);

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
      const key = s3Service.generateInboundEmailKey(messageId);

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
      const key = s3Service.generateInboundEmailKey(messageId, receivedDate);

      // ASSERT
      expect(key).toBe('inbound-emails/2024/01/05/test-message-789.json');
    });

    it('should handle different message ID formats', () => {
      // ARRANGE
      const messageId = 'b7bc2f4a-e38e-4336-af7d-e6c392c2f817';
      const receivedDate = new Date('2024-12-31T23:59:59Z');

      // ACT
      const key = s3Service.generateInboundEmailKey(messageId, receivedDate);

      // ASSERT
      expect(key).toBe('inbound-emails/2024/12/31/b7bc2f4a-e38e-4336-af7d-e6c392c2f817.json');
    });
  });

  describe('archiveInboundEmailPayload', () => {
    it('should successfully archive payload to S3', async () => {
      // ARRANGE
      const payload = {
        MessageID: 'test-123',
        From: 'sender@example.com',
        To: 'recipient@example.com',
        Subject: 'Test Email',
      };
      const messageId = 'test-123';
      const receivedDate = new Date('2024-01-15T10:30:00Z');

      mockSend.mockResolvedValue({});

      // ACT
      const key = await s3Service.archiveInboundEmailPayload(payload, messageId, receivedDate);

      // ASSERT
      expect(key).toBe('inbound-emails/2024/01/15/test-123.json');
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Verify PutObjectCommand was called with correct parameters
      const putCommand = mockSend.mock.calls[0]?.[0] as PutObjectCommand;
      expect(putCommand).toBeInstanceOf(PutObjectCommand);
      expect(putCommand.input.Bucket).toBe('test-bucket');
      expect(putCommand.input.Key).toBe('inbound-emails/2024/01/15/test-123.json');
      expect(putCommand.input.ContentType).toBe('application/json');
      expect(putCommand.input.Metadata?.['messageId']).toBe('test-123');
      expect(putCommand.input.Metadata?.['source']).toBe('postmark-webhook');
    });

    it('should serialize payload as JSON', async () => {
      // ARRANGE
      const payload = {
        MessageID: 'test-456',
        Nested: { data: 'value' },
        Array: [1, 2, 3],
      };
      const messageId = 'test-456';

      mockSend.mockResolvedValue({});

      // ACT
      await s3Service.archiveInboundEmailPayload(payload, messageId);

      // ASSERT
      const putCommand = mockSend.mock.calls[0]?.[0] as PutObjectCommand;
      const body = putCommand.input.Body as Buffer;
      const bodyString = body.toString('utf-8');
      const parsedPayload = JSON.parse(bodyString);

      expect(parsedPayload).toEqual(payload);
    });

    it('should use current date when receivedDate not provided', async () => {
      // ARRANGE
      const payload = { MessageID: 'test-789' };
      const messageId = 'test-789';
      const now = new Date('2024-06-10T12:00:00Z');

      vi.useFakeTimers();
      vi.setSystemTime(now);
      mockSend.mockResolvedValue({});

      // ACT
      const key = await s3Service.archiveInboundEmailPayload(payload, messageId);

      // ASSERT
      expect(key).toBe('inbound-emails/2024/06/10/test-789.json');

      // Cleanup
      vi.useRealTimers();
    });

    it('should throw S3StorageError on S3 failure', async () => {
      // ARRANGE
      const payload = { MessageID: 'test-error' };
      const messageId = 'test-error';
      const s3Error = new Error('S3 connection failed');

      mockSend.mockRejectedValue(s3Error);

      // ACT & ASSERT
      await expect(s3Service.archiveInboundEmailPayload(payload, messageId)).rejects.toThrow(
        S3StorageError
      );
      await expect(s3Service.archiveInboundEmailPayload(payload, messageId)).rejects.toThrow(
        'Failed to archive inbound email payload to S3'
      );
    });

    it('should include error cause in S3StorageError', async () => {
      // ARRANGE
      const payload = { MessageID: 'test-cause' };
      const messageId = 'test-cause';
      const s3Error = new Error('Access denied');

      mockSend.mockRejectedValue(s3Error);

      // ACT & ASSERT
      try {
        await s3Service.archiveInboundEmailPayload(payload, messageId);
        expect.fail('Should have thrown S3StorageError');
      } catch (error) {
        expect(error).toBeInstanceOf(S3StorageError);
        expect((error as S3StorageError).cause).toBe(s3Error);
      }
    });

    it('should handle large payloads', async () => {
      // ARRANGE
      const largePayload = {
        MessageID: 'large-payload',
        Attachments: Array.from({ length: 100 }, (_, i) => ({
          Name: `file-${i}.pdf`,
          Content: 'x'.repeat(1000), // Large base64 content
          ContentType: 'application/pdf',
        })),
      };
      const messageId = 'large-payload';

      mockSend.mockResolvedValue({});

      // ACT
      const key = await s3Service.archiveInboundEmailPayload(largePayload, messageId);

      // ASSERT
      expect(key).toBeTruthy();
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });
});
