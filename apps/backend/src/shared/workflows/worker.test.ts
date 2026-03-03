/**
 * Tests for Temporal Worker Sentry Integration
 */

import * as Sentry from '@sentry/node';
import type { ActivityExecuteInput } from '@temporalio/worker';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { SentryActivityInterceptor } from './worker.js';

// Mock Sentry
vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
  init: vi.fn(),
}));

// Mock the instrument import
vi.mock('../../instrument.js', () => ({}));

describe('Temporal Worker Sentry Integration', () => {
  let sentryCaptureMock: Mock;
  let interceptor: SentryActivityInterceptor;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    sentryCaptureMock = vi.mocked(Sentry.captureException);
    interceptor = new SentryActivityInterceptor();
  });

  it('should capture activity errors in Sentry while preserving Temporal retry logic', async () => {
    const testError = new Error('Test error for Sentry verification');
    const mockInput = {
      args: ['test-arg'],
      headers: {},
    };

    // Mock next function that throws an error
    const mockNext = vi.fn().mockRejectedValue(testError);

    // Execute the interceptor
    await expect(interceptor.execute(mockInput as ActivityExecuteInput, mockNext)).rejects.toThrow(
      'Test error for Sentry verification'
    );

    // Verify Sentry was called
    expect(sentryCaptureMock).toHaveBeenCalledOnce();
    expect(sentryCaptureMock).toHaveBeenCalledWith(testError, {
      tags: {
        service: 'temporal-worker',
        context: 'activity-execution',
      },
      extra: {
        inputKeys: ['args', 'headers'],
      },
    });

    // Verify the next function was called (interceptor didn't skip the original function)
    expect(mockNext).toHaveBeenCalledWith(mockInput);
  });

  it('should capture different types of errors', async () => {
    const errorTypes = [
      new TypeError('Test TypeError'),
      new RangeError('Test RangeError'),
      new Error('Custom error'),
    ];

    const mockInput = { args: [], headers: {} };

    for (const testError of errorTypes) {
      const mockNext = vi.fn().mockRejectedValue(testError);

      // Execute the interceptor
      await expect(
        interceptor.execute(mockInput as ActivityExecuteInput, mockNext)
      ).rejects.toThrow(testError.message);
    }

    // Verify Sentry was called for each error type
    expect(sentryCaptureMock).toHaveBeenCalledTimes(errorTypes.length);
  });

  it('should not interfere with successful activities', async () => {
    const successResult = 'Activity completed successfully';
    const mockInput = { args: ['test-arg'], headers: {} };

    // Mock next function that returns successfully
    const mockNext = vi.fn().mockResolvedValue(successResult);

    // Execute the interceptor
    const result = await interceptor.execute(mockInput as ActivityExecuteInput, mockNext);

    // Verify successful result is returned
    expect(result).toBe(successResult);

    // Verify the next function was called
    expect(mockNext).toHaveBeenCalledWith(mockInput);

    // Verify Sentry was NOT called for successful activities
    expect(sentryCaptureMock).not.toHaveBeenCalled();
  });

  it('should include input structure in Sentry extra data', async () => {
    const testError = new Error('Test error');
    const mockInput = {
      args: ['arg1', 'arg2'],
      headers: { 'test-header': 'value' },
      customProperty: 'test',
    };

    const mockNext = vi.fn().mockRejectedValue(testError);

    // Execute the interceptor
    await expect(interceptor.execute(mockInput as ActivityExecuteInput, mockNext)).rejects.toThrow(
      'Test error'
    );

    // Verify Sentry was called with input keys in extra data
    expect(sentryCaptureMock).toHaveBeenCalledWith(testError, {
      tags: {
        service: 'temporal-worker',
        context: 'activity-execution',
      },
      extra: {
        inputKeys: ['args', 'headers', 'customProperty'],
      },
    });
  });
});
