import { createModuleLogger } from '../../../lib/logger.js';
import {
  type CoreFileUpload,
  createCoreSdk,
  getCompanyByBillingInboundToken,
} from '../../../shared/data-access/core/index.js';

const logger = createModuleLogger('postmark-webhook-processor');

// Postmark webhook attachment structure - minimal required fields
export interface PostmarkAttachment {
  Name: string; // filename
  Content: string; // base64-encoded content
  ContentType: string; // MIME type for validation
  ContentLength: number; // size in bytes for validation
}

// Postmark webhook payload structure - minimal required fields
export interface PostmarkWebhookPayload {
  MessageID: string; // unique message identifier
  From: string; // sender email address
  To: string; // recipient email address with display name
  OriginalRecipient: string; // clean recipient email address (used for company ID extraction)
  Subject: string; // email subject line
  Date: string; // timestamp when email was received
  Attachments: PostmarkAttachment[]; // array of attachments
}

// Service configuration
export interface AttachmentUploadConfig {
  maxFileSize: number; // bytes
  allowedTypes: string[]; // MIME types
  maxTotalSize: number; // total size of all attachments
  companyId?: string; // extracted from recipient email
}

// Default configuration
const DEFAULT_CONFIG: Omit<AttachmentUploadConfig, 'companyId'> = {
  maxFileSize: 10 * 1024 * 1024, // 10MB default
  allowedTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/gif',
    // Generic binary fallback: email clients may send attachments with this generic MIME type
    // when the actual type is unknown. This is safe because: (1) company ID is required for uploads,
    // (2) only the first attachment is processed, (3) 10MB file size limit is enforced, and
    // (4) downstream Core API validation (with hardcoded 'expence_document' upload type) provides
    // the necessary security checks and file type validation.
    'application/octet-stream',
  ],
  maxTotalSize: 50 * 1024 * 1024, // 50MB total default
};

// Email metadata for logging
export interface EmailMetadata {
  messageId: string;
  from?: string;
  to?: string;
  subject?: string;
  attachmentCount: number;
  companyId?: string;
}

/**
 * Process a Postmark inbound webhook payload
 * @param payload - Postmark webhook payload
 * @param requestHeaders - HTTP request headers for logging
 * @returns Promise<void> - Throws on any processing failure
 */
export async function processWebhook(
  payload: PostmarkWebhookPayload,
  requestHeaders?: Record<string, string | string[] | undefined>
): Promise<void> {
  const emailMetadata = await extractEmailMetadata(payload);
  const config = emailMetadata.companyId ? { companyId: emailMetadata.companyId } : {};

  // Log incoming webhook
  logIncomingWebhook(emailMetadata, requestHeaders);

  // Process attachments with company ID context - throws on failure
  await processAttachments(payload, config);

  logger.info(
    {
      messageId: emailMetadata.messageId,
      attachmentCount: payload.Attachments?.length || 0,
    },
    'Webhook processing completed successfully'
  );
}

/**
 * Extract billing inbound token from recipient email address and look up company ID
 * Expected format: <billing-inbound-token>@something.com
 * @param email - Clean recipient email address (from OriginalRecipient field)
 * @returns Company ID or undefined if not found
 */
