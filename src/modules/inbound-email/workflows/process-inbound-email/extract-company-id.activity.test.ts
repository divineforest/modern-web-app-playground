import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestCompany } from '../../../../../tests/factories/index.js';
import type { PostmarkWebhookPayload } from '../../services/postmark-webhook-processor.js';
import { extractCompanyIdActivity } from './index.js';

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

describe('Extract Company ID Activity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return companyId when company is found', async () => {
    // ARRANGE
    const company = await createTestCompany({ name: 'Test Company' });
    const billingInboundToken = company.billingInboundToken;

    const postmarkPayload: PostmarkWebhookPayload = {
      From: 'john.customer@example.com',
      To: `"John Customer" <${billingInboundToken}@example.com>`,
      OriginalRecipient: `${billingInboundToken}@example.com`,
      Subject: 'Test Email',
      MessageID: 'test-message-123',
      Date: '2024-01-15T14:30:00.000Z',
      Attachments: [],
    };

    // ACT
    const result = await extractCompanyIdActivity(postmarkPayload);

    // ASSERT
    expect(result).toEqual({ companyId: company.id });
  });

  it('should return null and log warning when no company found', async () => {
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

    // ACT
    const result = await extractCompanyIdActivity(postmarkPayload);

    // ASSERT - Should return null, not throw error
    expect(result).toBeNull();
  });

  it('should return null and log warning when billing token cannot be extracted', async () => {
    // ARRANGE - Invalid email format (no @ sign)
    const postmarkPayload: PostmarkWebhookPayload = {
      From: 'test@example.com',
      To: '"Test" <invalid-email>',
      OriginalRecipient: 'invalid-email',
      Subject: 'Test Invalid Email',
      MessageID: 'test-invalid-email',
      Date: '2024-01-15T14:30:00.000Z',
      Attachments: [],
    };

    // ACT
    const result = await extractCompanyIdActivity(postmarkPayload);

    // ASSERT - Should return null, not throw error
    expect(result).toBeNull();
  });
});
