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

    const postmarkPayload: PostmarkWebhookPayload = {
      From: 'john.customer@example.com',
      To: '"John Customer" <test-token@example.com>',
      OriginalRecipient: 'test-token@example.com',
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
    const invoiceId = await createInvoiceActivity(postmarkPayload, company.id);

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

  it('should allow creating multiple invoices with null invoice numbers', async () => {
    // ARRANGE
    const company = await createTestCompany({ name: 'Test Company' });

    const postmarkPayload1: PostmarkWebhookPayload = {
      From: 'test@example.com',
      To: '"Test" <test-token@example.com>',
      OriginalRecipient: 'test-token@example.com',
      Subject: 'Test Invoice 1',
      MessageID: 'test-invoice-1',
      Date: '2024-01-15T14:30:00.000Z',
      Attachments: [],
    };

    const postmarkPayload2: PostmarkWebhookPayload = {
      From: 'test@example.com',
      To: '"Test" <test-token@example.com>',
      OriginalRecipient: 'test-token@example.com',
      Subject: 'Test Invoice 2',
      MessageID: 'test-invoice-2',
      Date: '2024-01-15T14:30:00.000Z',
      Attachments: [],
    };

    // ACT - Create two invoices with null invoice numbers
    const invoiceId1 = await createInvoiceActivity(postmarkPayload1, company.id);
    const invoiceId2 = await createInvoiceActivity(postmarkPayload2, company.id);

    // ASSERT - Both should succeed since null invoice numbers are allowed
    expect(invoiceId1).toBeTruthy();
    expect(invoiceId2).toBeTruthy();
    expect(invoiceId1).not.toBe(invoiceId2);
  });
});