async function extractCompanyId(email?: string): Promise<string | undefined> {
  if (!email) return undefined;

  // Split by @ and use the part before @ as billing inbound token
  const parts = email.split('@');
  if (parts.length !== 2) {
    logger.warn({ email }, 'Email does not contain exactly one @ symbol');
    return undefined;
  }

  const billingInboundToken = parts[0];
  if (!billingInboundToken) {
    logger.warn({ email }, 'Billing inbound token is empty');
    return undefined;
  }

  // Convert to lowercase for consistent case-insensitive lookup
  const normalizedToken = billingInboundToken.toLowerCase();

  logger.debug(
    { email, billingInboundToken, normalizedToken },
    'Extracted billing inbound token from email'
  );

  // Look up company by billing inbound token (case-insensitive)
  try {
    const company = await getCompanyByBillingInboundToken(normalizedToken);
    if (company) {
      logger.debug(
        { email, billingInboundToken, normalizedToken, companyId: company.id },
        'Found company for billing inbound token'
      );
      return company.id;
    } else {
      logger.warn(
        { email, billingInboundToken, normalizedToken },
        'No company found for billing inbound token'
      );
      return undefined;
    }
  } catch (error) {
    logger.error(
      {
        email,
        billingInboundToken,
        normalizedToken,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to look up company by billing inbound token'
    );
    return undefined;
  }
}

/**
 * Extract email metadata from payload for logging
 */
async function extractEmailMetadata(payload: PostmarkWebhookPayload): Promise<EmailMetadata> {
  const companyId = await extractCompanyId(payload?.OriginalRecipient);

  return {
    messageId: payload?.MessageID || 'unknown',
    from: payload?.From,
    to: payload?.To,
    subject: payload?.Subject,
    attachmentCount: payload?.Attachments?.length || 0,
    ...(companyId && { companyId }),
  };
}

/**
 * Log incoming webhook with email metadata
 */
function logIncomingWebhook(
  metadata: EmailMetadata,
  headers?: Record<string, string | string[] | undefined>
): void {
  logger.info(
    {
      messageId: metadata.messageId,
      from: metadata.from,
      to: metadata.to,
      subject: metadata.subject,
      attachmentCount: metadata.attachmentCount,
      companyId: metadata.companyId,
      headers,
    },
    '📧 Postmark webhook received'
  );
}

/**
 * Create configuration with defaults
 * @param config - Partial configuration to override defaults
 * @returns Complete configuration object
 */
function createConfig(config?: Partial<AttachmentUploadConfig>): AttachmentUploadConfig {
  const finalConfig: AttachmentUploadConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  logger.debug(
    {
      maxFileSize: finalConfig.maxFileSize,
      allowedTypes: finalConfig.allowedTypes.length,
      maxTotalSize: finalConfig.maxTotalSize,
      companyId: finalConfig.companyId,
    },
    'Attachment upload configuration created'
  );

  return finalConfig;
}

/**
 * Process first attachment only from a Postmark webhook payload
 * @param payload - Postmark webhook payload
 * @param config - Service configuration (optional)
 * @returns Promise<void> - Throws on any processing failure
 */
async function processAttachments(
  payload: PostmarkWebhookPayload,
  config?: Partial<AttachmentUploadConfig>
): Promise<void> {
  const uploadConfig = createConfig(config);
  const { Attachments, MessageID, From, Subject } = payload;

  if (!Attachments || Attachments.length === 0) {
    logger.debug({ MessageID }, 'No attachments to process');
    return;
  }

  // Only process the first attachment
  const firstAttachment = Attachments[0];
  if (!firstAttachment) {
    logger.debug({ MessageID }, 'No first attachment found');
    return;
  }

  logger.info(
    {
      MessageID,
      totalAttachments: Attachments.length,
      processingFirst: firstAttachment.Name,
      from: From,
    },
    'Processing first attachment only (others will be ignored)'
  );

  if (Attachments.length > 1) {
    logger.warn(
      {
        MessageID,
        totalAttachments: Attachments.length,
        ignoredCount: Attachments.length - 1,
      },
      'Multiple attachments found, only processing the first one'
    );
  }

  // Validate file size - throw error if too large
  if (firstAttachment.ContentLength > uploadConfig.maxFileSize) {
    const error = `File size (${firstAttachment.ContentLength} bytes) exceeds limit (${uploadConfig.maxFileSize} bytes)`;
    logger.error(
      {
        filename: firstAttachment.Name,
        size: firstAttachment.ContentLength,
        limit: uploadConfig.maxFileSize,
      },
      error
    );
    throw new Error(error);
  }

  // Process the first attachment - throws on failure
  await processAttachment(
    firstAttachment,
    {
      messageId: MessageID,
      from: From,
      subject: Subject,
      date: payload.Date,
    },
    uploadConfig
  );

  logger.info(
    { MessageID, filename: firstAttachment.Name },
    'First attachment processing completed successfully'
  );
}

/**
 * Process a single attachment
 * @param attachment - Postmark attachment
 * @param emailMetadata - Email context for metadata
 * @param config - Upload configuration
 * @returns Promise<void> - Throws on any processing failure
 */
async function processAttachment(
  attachment: PostmarkAttachment,
  emailMetadata: {
    messageId: string;
    from: string;
    subject: string;
    date: string;
  },
  config: AttachmentUploadConfig
): Promise<void> {
  const coreSdk = createCoreSdk();
  const { Name, Content, ContentType, ContentLength } = attachment;

  logger.debug(
    { filename: Name, contentType: ContentType, size: ContentLength },
    'Processing single attachment'
  );

  // Validate file size
  if (ContentLength > config.maxFileSize) {
    const error = `File size (${ContentLength} bytes) exceeds limit (${config.maxFileSize} bytes)`;
    logger.error({ filename: Name, size: ContentLength, limit: config.maxFileSize }, error);
    throw new Error(error);
  }

  // Validate content type
  if (!config.allowedTypes.includes(ContentType)) {
    const error = `File type '${ContentType}' is not allowed`;
    logger.error(
      {
        filename: Name,
        contentType: ContentType,
        allowedTypes: config.allowedTypes,
      },
      error
    );
    throw new Error(error);
  }

  // Decode base64 content
  let contentBuffer: Buffer;
  try {
    contentBuffer = Buffer.from(Content, 'base64');

    // Verify decoded size matches expected length
    if (contentBuffer.length !== ContentLength) {
      logger.warn(
        {
          filename: Name,
          expectedSize: ContentLength,
          actualSize: contentBuffer.length,
        },
        'Decoded content size mismatch'
      );
    }
  } catch (error) {
    const errorMsg = `Failed to decode base64 content: ${
      error instanceof Error ? error.message : String(error)
    }`;
    logger.error({ filename: Name }, errorMsg);
    throw new Error(errorMsg);
  }

  // Ensure we have a company ID for the upload
  if (!config.companyId) {
    const error = 'Company ID is required for file upload';
    logger.error({ filename: Name }, error);
    throw new Error(error);
  }

  // Prepare file upload data
  const fileUpload: CoreFileUpload = {
    filename: Name,
    contentType: ContentType,
    content: contentBuffer,
    type: 'expence_document',
    companyId: config.companyId,
    externalSource: 'email',
    externalId: emailMetadata.messageId,
  };

  // Upload to Core API - throws on failure
  const uploadResult = await coreSdk.uploadFile(fileUpload);

  logger.info(
    {
      filename: Name,
      fileId: uploadResult.id,
      fileName: uploadResult.fileName,
      mimeType: uploadResult.mimeType,
    },
    'Attachment uploaded successfully'
  );
}
