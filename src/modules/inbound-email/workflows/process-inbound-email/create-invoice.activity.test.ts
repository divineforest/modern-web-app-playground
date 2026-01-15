import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestCompany } from '../../../../../tests/factories/index.js';
import { db } from '../../../../db/index.js';
import { invoices } from '../../../../db/schema.js';
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
    expect(createdInvoice?.status).toBe('draft');
    expect(createdInvoice?.invoiceNumber).toBe(`EMAIL-${postmarkPayload.MessageID}`);
    expect(createdInvoice?.issueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD format
    expect(createdInvoice?.currency).toBe('USD');
    expect(createdInvoice?.totalAmount).toBe('0.00');
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

  it('should fail activity when invoice number already exists', async () => {
    // ARRANGE
    const company = await createTestCompany({ name: 'Test Company' });
    const billingInboundToken = company.billingInboundToken;

    const postmarkPayload: PostmarkWebhookPayload = {
      From: 'test@example.com',
      To: `"Test" <${billingInboundToken}@example.com>`,
      OriginalRecipient: `${billingInboundToken}@example.com`,
      Subject: 'Test Invoice Failure',
      MessageID: 'test-duplicate-invoice',
      Date: '2024-01-15T14:30:00.000Z',
      Attachments: [],
    };

    // Create invoice with the same invoice number first
    await db.insert(invoices).values({
      companyId: company.id,
      type: 'purchase',
      status: 'draft',
      invoiceNumber: `EMAIL-${postmarkPayload.MessageID}`,
      issueDate: '2024-01-15',
      currency: 'USD',
      totalAmount: '0.00',
    });

    // ACT & ASSERT - Activity should fail when invoice number already exists
    await expect(createInvoiceActivity(postmarkPayload)).rejects.toThrow();
  });
});
