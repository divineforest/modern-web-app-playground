import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostmarkWebhookPayload } from '../../services/postmark-webhook-processor.js';
import { postmarkInboundEmailWorkflow } from './postmark-inbound-email.workflow.js';

// Mock the activity module
const mockArchiveToS3Activity = vi.fn();
const mockExtractCompanyIdActivity = vi.fn();
const mockCreateInvoiceActivity = vi.fn();
const mockProcessWebhookActivity = vi.fn();

vi.mock('@temporalio/workflow', () => ({
  proxyActivities: vi.fn(() => ({
    archiveToS3Activity: mockArchiveToS3Activity,
    extractCompanyIdActivity: mockExtractCompanyIdActivity,
    createInvoiceActivity: mockCreateInvoiceActivity,
    processWebhookActivity: mockProcessWebhookActivity,
  })),
}));

describe('Postmark Inbound Email Workflow', () => {
  const mockPayload: PostmarkWebhookPayload = {
    From: 'test@example.com',
    To: '"Test" <test-token@example.com>',
    OriginalRecipient: 'test-token@example.com',
    Subject: 'Test Email',
    MessageID: 'test-message-123',
    Date: '2024-01-15T14:30:00.000Z',
    Attachments: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Set default successful responses
    mockArchiveToS3Activity.mockResolvedValue('s3-key');
    mockExtractCompanyIdActivity.mockResolvedValue({ companyId: 'company-123' });
    mockCreateInvoiceActivity.mockResolvedValue('invoice-123');
    mockProcessWebhookActivity.mockResolvedValue(undefined);
  });

  it('should complete full workflow when company is found', async () => {
    // ACT
    await postmarkInboundEmailWorkflow(mockPayload);

    // ASSERT - All activities should be called in order
    expect(mockArchiveToS3Activity).toHaveBeenCalledTimes(1);
    expect(mockArchiveToS3Activity).toHaveBeenCalledWith(mockPayload);

    expect(mockExtractCompanyIdActivity).toHaveBeenCalledTimes(1);
    expect(mockExtractCompanyIdActivity).toHaveBeenCalledWith(mockPayload);

    expect(mockCreateInvoiceActivity).toHaveBeenCalledTimes(1);
    expect(mockCreateInvoiceActivity).toHaveBeenCalledWith(mockPayload, 'company-123');

    expect(mockProcessWebhookActivity).toHaveBeenCalledTimes(1);
    expect(mockProcessWebhookActivity).toHaveBeenCalledWith(mockPayload);
  });

  it('should stop after extractCompanyIdActivity when no company found', async () => {
    // ARRANGE - Mock extractCompanyIdActivity to return null (no company)
    mockExtractCompanyIdActivity.mockResolvedValue(null);

    // ACT
    await postmarkInboundEmailWorkflow(mockPayload);

    // ASSERT - Only archive and extract should be called
    expect(mockArchiveToS3Activity).toHaveBeenCalledTimes(1);
    expect(mockExtractCompanyIdActivity).toHaveBeenCalledTimes(1);

    // These should NOT be called when no company is found
    expect(mockCreateInvoiceActivity).not.toHaveBeenCalled();
    expect(mockProcessWebhookActivity).not.toHaveBeenCalled();
  });

  it('should pass companyId from extractCompanyIdActivity to createInvoiceActivity', async () => {
    // ARRANGE
    const testCompanyId = 'test-company-456';
    mockExtractCompanyIdActivity.mockResolvedValue({ companyId: testCompanyId });

    // ACT
    await postmarkInboundEmailWorkflow(mockPayload);

    // ASSERT - createInvoiceActivity should receive the extracted companyId
    expect(mockCreateInvoiceActivity).toHaveBeenCalledWith(mockPayload, testCompanyId);
  });

  it('should propagate errors from archiveToS3Activity', async () => {
    // ARRANGE
    const archiveError = new Error('S3 upload failed');
    mockArchiveToS3Activity.mockRejectedValue(archiveError);

    // ACT & ASSERT
    await expect(postmarkInboundEmailWorkflow(mockPayload)).rejects.toThrow('S3 upload failed');

    // Only archiveToS3Activity should have been called before error
    expect(mockArchiveToS3Activity).toHaveBeenCalledTimes(1);
    expect(mockExtractCompanyIdActivity).not.toHaveBeenCalled();
  });

  it('should propagate errors from extractCompanyIdActivity', async () => {
    // ARRANGE
    const extractError = new Error('Database connection failed');
    mockExtractCompanyIdActivity.mockRejectedValue(extractError);

    // ACT & ASSERT
    await expect(postmarkInboundEmailWorkflow(mockPayload)).rejects.toThrow(
      'Database connection failed'
    );

    // Archive and extract should have been called
    expect(mockArchiveToS3Activity).toHaveBeenCalledTimes(1);
    expect(mockExtractCompanyIdActivity).toHaveBeenCalledTimes(1);
    // Subsequent activities should not be called
    expect(mockCreateInvoiceActivity).not.toHaveBeenCalled();
  });

  it('should propagate errors from createInvoiceActivity', async () => {
    // ARRANGE
    const invoiceError = new Error('Invoice creation failed');
    mockCreateInvoiceActivity.mockRejectedValue(invoiceError);

    // ACT & ASSERT
    await expect(postmarkInboundEmailWorkflow(mockPayload)).rejects.toThrow(
      'Invoice creation failed'
    );

    // All activities up to createInvoice should have been called
    expect(mockArchiveToS3Activity).toHaveBeenCalledTimes(1);
    expect(mockExtractCompanyIdActivity).toHaveBeenCalledTimes(1);
    expect(mockCreateInvoiceActivity).toHaveBeenCalledTimes(1);
    // processWebhook should not be called
    expect(mockProcessWebhookActivity).not.toHaveBeenCalled();
  });
});
