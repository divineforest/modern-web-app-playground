import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestCompany } from '../../../../../tests/factories/index.js';
import { server } from '../../../../mocks/server.js';
import type { PostmarkWebhookPayload } from '../../services/postmark-webhook-processor.js';
import { archiveToS3Activity, createInvoiceActivity, processWebhookActivity } from './index.js';

// Mock email archiver service
vi.mock('../../services/email-archiver.js');

import { archiveInboundEmailPayload as mockArchiveInboundEmailPayload } from '../../services/email-archiver.js';

// Mock company repository
vi.mock('../../../../shared/data-access/core/companies.repository.js', () => ({
  getCompanyByBillingInboundToken: vi.fn(),
}));

import { getCompanyByBillingInboundToken as mockGetCompanyByBillingInboundToken } from '../../../../shared/data-access/core/companies.repository.js';

// Mock invoice service
vi.mock('../../../../modules/invoices/services/invoices.service.js', () => ({
  createInvoiceService: vi.fn(),
}));

import { createInvoiceService as mockCreateInvoiceService } from '../../../../modules/invoices/services/invoices.service.js';

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
    vi.mocked(mockArchiveInboundEmailPayload).mockResolvedValue(
      'inbound-emails/2024/01/15/test-123.json'
    );
    server.resetHandlers();
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

    // ASSERT - Email archiver should be called with payload
    expect(vi.mocked(mockArchiveInboundEmailPayload)).toHaveBeenCalledWith(postmarkPayload);
    expect(s3Key).toBe('inbound-emails/2024/01/15/test-123.json');
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

    // Mock archiver to throw error
    vi.mocked(mockArchiveInboundEmailPayload).mockRejectedValueOnce(
      new Error('S3 connection failed')
    );

    // ACT & ASSERT - Activity should fail when S3 archival fails
    await expect(archiveToS3Activity(postmarkPayload)).rejects.toThrow('S3 connection failed');
  });

  it('should process activities in correct order (integration test)', async () => {
    // ARRANGE
    const company = await createTestCompany({ name: 'Test Company' });
    const billingInboundToken = company.billingInboundToken;

    const executionOrder: string[] = [];

    // Mock company lookup
    vi.mocked(mockGetCompanyByBillingInboundToken).mockResolvedValue(company);

    // Mock archiver to track execution order
    vi.mocked(mockArchiveInboundEmailPayload).mockImplementation(() => {
      executionOrder.push('s3-archive');
      return Promise.resolve('inbound-emails/2024/01/15/test-order.json');
    });

    // Mock invoice creation to track execution order
    vi.mocked(mockCreateInvoiceService).mockImplementation((data) => {
      executionOrder.push('invoice-create');
      return Promise.resolve({
        id: 'invoice-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        companyId: data.companyId,
        contactId: null,
        type: data.type,
        status: data.status || 'draft',
        invoiceNumber: data.invoiceNumber,
        issueDate: data.issueDate,
        dueDate: null,
        paidAt: null,
        currency: data.currency,
        totalAmount: String(data.totalAmount),
        description: null,
      });
    });

    // Mock Core API to track execution order
    server.use(
      http.post('*/api/internal/documents', () => {
        executionOrder.push('core-api-upload');
        return HttpResponse.json({
          id: 'mock-file-id',
          type: 'expence_document',
          name: null,
          notes: null,
          fileName: 'receipt.pdf',
          mimeType: 'application/pdf',
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
          url: 'https://api.example.com/files/mock-file-id',
        });
      })
    );

    const postmarkPayload: PostmarkWebhookPayload = {
      From: 'john.customer@example.com',
      To: `"John Customer" <${billingInboundToken}@example.com>`,
      OriginalRecipient: `${billingInboundToken}@example.com`,
      Subject: 'Test Order',
      MessageID: 'test-order',
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

    // ACT - Call activities in sequence (simulating workflow)
    await archiveToS3Activity(postmarkPayload);
    await createInvoiceActivity(postmarkPayload);
    await processWebhookActivity(postmarkPayload);

    // ASSERT - Activities should execute in correct order
    expect(executionOrder).toEqual(['s3-archive', 'invoice-create', 'core-api-upload']);
  });
});
