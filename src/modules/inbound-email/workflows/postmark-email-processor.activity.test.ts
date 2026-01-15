import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestCompany } from '../../../../tests/factories/index.js';
import { server } from '../../../mocks/server.js';
import type { FileUploadResponse } from '../../../shared/data-access/core/index.js';
import type { PostmarkWebhookPayload } from '../services/postmark-webhook-processor.js';
import { processWebhook } from '../services/postmark-webhook-processor.js';
import { createInvoiceActivity } from './process-inbound-email/index.js';

// Mock invoice service
vi.mock('../../../modules/invoices/services/invoices.service.js', () => ({
  createInvoiceService: vi.fn(),
}));

// Mock company repository
vi.mock('../../../shared/data-access/core/companies.repository.js', () => ({
  getCompanyByBillingInboundToken: vi.fn(),
}));

import { createInvoiceService as mockCreateInvoiceService } from '../../../modules/invoices/services/invoices.service.js';
import { getCompanyByBillingInboundToken as mockGetCompanyByBillingInboundToken } from '../../../shared/data-access/core/companies.repository.js';

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

// Request data tracking interface for tests
interface CoreApiRequestData {
  filename: string;
  contentType: string;
  fileSize: number;
  companyId: string | null;
  type: string;
  externalSource: string;
  externalId: string;
  hasApiKey: boolean;
}

