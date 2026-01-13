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

  describe('uploadJson', () => {
    it('should successfully upload JSON to S3', async () => {
      // ARRANGE
      const key = 'test/path/file.json';
      const payload = {
        id: 'test-123',
        data: 'test-data',
      };
      const metadata = {
        testKey: 'testValue',
        source: 'test',
      };

      mockSend.mockResolvedValue({});

      // ACT
      const resultKey = await s3Service.uploadJson(key, payload, metadata);

      // ASSERT
      expect(resultKey).toBe(key);
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Verify PutObjectCommand was called with correct parameters
      const putCommand = mockSend.mock.calls[0]?.[0] as PutObjectCommand;
      expect(putCommand).toBeInstanceOf(PutObjectCommand);
      expect(putCommand.input.Bucket).toBe('test-bucket');
      expect(putCommand.input.Key).toBe(key);
      expect(putCommand.input.ContentType).toBe('application/json');
      expect(putCommand.input.Metadata).toEqual(metadata);
    });

    it('should serialize payload as JSON', async () => {
      // ARRANGE
      const key = 'test/nested.json';
      const payload = {
        id: 'test-456',
        nested: { data: 'value' },
        array: [1, 2, 3],
      };

      mockSend.mockResolvedValue({});

      // ACT
      await s3Service.uploadJson(key, payload);

      // ASSERT
      const putCommand = mockSend.mock.calls[0]?.[0] as PutObjectCommand;
      const body = putCommand.input.Body as Buffer;
      const bodyString = body.toString('utf-8');
      const parsedPayload = JSON.parse(bodyString);

      expect(parsedPayload).toEqual(payload);
    });

    it('should upload without metadata if not provided', async () => {
      // ARRANGE
      const key = 'test/no-metadata.json';
      const payload = { data: 'test' };

      mockSend.mockResolvedValue({});

      // ACT
      await s3Service.uploadJson(key, payload);

      // ASSERT
      const putCommand = mockSend.mock.calls[0]?.[0] as PutObjectCommand;
      expect(putCommand.input.Metadata).toBeUndefined();
    });

    it('should throw S3StorageError on S3 failure', async () => {
      // ARRANGE
      const key = 'test/error.json';
      const payload = { data: 'test' };
      const s3Error = new Error('S3 connection failed');

      mockSend.mockRejectedValue(s3Error);

      // ACT & ASSERT
      await expect(s3Service.uploadJson(key, payload)).rejects.toThrow(S3StorageError);
      await expect(s3Service.uploadJson(key, payload)).rejects.toThrow(
        'Failed to upload JSON to S3'
      );
    });

    it('should include error cause in S3StorageError', async () => {
      // ARRANGE
      const key = 'test/cause.json';
      const payload = { data: 'test' };
      const s3Error = new Error('Access denied');

      mockSend.mockRejectedValue(s3Error);

      // ACT & ASSERT
      try {
        await s3Service.uploadJson(key, payload);
        expect.fail('Should have thrown S3StorageError');
      } catch (error) {
        expect(error).toBeInstanceOf(S3StorageError);
        expect((error as S3StorageError).cause).toBe(s3Error);
      }
    });

    it('should handle large payloads', async () => {
      // ARRANGE
      const key = 'test/large.json';
      const largePayload = {
        items: Array.from({ length: 100 }, (_, i) => ({
          id: `item-${i}`,
          data: 'x'.repeat(1000),
        })),
      };

      mockSend.mockResolvedValue({});

      // ACT
      const resultKey = await s3Service.uploadJson(key, largePayload);

      // ASSERT
      expect(resultKey).toBe(key);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });
});
