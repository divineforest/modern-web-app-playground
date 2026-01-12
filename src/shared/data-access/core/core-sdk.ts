import { env } from '../../../lib/env.js';
import { type HttpOptions, http } from '../../../lib/http.js';
import { createModuleLogger } from '../../../lib/logger.js';

const logger = createModuleLogger('core-sdk');

export interface CoreContactUpsert {
  company_id: string;
  source_system: 'odoo';
  source_id: string;
  name: string;
}

// File upload interfaces
export interface CoreFileUpload {
  filename: string;
  contentType: string;
  content: Buffer;
  type: 'expence_document';
  companyId: string;
  externalSource?: string;
  externalId?: string;
}

export interface FileUploadResponse {
  id: string;
  type: string;
  name: string | null;
  notes: string | null;
  fileName: string;
  mimeType: string;
  issueDate: string;
  documentMetadata: unknown;
  bookeepingMetadata: unknown;
  contactId: string | null;
  adminStatus: string;
  recognitionDetails: unknown;
  createdAt: string;
  bobStatus: string | null;
  externalStatus: string | null;
  contact: unknown;
  transactions: unknown[];
  paymentStatus: string;
  potentialDuplicate: unknown;
  potentialTransactions: unknown;
  url: string;
}

export interface FileUploadErrorResponse {
  success: false;
  error: string;
  code: string;
}

// Core SDK configuration
export interface CoreSdkConfig {
  baseUrl: string;
  apiKey: string | undefined;
  timeout: number;
  retryAttempts: number;
  retryDelayMs: number;
}

// Upsert response interface
export interface UpsertResponse {
  success: boolean;
  upserted: number;
  skipped: number;
  errors?: string[];
}

// Error types
export class CoreSdkError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'CoreSdkError';
  }
}

/**
 * Core SDK - Handles all interactions with internal microservice APIs
 */
export class CoreSdk {
  private config: CoreSdkConfig;

  constructor(config?: Partial<CoreSdkConfig>) {
    this.config = {
      baseUrl: config?.baseUrl ?? env.CORE_API_URL,
      apiKey: config?.apiKey ?? env.CORE_API_KEY ?? undefined,
      timeout: config?.timeout ?? env.CORE_API_TIMEOUT,
      retryAttempts: config?.retryAttempts ?? env.CORE_API_RETRY_ATTEMPTS,
      retryDelayMs: config?.retryDelayMs ?? env.CORE_API_RETRY_DELAY_MS,
    };

    logger.debug(
      {
        baseUrl: this.config.baseUrl,
        timeout: this.config.timeout,
        retryAttempts: this.config.retryAttempts,
        hasApiKey: !!this.config.apiKey,
      },
      'Core SDK initialized'
    );
  }