describe('Postmark Email Processing Service (via Activity)', () => {
  beforeEach(() => {
    // Clear any previous handlers
    server.resetHandlers();
  });

  it('should process attachments from Postmark webhook and upload them to Core API', async () => {
    const company = await createTestCompany({ name: 'Test Company' });
    const billingInboundToken = company.billingInboundToken;

    // Track Core API calls using real interfaces instead of custom metadata
    const coreApiCalls: Array<{
      request: CoreApiRequestData;
      response: FileUploadResponse;
    }> = [];

    // Set up MSW handler to capture Core API calls for this test
    server.use(
      http.post('*/api/internal/documents', async ({ request }) => {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const type = formData.get('type') as string;
        const externalSource = formData.get('externalSource') as string;
        const externalId = formData.get('externalId') as string;
        const companyId = request.headers.get('companyId');
        const apiKey = request.headers.get('x-api-key');

        // Generate mock file ID and create proper FileUploadResponse
        const mockFileId = `${Math.random().toString(36).substring(2, 15)}-${Math.random()
          .toString(36)
          .substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}-${Math.random()
          .toString(36)
          .substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`;

        const mockResponse: FileUploadResponse = {
          id: mockFileId,
          type: type,
          name: null,
          notes: null,
          fileName: file?.name || 'unknown',
          mimeType: file?.type || 'unknown',
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
        };

        // Track the API call with both request and response data using real interfaces
        coreApiCalls.push({
          request: {
            filename: file?.name || 'unknown',
            contentType: file?.type || 'unknown',
            fileSize: file?.size || 0,
            companyId: companyId,
            type: type,
            externalSource: externalSource,
            externalId: externalId,
            hasApiKey: !!apiKey,
          },
          response: mockResponse,
        });

        return HttpResponse.json(mockResponse);
      })
    );

    // Minimal Postmark inbound webhook payload
    const postmarkPayload: PostmarkWebhookPayload = {
      From: 'john.customer@example.com',
      To: '"John Customer" <test-billing-token@example.com>',
      OriginalRecipient: `${billingInboundToken}@example.com`,
      Subject: 'Invoice Question - Account #12345',
      MessageID: 'b7bc2f4a-e38e-4336-af7d-e6c392c2f817',
      Date: '2024-01-15T14:30:00.000Z',
      Attachments: [
        {
          Name: 'receipt.pdf',
          Content: 'VGVzdCBQREYgcmVjZWlwdA==', // "Test PDF receipt" in base64
          ContentType: 'application/pdf',
          ContentLength: 1234,
        },
        {
          Name: 'invoice-details.docx',
          Content: 'VGVzdCBQREYgcmVjZWlwdA==', // "Test DOCX invoice" in base64
          ContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ContentLength: 5678,
        },
      ],
    };

    // Test the service function that the activity uses - should complete without throwing
    await expect(processWebhook(postmarkPayload)).resolves.toBeUndefined();

    // Verify Core API was called only once (for first attachment only)
    expect(coreApiCalls).toHaveLength(1);

    // Check first attachment data passed to Core API (PDF)
    const apiCall = coreApiCalls[0];
    expect(apiCall).toBeDefined();

    // Verify request data using proper interface
    expect(apiCall?.request.filename).toBe('receipt.pdf');
    expect(apiCall?.request.contentType).toBe('application/pdf');
    expect(apiCall?.request.fileSize).toBeGreaterThan(0);
    expect(apiCall?.request.companyId).toBe(company.id);
    expect(apiCall?.request.type).toBe('expence_document'); // always set to expence_document
    expect(apiCall?.request.externalSource).toBe('email'); // always set to email
    expect(apiCall?.request.externalId).toBe(postmarkPayload.MessageID);
    expect(apiCall?.request.hasApiKey).toBe(true); // API key was provided

    // Verify response data using FileUploadResponse interface
    expect(apiCall?.response.fileName).toBe('receipt.pdf');
    expect(apiCall?.response.mimeType).toBe('application/pdf');
    expect(apiCall?.response.url).toBeTruthy();
    expect(apiCall?.response.id).toBeTruthy();
    expect(apiCall?.response.type).toBe('expence_document');
  });

  it('should handle company not found gracefully when no attachments', async () => {
    const postmarkPayload: PostmarkWebhookPayload = {
      MessageID: 'test-no-company',
      From: 'test@example.com',
      To: '"Test" <nonexistent-token@example.com>',
      OriginalRecipient: 'nonexistent-token@example.com',
      Subject: 'Test',
      Date: '2024-01-15T14:30:00.000Z',
      Attachments: [],
    };

    // Should complete successfully when no attachments to process
    await expect(processWebhook(postmarkPayload)).resolves.toBeUndefined();
  });

  it('should throw error when company not found and has attachments', async () => {
    const postmarkPayload: PostmarkWebhookPayload = {
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

    // Should throw error when company not found but has attachment to process
    await expect(processWebhook(postmarkPayload)).rejects.toThrow(
      'Company ID is required for file upload'
    );
  });

  it('should throw error when attachment processing fails', async () => {
    const company = await createTestCompany({ name: 'Test Company' });
    const billingInboundToken = company.billingInboundToken;

    // Mock Core API to return error
    server.use(
      http.post('*/api/internal/documents', () => {
        return HttpResponse.json({ error: 'Upload failed' }, { status: 500 });
      })
    );

    const postmarkPayload: PostmarkWebhookPayload = {
      From: 'john.customer@example.com',
      To: `"John Customer" <${billingInboundToken}@example.com>`,
      OriginalRecipient: `${billingInboundToken}@example.com`,
      Subject: 'Test Error Handling',
      MessageID: 'test-error-handling',
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

    // Should throw error when Core API upload fails - this triggers Temporal retry
    await expect(processWebhook(postmarkPayload)).rejects.toThrow(
      'File upload failed! status: 500'
    );
  });
});

describe('Create Invoice Activity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.resetHandlers();
  });

  it('should create invoice record', async () => {
    // ARRANGE
    const company = await createTestCompany({ name: 'Test Company' });
    const billingInboundToken = company.billingInboundToken;

    // Mock company lookup for this specific test
    vi.mocked(mockGetCompanyByBillingInboundToken).mockResolvedValueOnce(company);
    vi.mocked(mockCreateInvoiceService).mockResolvedValueOnce({
      id: 'invoice-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      companyId: company.id,
      contactId: null,
      type: 'purchase',
      status: 'draft',
      invoiceNumber: `EMAIL-test-invoice-creation`,
      issueDate: '2026-01-15',
      dueDate: null,
      paidAt: null,
      currency: 'USD',
      totalAmount: '0.00',
      description: null,
    });

    const postmarkPayload: PostmarkWebhookPayload = {
      From: 'john.customer@example.com',
      To: `"John Customer" <${billingInboundToken}@example.com>`,
      OriginalRecipient: `${billingInboundToken}@example.com`,
      Subject: 'Test Invoice Creation',
      MessageID: 'test-invoice-creation',
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
    const invoiceId = await createInvoiceActivity(postmarkPayload);

    // ASSERT - Invoice service should be called with correct data
    expect(vi.mocked(mockCreateInvoiceService)).toHaveBeenCalledWith({
      companyId: company.id,
      type: 'purchase',
      status: 'draft',
      invoiceNumber: `EMAIL-${postmarkPayload.MessageID}`,
      issueDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
      currency: 'USD',
      totalAmount: 0,
    });
    expect(invoiceId).toBe('invoice-123');
  });

  it('should fail activity when company not found', async () => {
    // ARRANGE
    const postmarkPayload: PostmarkWebhookPayload = {
      From: 'test@example.com',
      To: '"Test" <nonexistent-token@example.com>',
      OriginalRecipient: 'nonexistent-token@example.com',
      Subject: 'Test No Company',
      MessageID: 'test-no-company',
      Date: '2024-01-15T14:30:00.000Z',
      Attachments: [],
    };

    // Mock company lookup to return null
    vi.mocked(mockGetCompanyByBillingInboundToken).mockResolvedValueOnce(null);

    // ACT & ASSERT - Activity should fail when company not found
    await expect(createInvoiceActivity(postmarkPayload)).rejects.toThrow(
      'No company found for billing inbound token'
    );
  });

  it('should fail activity when invoice creation fails', async () => {
    // ARRANGE
    const company = await createTestCompany({ name: 'Test Company' });
    const billingInboundToken = company.billingInboundToken;

    // Mock company lookup
    vi.mocked(mockGetCompanyByBillingInboundToken).mockResolvedValueOnce(company);
    // Mock invoice creation to throw error
    vi.mocked(mockCreateInvoiceService).mockRejectedValueOnce(
      new Error('Database connection failed')
    );

    const postmarkPayload: PostmarkWebhookPayload = {
      From: 'test@example.com',
      To: `"Test" <${billingInboundToken}@example.com>`,
      OriginalRecipient: `${billingInboundToken}@example.com`,
      Subject: 'Test Invoice Failure',
      MessageID: 'test-invoice-failure',
      Date: '2024-01-15T14:30:00.000Z',
      Attachments: [],
    };

    // ACT & ASSERT - Activity should fail when invoice creation fails
    await expect(createInvoiceActivity(postmarkPayload)).rejects.toThrow(
      'Database connection failed'
    );
  });
});
