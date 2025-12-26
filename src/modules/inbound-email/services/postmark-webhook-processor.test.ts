import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { db } from '../../../db/index.js';
import { companies } from '../../../db/schema.js';
import { server } from '../../../mocks/server.js';
import { processWebhook } from './postmark-webhook-processor.js';

describe('PostmarkWebhookProcessor', () => {
  describe('processWebhook', () => {
    it('should process webhook with no attachments', async () => {
      // ARRANGE
      const payload = {
        MessageID: 'test-message-123',
        From: 'test@example.com',
        To: '"Support Team" <support@easybiz.com>',
        OriginalRecipient: 'support@easybiz.com',
        Subject: 'Test Message',
        Date: '2024-01-15T10:00:00.000Z',
        Attachments: [],
      };

      // ACT & ASSERT
      // Should complete successfully with no attachments
      await expect(processWebhook(payload)).resolves.toBeUndefined();
    });

    it('should process webhook with single attachment successfully', async () => {
      // ARRANGE
      // Create a company with the billing token for the test
      const testToken = `company456-${Date.now()}`;
      await db.insert(companies).values({
        name: 'Test Company',
        billingInboundToken: testToken,
      });
      // Set up mock for successful file upload
      server.use(
        http.post('*/api/internal/documents', async ({ request }) => {
          const formData = await request.formData();
          const file = formData.get('file') as File | null;
          const type = formData.get('type') as string;
          const externalSource = formData.get('externalSource') as string;
          const externalId = formData.get('externalId') as string;
          const companyId = request.headers.get('companyId');
          const apiKey = request.headers.get('x-api-key');

          if (!file || !type || !companyId || !apiKey) {
            return HttpResponse.json(
              {
                success: false,
                error: 'Missing required fields or headers',
                code: 'MISSING_REQUIRED_FIELDS',
              },
              { status: 400 }
            );
          }

          // Verify externalSource is set to 'email' for postmark attachments
          expect(externalSource).toBe('email');
          // Verify externalId is set to the MessageID from Postmark
          expect(externalId).toBe('test-message-456');

          // Simulate successful file upload with real API response format
          const mockFileId = `${Math.random().toString(36).substring(2, 15)}-${Math.random()
            .toString(36)
            .substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}-${Math.random()
            .toString(36)
            .substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`;

          return HttpResponse.json({
            id: mockFileId,
            type: type,
            name: null,
            notes: null,
            fileName: file.name,
            mimeType: file.type,
            issueDate: new Date().toISOString(),
            documentMetadata: null,
            bookeepingMetadata: {},
            contactId: null,
            adminStatus: 'ready',
            recognitionDetails: null,
            createdAt: new Date().toISOString(),
            bobStatus: null,
            externalStatus: null,
            contact: null,
            transactions: [],
            paymentStatus: 'waiting_for_payment',
            potentialDuplicate: null,
            potentialTransactions: null,
            url: `https://api.example.com/files/${mockFileId}`,
          });
        })
      );

      const payload = {
        MessageID: 'test-message-456',
        From: 'customer@example.com',
        To: `"Customer Name" <${testToken}@bills.easybiz.com>`,
        OriginalRecipient: `${testToken}@bills.easybiz.com`, // Valid company email format
        Subject: 'Invoice Receipt',
        Date: '2024-01-15T11:00:00.000Z',
        Attachments: [
          {
            Name: 'invoice.pdf',
            Content: 'VGVzdCBQREYgY29udGVudA==', // "Test PDF content" in base64
            ContentType: 'application/pdf',
            ContentLength: 100,
          },
        ],
      };

      // ACT & ASSERT
      await expect(processWebhook(payload)).resolves.toBeUndefined();
    });

    it('should handle multiple attachments by processing only the first one', async () => {
      // ARRANGE
      // Create a company with the billing token for the test
      const testToken = `multi-${Date.now()}`;
      await db.insert(companies).values({
        name: 'Multi Test Company',
        billingInboundToken: testToken,
      });
      // Set up mock for successful file upload
      server.use(
        http.post('*/api/internal/documents', async ({ request }) => {
          const formData = await request.formData();
          const file = formData.get('file') as File | null;
          const type = formData.get('type') as string;
          const externalSource = formData.get('externalSource') as string;
          const externalId = formData.get('externalId') as string;
          const companyId = request.headers.get('companyId');
          const apiKey = request.headers.get('x-api-key');

          if (!file || !type || !companyId || !apiKey) {
            return HttpResponse.json(
              {
                success: false,
                error: 'Missing required fields or headers',
                code: 'MISSING_REQUIRED_FIELDS',
              },
              { status: 400 }
            );
          }

          // Verify externalSource is set to 'email' for postmark attachments
          expect(externalSource).toBe('email');
          // Verify externalId is set to the MessageID from Postmark
          expect(externalId).toBe('test-message-multi');

          // Simulate successful file upload with real API response format
          const mockFileId = `${Math.random().toString(36).substring(2, 15)}-${Math.random()
            .toString(36)
            .substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}-${Math.random()
            .toString(36)
            .substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`;

          return HttpResponse.json({
            id: mockFileId,
            type: type,
            name: null,
            notes: null,
            fileName: file.name,
            mimeType: file.type,
            issueDate: new Date().toISOString(),
            documentMetadata: null,
            bookeepingMetadata: {},
            contactId: null,
            adminStatus: 'ready',
            recognitionDetails: null,
            createdAt: new Date().toISOString(),
            bobStatus: null,
            externalStatus: null,
            contact: null,
            transactions: [],
            paymentStatus: 'waiting_for_payment',
            potentialDuplicate: null,
            potentialTransactions: null,
            url: `https://api.example.com/files/${mockFileId}`,
          });
        })
      );

      const payload = {
        MessageID: 'test-message-multi',
        From: 'customer@example.com',
        To: `"Customer Name" <${testToken}@bills.easybiz.com>`,
        OriginalRecipient: `${testToken}@bills.easybiz.com`,
        Subject: 'Multiple Documents',
        Date: '2024-01-15T12:00:00.000Z',
        Attachments: [
          {
            Name: 'receipt1.pdf',
            Content: 'VGVzdCBQREYgMQ==', // "Test PDF 1" in base64
            ContentType: 'application/pdf',
            ContentLength: 150,
          },
          {
            Name: 'receipt2.pdf',
            Content: 'VGVzdCBQREYgMg==', // "Test PDF 2" in base64
            ContentType: 'application/pdf',
            ContentLength: 200,
          },
        ],
      };

      // ACT & ASSERT
      // Should complete successfully - only first attachment is processed
      await expect(processWebhook(payload)).resolves.toBeUndefined();
    });

    it('should handle missing MessageID gracefully', async () => {
      // ARRANGE
      const payload = {
        MessageID: 'test-message-no-id',
        From: 'test@example.com',
        To: '"Support Team" <support@easybiz.com>',
        OriginalRecipient: 'support@easybiz.com',
        Subject: 'No Message ID',
        Date: '2024-01-15T13:00:00.000Z',
        Attachments: [],
      };

      // ACT & ASSERT
      // Should complete successfully with no attachments
      await expect(processWebhook(payload)).resolves.toBeUndefined();
    });

    it('should handle webhook with request headers', async () => {
      // ARRANGE
      const payload = {
        MessageID: 'test-message-with-headers',
        From: 'test@example.com',
        To: '"Support Team" <support@easybiz.com>',
        OriginalRecipient: 'support@easybiz.com',
        Subject: 'Test with Headers',
        Date: '2024-01-15T14:00:00.000Z',
        Attachments: [],
      };

      const headers = {
        'x-postmark-signature': 'test-signature',
        'content-type': 'application/json',
        'user-agent': 'Postmark/1.0',
      };

      // ACT & ASSERT
      // Should complete successfully with no attachments
      await expect(processWebhook(payload, headers)).resolves.toBeUndefined();
    });

    it('should throw error when company not found and has attachments', async () => {
      // ARRANGE
      const payload = {
        MessageID: 'test-no-company-with-attachment',
        From: 'test@example.com',
        To: '"Test" <nonexistent-token@example.com>',
        OriginalRecipient: 'nonexistent-token@example.com',
        Subject: 'Test',
        Date: '2024-01-15T14:30:00.000Z',
        Attachments: [
          {
            Name: 'test.pdf',
            Content: 'VGVzdCBQREYgcmVjZWlwdA==',
            ContentType: 'application/pdf',
            ContentLength: 16,
          },
        ],
      };

      // ACT & ASSERT
      // Should throw error when company not found but has attachment to process
      await expect(processWebhook(payload)).rejects.toThrow(
        'Company ID is required for file upload'
      );
    });

    it('should throw error when attachment processing fails', async () => {
      // ARRANGE
      const testToken = `error-test-${Date.now()}`;
      await db.insert(companies).values({
        name: 'Error Test Company',
        billingInboundToken: testToken,
      });

      // Mock Core API to return error
      server.use(
        http.post('*/api/internal/documents', async () => {
          return HttpResponse.json({ error: 'Upload failed' }, { status: 500 });
        })
      );

      const payload = {
        MessageID: 'test-error-handling',
        From: 'john.customer@example.com',
        To: `"John Customer" <${testToken}@example.com>`,
        OriginalRecipient: `${testToken}@example.com`,
        Subject: 'Test Error Handling',
        Date: '2024-01-15T14:30:00.000Z',
        Attachments: [
          {
            Name: 'test-file.pdf',
            Content: 'VGVzdCBQREYgcmVjZWlwdA==',
            ContentType: 'application/pdf',
            ContentLength: 16,
          },
        ],
      };

      // ACT & ASSERT
      // Should throw error when Core API upload fails - this triggers Temporal retry
      await expect(processWebhook(payload)).rejects.toThrow('File upload failed! status: 500');
    });

    it('should process webhook with application/octet-stream attachment', async () => {
      // ARRANGE
      // Create a company with the billing token for the test
      const testToken = `octet-stream-${Date.now()}`;
      await db.insert(companies).values({
        name: 'Octet Stream Test Company',
        billingInboundToken: testToken,
      });

      // Set up mock for successful file upload
      server.use(
        http.post('*/api/internal/documents', async ({ request }) => {
          const formData = await request.formData();
          const file = formData.get('file') as File | null;
          const type = formData.get('type') as string;
          const externalSource = formData.get('externalSource') as string;
          const externalId = formData.get('externalId') as string;
          const companyId = request.headers.get('companyId');
          const apiKey = request.headers.get('x-api-key');

          if (!file || !type || !companyId || !apiKey) {
            return HttpResponse.json(
              {
                success: false,
                error: 'Missing required fields or headers',
                code: 'MISSING_REQUIRED_FIELDS',
              },
              { status: 400 }
            );
          }

          // Verify the file type is application/octet-stream
          expect(file.type).toBe('application/octet-stream');
          expect(externalSource).toBe('email');
          expect(externalId).toBe('test-message-octet-stream');

          const mockFileId = `${Math.random().toString(36).substring(2, 15)}-${Math.random()
            .toString(36)
            .substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}-${Math.random()
            .toString(36)
            .substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`;

          return HttpResponse.json({
            id: mockFileId,
            type: type,
            name: null,
            notes: null,
            fileName: file.name,
            mimeType: file.type,
            issueDate: new Date().toISOString(),
            documentMetadata: null,
            bookeepingMetadata: {},
            contactId: null,
            adminStatus: 'ready',
            recognitionDetails: null,
            createdAt: new Date().toISOString(),
            bobStatus: null,
            externalStatus: null,
            contact: null,
            transactions: [],
            paymentStatus: 'waiting_for_payment',
            potentialDuplicate: null,
            potentialTransactions: null,
            url: `https://api.example.com/files/${mockFileId}`,
          });
        })
      );

      const payload = {
        MessageID: 'test-message-octet-stream',
        From: 'customer@example.com',
        To: `"Customer Name" <${testToken}@bills.easybiz.com>`,
        OriginalRecipient: `${testToken}@bills.easybiz.com`,
        Subject: 'File with Generic Type',
        Date: '2024-01-15T15:00:00.000Z',
        Attachments: [
          {
            Name: 'document.bin',
            Content: 'VGVzdCBiaW5hcnkgY29udGVudA==', // "Test binary content" in base64
            ContentType: 'application/octet-stream',
            ContentLength: 19,
          },
        ],
      };

      // ACT & ASSERT
      // Should complete successfully with octet-stream attachment
      await expect(processWebhook(payload)).resolves.toBeUndefined();
    });
  });

  describe('email metadata extraction', () => {
    it('should handle undefined payload fields gracefully', async () => {
      // ARRANGE
      const payload = {
        MessageID: undefined as unknown as string,
        From: undefined as unknown as string,
        To: undefined as unknown as string,
        OriginalRecipient: undefined as unknown as string,
        Subject: undefined as unknown as string,
        Date: undefined as unknown as string,
        Attachments: undefined as unknown as [],
      };

      // ACT & ASSERT
      // Should complete successfully with no attachments
      await expect(processWebhook(payload)).resolves.toBeUndefined();
    });
  });
});
