import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { server } from '../../../mocks/server.js';
import {
  type CoreContactUpsert,
  type CoreFileUpload,
  CoreSdk,
  CoreSdkError,
  type FileUploadResponse,
  type UpsertResponse,
} from './core-sdk.js';

describe('Core SDK', () => {
  let coreSdk: CoreSdk;

  beforeEach(() => {
    coreSdk = new CoreSdk({
      baseUrl: 'http://localhost:4000',
      apiKey: 'test-key',
      timeout: 5000,
      retryAttempts: 2,
      retryDelayMs: 100,
    });
  });

  describe('upsertContacts', () => {
    it('should successfully upsert contacts', async () => {
      // ARRANGE
      const requestContacts: CoreContactUpsert[] = [
        {
          company_id: 'company_123',
          source_system: 'odoo',
          source_id: '1',
          name: 'John Doe',
        },
        {
          company_id: 'company_123',
          source_system: 'odoo',
          source_id: '2',
          name: 'Jane Smith',
        },
      ];

      const expectedResponse: UpsertResponse = {
        success: true,
        upserted: 2,
        skipped: 0,
      };

      // Mock the API response
      server.use(
        http.post('http://localhost:4000/api/v1/contacts/upsert', async ({ request }) => {
          const body = (await request.json()) as { contacts: CoreContactUpsert[] };
          expect(body.contacts).toEqual(requestContacts);
          return HttpResponse.json(expectedResponse);
        })
      );

      // ACT
      const response = await coreSdk.upsertContacts(requestContacts);

      // ASSERT
      expect(response).toEqual(expectedResponse);
    });

    it('should handle empty contacts array', async () => {
      // ARRANGE
      const requestContacts: CoreContactUpsert[] = [];
      const expectedResponse: UpsertResponse = {
        success: true,
        upserted: 0,
        skipped: 0,
      };

      // ACT
      // no HTTP call should be made for empty array
      const result = await coreSdk.upsertContacts(requestContacts);

      // ASSERT
      expect(result).toEqual(expectedResponse);
    });

    it('should handle partial errors', async () => {
      // ARRANGE
      const requestContacts: CoreContactUpsert[] = [
        {
          company_id: 'company_123',
          source_system: 'odoo',
          source_id: '1',
          name: 'John Doe',
        },
        {
          company_id: 'company_123',
          source_system: 'odoo',
          source_id: '2',
          name: 'Jane Smith',
        },
      ];

      const expectedResponse: UpsertResponse = {
        success: true,
        upserted: 1,
        skipped: 1,
        errors: ['Failed to process contact: validation error'],
      };

      // Mock the API to return partial errors
      server.use(
        http.post('http://localhost:4000/api/v1/contacts/upsert', async ({ request }) => {
          const body = (await request.json()) as { contacts: CoreContactUpsert[] };
          expect(body.contacts).toEqual(requestContacts);
          return HttpResponse.json(expectedResponse);
        })
      );

      // ACT
      const result = await coreSdk.upsertContacts(requestContacts);

      // ASSERT
      expect(result).toEqual(expectedResponse);
    });

    it('should throw CoreSdkError on HTTP error', async () => {
      // ARRANGE
      const requestContacts: CoreContactUpsert[] = [
        {
          company_id: 'company_123',
          source_system: 'odoo',
          source_id: '1',
          name: 'John Doe',
        },
      ];

      // Mock the API to return HTTP 500 error
      server.use(
        http.post('http://localhost:4000/api/v1/contacts/upsert', async ({ request }) => {
          const body = (await request.json()) as { contacts: CoreContactUpsert[] };
          expect(body.contacts).toEqual(requestContacts);
          return new HttpResponse(null, {
            status: 500,
            statusText: 'Internal Server Error',
          });
        })
      );

      // ACT & ASSERT
      await expect(coreSdk.upsertContacts(requestContacts)).rejects.toThrow(CoreSdkError);
      await expect(coreSdk.upsertContacts(requestContacts)).rejects.toThrow(
        'HTTP error! status: 500'
      );
    });

    it('should handle network errors with retries', async () => {
      // ARRANGE
      const requestContacts: CoreContactUpsert[] = [
        {
          company_id: 'company_123',
          source_system: 'odoo',
          source_id: '1',
          name: 'John Doe',
        },
      ];

      const expectedResponse: UpsertResponse = {
        success: true,
        upserted: 1,
        skipped: 0,
      };

      let callCount = 0;
      const originalFetch = global.fetch;

      // Mock network failure on first call, success on retry
      global.fetch = async () => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Network error'); // First call fails
        }
        // Second call succeeds
        return new Response(JSON.stringify(expectedResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      // ACT
      const response = await coreSdk.upsertContacts(requestContacts);

      // ASSERT
      expect(response).toEqual(expectedResponse);
      expect(callCount).toBe(2); // Should retry once and succeed

      // Restore fetch
      global.fetch = originalFetch;
    });

    it('should timeout after configured timeout period', async () => {
      // ARRANGE
      const timeoutCoreSdk = new CoreSdk({
        baseUrl: 'http://localhost:4000',
        apiKey: 'test-key',
        timeout: 100, // Very short timeout for testing
        retryAttempts: 1,
        retryDelayMs: 10,
      });

      const requestContacts: CoreContactUpsert[] = [
        {
          company_id: 'company_123',
          source_system: 'odoo',
          source_id: '1',
          name: 'John Doe',
        },
      ];

      const originalFetch = global.fetch;

      // Mock a slow response that will be aborted
      global.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
        // Check if signal is already aborted
        if (init?.signal?.aborted) {
          const error = new Error('This operation was aborted');
          error.name = 'AbortError';
          throw error;
        }

        // Simulate slow response that should timeout
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            resolve(new Response(JSON.stringify({ success: true })));
          }, 200); // Longer than our 100ms timeout

          // Listen for abort signal
          init?.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            const error = new Error('This operation was aborted');
            error.name = 'AbortError';
            reject(error);
          });
        });
      };

      // ACT & ASSERT
      await expect(timeoutCoreSdk.upsertContacts(requestContacts)).rejects.toThrow(
        'Request timeout'
      );

      // Restore fetch
      global.fetch = originalFetch;
    });
  });

  describe('uploadFile', () => {
    it('should successfully upload a file', async () => {
      // ARRANGE
      const fileData: CoreFileUpload = {
        filename: 'test-document.pdf',
        contentType: 'application/pdf',
        content: Buffer.from('test file content'),
        type: 'expence_document',
        companyId: 'company_123',
      };

      const expectedResponse: FileUploadResponse = {
        id: 'file_abc123',
        type: 'expence_document',
        name: null,
        notes: null,
        fileName: 'test-document.pdf',
        mimeType: 'application/pdf',
        issueDate: '2023-01-01T00:00:00.000Z',
        documentMetadata: null,
        bookeepingMetadata: {},
        contactId: null,
        adminStatus: 'ready',
        recognitionDetails: null,
        createdAt: '2023-01-01T00:00:00.000Z',
        bobStatus: null,
        externalStatus: null,
        contact: null,
        transactions: [],
        paymentStatus: 'waiting_for_payment',
        potentialDuplicate: null,
        potentialTransactions: null,
        url: 'https://api.example.com/files/file_abc123',
      };

      // Mock the API response
      server.use(
        http.post('http://localhost:4000/api/internal/documents', async ({ request }) => {
          const formData = await request.formData();
          const file = formData.get('file') as File | null;
          const type = formData.get('type') as string;
          const companyId = request.headers.get('companyId');
          const apiKey = request.headers.get('x-api-key');

          // Verify form data
          expect(file).toBeTruthy();
          expect(file?.name).toBe('test-document.pdf');
          expect(file?.type).toBe('application/pdf');
          expect(type).toBe('expence_document');

          // Verify headers
          expect(companyId).toBe('company_123');
          expect(apiKey).toBe('test-key');

          return HttpResponse.json(expectedResponse);
        })
      );

      // ACT
      const response = await coreSdk.uploadFile(fileData);

      // ASSERT
      expect(response).toEqual(expectedResponse);
    });

    it('should handle file upload errors', async () => {
      // ARRANGE
      const fileData: CoreFileUpload = {
        filename: 'test-document.pdf',
        contentType: 'application/pdf',
        content: Buffer.from('test file content'),
        type: 'expence_document',
        companyId: 'company_123',
      };

      // Mock error response
      server.use(
        http.post('http://localhost:4000/api/internal/documents', async () => {
          return HttpResponse.json(
            {
              success: false,
              error: 'File too large',
              code: 'FILE_TOO_LARGE',
            },
            { status: 413 }
          );
        })
      );

      // ACT & ASSERT
      await expect(coreSdk.uploadFile(fileData)).rejects.toThrow(CoreSdkError);
    });

    it('should handle network errors during file upload', async () => {
      // ARRANGE
      const fileData: CoreFileUpload = {
        filename: 'test-document.pdf',
        contentType: 'application/pdf',
        content: Buffer.from('test file content'),
        type: 'expence_document',
        companyId: 'company_123',
      };

      // Mock network error
      server.use(
        http.post('http://localhost:4000/api/internal/documents', async () => {
          return HttpResponse.error();
        })
      );

      // ACT & ASSERT
      await expect(coreSdk.uploadFile(fileData)).rejects.toThrow(CoreSdkError);
    });
  });
});
