// lib/http.ts
import { logger } from './logger.js'; // assumes you have a pino logger in lib/logger.ts

export interface HttpOptions extends RequestInit {
  logResponseBody?: boolean; // optional flag to log response body
  timeout?: number; // timeout in milliseconds
  retryAttempts?: number; // number of retry attempts
  retryDelayMs?: number; // base delay for retries in milliseconds (used for exponential backoff)
  maxRetryDelayMs?: number; // maximum delay between retries in milliseconds (caps exponential growth)
  retryOnStatus?: number[]; // HTTP status codes that should trigger a retry (e.g., [429, 503])
}

export interface HttpResponse<T = unknown> {
  status: number;
  headers: Headers;
  body: T;
}

export async function http<T = unknown>(
  url: string,
  options: HttpOptions = {}
): Promise<HttpResponse<T>> {
  const {
    logResponseBody = false,
    timeout = 30000, // default 30 second timeout
    retryAttempts = 0, // default no retries
    retryDelayMs = 1000, // default 1 second base delay for exponential backoff
    maxRetryDelayMs = 30000, // default 30 second max delay cap
    retryOnStatus = [], // default no status-based retries
    ...fetchOptions
  } = options;

  return httpWithRetry<T>(
    url,
    { ...fetchOptions, timeout, retryAttempts, retryDelayMs, maxRetryDelayMs, retryOnStatus },
    1,
    logResponseBody
  );
}

async function httpWithRetry<T = unknown>(
  url: string,
  options: HttpOptions & {
    timeout: number;
    retryAttempts: number;
    retryDelayMs: number;
    maxRetryDelayMs: number;
    retryOnStatus: number[];
  },
  attempt: number,
  logResponseBody: boolean
): Promise<HttpResponse<T>> {
  const { timeout, retryAttempts, retryOnStatus, ...fetchOptions } = options;

  const start = Date.now();

  logger.info(
    {
      url,
      method: fetchOptions.method || 'GET',
      options: sanitizeOptions(fetchOptions),
      attempt,
    },
    'HTTP request started'
  );

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const res = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - start;

    let body: unknown;
    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      body = await res.json().catch(() => undefined);
    } else {
      body = await res.text().catch(() => undefined);
    }

    logger.info(
      {
        url,
        method: fetchOptions.method || 'GET',
        status: res.status,
        duration,
        attempt,
        ...(logResponseBody ? { body } : {}),
      },
      'HTTP request finished'
    );

    // Check if we should retry based on status code
    // Retry logic: attempt starts at 1, so with retryAttempts=3, we retry on attempts 1,2,3
    // and give up after attempt 4 (the initial attempt + 3 retries = 4 total attempts)
    if (retryOnStatus.includes(res.status) && attempt <= retryAttempts) {
      logger.warn(
        { url, status: res.status, attempt, retryAttempts, duration },
        'HTTP request returned retryable status code, retrying'
      );
      return retryAfterDelay(url, options, attempt + 1, logResponseBody);
    }

    return {
      status: res.status,
      headers: res.headers,
      body: body as T,
    };
  } catch (err) {
    const duration = Date.now() - start;

    // Handle abort signal (timeout)
    if (err instanceof Error && err.name === 'AbortError') {
      logger.warn({ url, attempt, timeout, duration }, 'HTTP request timeout');

      // Retry logic: attempt starts at 1, so with retryAttempts=3, we retry on attempts 1,2,3
      // and give up after attempt 4 (the initial attempt + 3 retries = 4 total attempts)
      if (attempt <= retryAttempts) {
        logger.info({ url, attempt, retryAttempts }, 'Retrying request after timeout');
        return retryAfterDelay(url, options, attempt + 1, logResponseBody);
      }

      throw new Error(`Request timeout after ${timeout}ms`);
    }

    // Handle network errors with retry logic
    // Retry logic: attempt starts at 1, so with retryAttempts=3, we retry on attempts 1,2,3
    // and give up after attempt 4 (the initial attempt + 3 retries = 4 total attempts)
    if (attempt <= retryAttempts) {
      logger.warn(
        {
          url,
          attempt,
          retryAttempts,
          error: err instanceof Error ? err.message : String(err),
          duration,
        },
        'HTTP request failed, retrying'
      );
      return retryAfterDelay(url, options, attempt + 1, logResponseBody);
    }

    // Max retries reached
    logger.error(
      { url, method: fetchOptions.method || 'GET', duration, attempt, err },
      'HTTP request failed after max retries'
    );
    throw err;
  }
}

/**
 * Calculates exponential backoff delay with full jitter.
 *
 * Formula: random(0, min(maxDelay, baseDelay * 2^(attempt-2)))
 *
 * Full jitter helps prevent thundering herd problems, especially important
 * for rate-limited responses (429).
 *
 * @see https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 */
function calculateBackoffDelay(baseDelayMs: number, maxDelayMs: number, attempt: number): number {
  // For attempt 2 (first retry): 2^0 = 1 → delay = baseDelay
  // For attempt 3 (second retry): 2^1 = 2 → delay = 2 * baseDelay
  // For attempt 4 (third retry): 2^2 = 4 → delay = 4 * baseDelay
  const exponentialDelay = baseDelayMs * 2 ** (attempt - 2);

  // Cap at maximum delay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Apply full jitter: random value between 0 and cappedDelay
  // This spreads out retry attempts to prevent thundering herd
  const jitteredDelay = Math.random() * cappedDelay;

  // Ensure minimum delay of 1ms to avoid immediate retries
  return Math.max(1, Math.floor(jitteredDelay));
}

async function retryAfterDelay<T>(
  url: string,
  options: HttpOptions & {
    timeout: number;
    retryAttempts: number;
    retryDelayMs: number;
    maxRetryDelayMs: number;
    retryOnStatus: number[];
  },
  attempt: number,
  logResponseBody: boolean
): Promise<HttpResponse<T>> {
  const delay = calculateBackoffDelay(options.retryDelayMs, options.maxRetryDelayMs, attempt);
  logger.debug({ delay, attempt, baseDelay: options.retryDelayMs }, 'Retrying request after delay');

  await new Promise((resolve) => setTimeout(resolve, delay));
  return httpWithRetry<T>(url, options, attempt, logResponseBody);
}

// helper: don't log huge/binary payloads
function sanitizeOptions(options: RequestInit): Partial<RequestInit> {
  const clone: Partial<RequestInit> = { ...options };
  if (clone.body && typeof clone.body !== 'string') {
    clone.body = '[non-string body]';
  }
  return clone;
}