  /**
   * Upload file to Core API internal/documents endpoint
   * @param fileData - File upload data
   * @returns Promise<FileUploadResponse> - Upload operation result
   */
  async uploadFile(fileData: CoreFileUpload): Promise<FileUploadResponse> {
    logger.info(
      {
        filename: fileData.filename,
        contentType: fileData.contentType,
        size: fileData.content.length,
        companyId: fileData.companyId,
        type: fileData.type,
        ...(fileData.externalSource && { externalSource: fileData.externalSource }),
        ...(fileData.externalId && { externalId: fileData.externalId }),
      },
      'Uploading file to core API'
    );

    const url = `${this.config.baseUrl}/api/internal/documents`;

    // Create FormData for multipart/form-data request
    const formData = new FormData();

    // Create a Blob from the buffer
    const blob = new Blob([new Uint8Array(fileData.content)], { type: fileData.contentType });
    formData.append('file', blob, fileData.filename);
    formData.append('type', fileData.type);

    // Add externalSource if provided
    if (fileData.externalSource) {
      formData.append('externalSource', fileData.externalSource);
    }

    // Add externalId if provided
    if (fileData.externalId) {
      formData.append('externalId', fileData.externalId);
    }

    logger.debug(
      { url, filename: fileData.filename, companyId: fileData.companyId },
      'Making file upload request'
    );

    try {
      const httpOptions: HttpOptions = {
        method: 'POST',
        headers: {
          ...(this.config.apiKey && { 'x-api-key': this.config.apiKey }),
          companyId: fileData.companyId,
          // Don't set Content-Type header - let the browser set it with the boundary
        },
        body: formData,
        timeout: this.config.timeout,
        retryAttempts: this.config.retryAttempts,
        retryDelayMs: this.config.retryDelayMs,
      };

      const response = await http<FileUploadResponse | FileUploadErrorResponse>(url, httpOptions);

      if (response.status >= 400) {
        // Try to parse error response
        let errorMessage = `HTTP ${response.status}`;
        if (typeof response.body === 'object' && response.body && 'error' in response.body) {
          const errorResult = response.body;
          errorMessage = errorResult.error || errorMessage;
        }
        throw new CoreSdkError(
          `File upload failed! status: ${response.status}`,
          response.status,
          errorMessage
        );
      }

      const result = response.body as FileUploadResponse;

      // Success is determined by having an 'id' field in the response
      if (!result.id) {
        throw new CoreSdkError(
          'File upload failed: No document ID returned',
          response.status,
          result
        );
      }

      logger.info(
        {
          fileId: result.id,
          fileName: result.fileName,
          mimeType: result.mimeType,
          url: result.url,
        },
        'File upload completed successfully'
      );

      return result;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          url,
          filename: fileData.filename,
        },
        'Failed to upload file'
      );

      // Wrap network errors in CoreSdkError
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Network error')) {
          throw new CoreSdkError(`Network error during file upload: ${error.message}`);
        }
        if (error.message.includes('timeout')) {
          throw new CoreSdkError(`Request timeout during file upload: ${error.message}`);
        }
      }

      throw error;
    }
  }

  /**
   * Upsert contacts batch to internal API
   * @param contacts - Array of contact upsert payloads
   * @returns Promise<UpsertResponse> - Upsert operation results
   */
  async upsertContacts(contacts: CoreContactUpsert[]): Promise<UpsertResponse> {
    logger.info({ count: contacts.length }, 'Upserting contacts batch to core API');

    if (contacts.length === 0) {
      logger.debug('Empty contacts array, skipping API call');
      return {
        success: true,
        upserted: 0,
        skipped: 0,
      };
    }

    const url = `${this.config.baseUrl}/api/v1/contacts/upsert`;
    const requestBody = { contacts };

    logger.debug(
      { url, contactCount: contacts.length, sampleContact: contacts[0] },
      'Making upsert contacts request'
    );

    try {
      const httpOptions: HttpOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
        },
        body: JSON.stringify(requestBody),
        timeout: this.config.timeout,
        retryAttempts: this.config.retryAttempts,
        retryDelayMs: this.config.retryDelayMs,
      };

      const response = await http<UpsertResponse>(url, httpOptions);

      if (response.status >= 400) {
        throw new CoreSdkError(
          `HTTP error! status: ${response.status}`,
          response.status,
          typeof response.body === 'string' ? response.body : JSON.stringify(response.body)
        );
      }

      const result = response.body;

      logger.info(
        {
          upserted: result.upserted,
          skipped: result.skipped,
          hasErrors: !!result.errors?.length,
        },
        'Contacts upsert completed'
      );

      return result;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error), url },
        'Failed to upsert contacts'
      );

      // Wrap network errors in CoreSdkError
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Network error')) {
          throw new CoreSdkError(`Network error during contacts upsert: ${error.message}`);
        }
        if (error.message.includes('timeout')) {
          throw new CoreSdkError(`Request timeout during contacts upsert: ${error.message}`);
        }
      }

      throw error;
    }
  }
}

/**
 * Factory function to create Core SDK instance
 * @param config - Core SDK configuration
 * @returns CoreSdk instance
 */
export function createCoreSdk(config?: Partial<CoreSdkConfig>): CoreSdk {
  return new CoreSdk(config);
}
