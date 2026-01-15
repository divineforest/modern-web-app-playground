import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestCompany } from '../../../../../tests/factories/index.js';
import { db } from '../../../../db/index.js';
import type { PostmarkWebhookPayload } from '../../services/postmark-webhook-processor.js';
import { createInvoiceActivity } from './index.js';

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

describe('Create Invoice Activity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create invoice record', async () => {
    // ARRANGE
    const company = await createTestCompany({ name: 'Test Company' });
    const billingInboundToken = company.billingInboundToken;

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

    // ASSERT - Verify invoice was created in database
    expect(invoiceId).toBeTruthy();
    const createdInvoice = await db.query.invoices.findFirst({
      where: (invoice, { eq }) => eq(invoice.id, invoiceId),
    });
    expect(createdInvoice).toBeDefined();
    expect(createdInvoice?.companyId).toBe(company.id);
    expect(createdInvoice?.type).toBe('purchase');
    expect(createdInvoice?.status).toBe('new');
    expect(createdInvoice?.invoiceNumber).toBeNull();
    expect(createdInvoice?.issueDate).toBeNull();
    expect(createdInvoice?.currency).toBeNull();
    expect(createdInvoice?.totalAmount).toBeNull();
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

    // ACT & ASSERT - Activity should fail when company not found
    await expect(createInvoiceActivity(postmarkPayload)).rejects.toThrow(
      'No company found for billing inbound token'
    );
  });

  it('should allow creating multiple invoices with null invoice numbers', async () => {
    // ARRANGE
    const company = await createTestCompany({ name: 'Test Company' });
    const billingInboundToken = company.billingInboundToken;

    const postmarkPayload1: PostmarkWebhookPayload = {
      From: 'test@example.com',
      To: `"Test" <${billingInboundToken}@example.com>`,
      OriginalRecipient: `${billingInboundToken}@example.com`,
      Subject: 'Test Invoice 1',
      MessageID: 'test-invoice-1',
      Date: '2024-01-15T14:30:00.000Z',
      Attachments: [],
    };

    const postmarkPayload2: PostmarkWebhookPayload = {
      From: 'test@example.com',
      To: `"Test" <${billingInboundToken}@example.com>`,
      OriginalRecipient: `${billingInboundToken}@example.com`,
      Subject: 'Test Invoice 2',
      MessageID: 'test-invoice-2',
      Date: '2024-01-15T14:30:00.000Z',
      Attachments: [],
    };

    // ACT - Create two invoices with null invoice numbers
    const invoiceId1 = await createInvoiceActivity(postmarkPayload1);
    const invoiceId2 = await createInvoiceActivity(postmarkPayload2);

    // ASSERT - Both should succeed since null invoice numbers are allowed
    expect(invoiceId1).toBeTruthy();
    expect(invoiceId2).toBeTruthy();
    expect(invoiceId1).not.toBe(invoiceId2);
  });
});
