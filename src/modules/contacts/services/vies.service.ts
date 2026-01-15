/**
 * VIES API service for VAT ID validation via vatcheckapi.com
 */
import { env } from '../../../lib/env.js';
import { type HttpOptions, http } from '../../../lib/http.js';
import { createModuleLogger } from '../../../lib/logger.js';
import type {
  ViesApiResponse,
  ViesRawResponse,
  ViesValidationResult,
} from '../domain/contact.types.js';

const logger = createModuleLogger('vies-service');

/**
 * VIES service configuration
 */
export interface ViesServiceConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelayMs: number;
}

/**
 * Get default VIES service configuration from environment
 */
function getDefaultViesConfig(): ViesServiceConfig {
  return {
    apiKey: env.VIES_API_KEY,
    baseUrl: env.VIES_API_BASE_URL,
    timeout: env.VIES_API_TIMEOUT,
    retryAttempts: env.VIES_API_RETRY_ATTEMPTS,
    retryDelayMs: env.VIES_API_RETRY_DELAY_MS,
  };
}

/**
 * Normalize VAT ID by removing spaces and converting to uppercase
 */
export function normalizeVatId(vatId: string): string {
  return vatId.replace(/\s/g, '').toUpperCase();
}

/**
 * Validate a VAT ID using the VIES API
 *
 * @param vatId - The VAT ID to validate (with country prefix, e.g., 'DE123456789')
 * @param config - Optional configuration override
 * @returns ViesValidationResult with success status and data or error
 */
export async function validateVatId(
  vatId: string,
  config: ViesServiceConfig = getDefaultViesConfig()
): Promise<ViesValidationResult> {
  const normalizedVatId = normalizeVatId(vatId);

  logger.info({ vatId: normalizedVatId }, 'Validating VAT ID with VIES API');

  const url = `${config.baseUrl}/check?vat_number=${encodeURIComponent(normalizedVatId)}`;

  const httpOptions: HttpOptions = {
    method: 'GET',
    headers: {
      apikey: config.apiKey,
      Accept: 'application/json',
    },
    timeout: config.timeout,
    retryAttempts: config.retryAttempts,
    retryDelayMs: config.retryDelayMs,
    retryOnStatus: [429, 500, 502, 503, 504], // Retry on server errors with exponential backoff
  };

  /**
   * Format duration in human-readable format
   */
  const formatDuration = (ms: number): string => {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    const seconds = ms / 1000;
    return seconds % 1 === 0 ? `${seconds}s` : `${seconds.toFixed(2)}s`;
  };

  /**
   * Build the comprehensive rawResponse object for audit purposes
   */
  const buildRawResponse = (
    status: number | undefined,
    body: unknown,
    startMs: number,
    endMs: number
  ): ViesRawResponse => {
    const durationMs = endMs - startMs;
    return {
      vatId: normalizedVatId,
      url,
      status,
      body,
      startMs,
      endMs,
      durationMs,
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
      duration: formatDuration(durationMs),
    };
  };

  const start = Date.now();

  try {
    const response = await http<ViesApiResponse>(url, httpOptions);
    const end = Date.now();
    const rawResponse = buildRawResponse(response.status, response.body, start, end);

    // Handle client errors (4xx) - no retry, return failure immediately
    // Still include rawResponse for audit purposes when available
    if (response.status >= 400 && response.status < 500) {
      logger.warn(
        { vatId: normalizedVatId, status: response.status },
        'VIES API returned client error'
      );
      return {
        success: false,
        error: `VIES API returned status ${response.status}`,
        rawResponse,
      };
    }

    // Handle server errors (5xx) - after retries exhausted
    // Still include rawResponse for audit purposes when available
    if (response.status >= 500) {
      logger.error(
        { vatId: normalizedVatId, status: response.status },
        'VIES API returned server error after retries'
      );
      return {
        success: false,
        error: `VIES API returned status ${response.status}`,
        rawResponse,
      };
    }

    const data = response.body;

    // Check if response body is valid
    if (!data) {
      logger.error(
        { vatId: normalizedVatId, status: response.status },
        'VIES API returned empty or invalid response body'
      );
      return {
        success: false,
        error: 'VIES API returned invalid response',
        rawResponse,
      };
    }

    // Check if format is valid
    if (!data.format_valid) {
      logger.info({ vatId: normalizedVatId }, 'VAT ID format is invalid');
      return {
        success: false,
        error: 'Invalid VAT ID format',
        rawResponse,
      };
    }

    // Check if registration info indicates VAT is registered
    if (!data.registration_info?.is_registered) {
      logger.info({ vatId: normalizedVatId }, 'VAT ID is not registered');
      return {
        success: false,
        error: 'VAT ID is not registered',
        rawResponse,
      };
    }

    logger.info(
      { vatId: normalizedVatId, name: data.registration_info.name },
      'VAT ID validation successful'
    );

    return {
      success: true,
      data: {
        name: data.registration_info.name,
        address: data.registration_info.address,
        countryCode: data.country_code,
        isRegistered: data.registration_info.is_registered,
      },
      rawResponse,
    };
  } catch (error) {
    const end = Date.now();
    const rawResponse = buildRawResponse(undefined, undefined, start, end);

    logger.error(
      { vatId: normalizedVatId, error: error instanceof Error ? error.message : String(error) },
      'VIES API request failed'
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during VIES validation',
      rawResponse,
    };
  }
}
