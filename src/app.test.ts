import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ValidationError, type ValidationErrorDetails } from './lib/error-transformers.js';

describe('Global Error Handler', () => {
  let fastify: FastifyInstance;

  beforeEach(() => {
    // Create minimal Fastify instance with just the error handler
    fastify = Fastify({
      logger: false,
    });

    // Add the global error handler (same as in buildTestApp and buildApp)
    fastify.setErrorHandler((error: Error, _request, reply) => {
      // Handle domain validation errors
      if (error instanceof ValidationError) {
        return reply.status(400).send({
          error: error.name,
          message: error.message,
          details: error.details,
        });
      }

      // Handle Fastify validation errors
      if ('validation' in error && error.validation) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: error.message,
          details: error.validation,
        });
      }

      // Handle HTTP errors
      if ('statusCode' in error && error.statusCode) {
        return reply.status(error.statusCode as number).send({
          error: error.name || 'HTTP Error',
          message: error.message,
        });
      }

      // Default error response
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      });
    });
  });

  afterEach(async () => {
    if (fastify) {
      await fastify.close();
    }
  });

  describe('ValidationError handling', () => {
    it('should handle ValidationError with string details', async () => {
      // ARRANGE
      fastify.get('/test-validation-error-string', () => {
        throw new ValidationError('Invalid input provided', 'Field "email" is required');
      });

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/test-validation-error-string',
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        error: 'ValidationError',
        message: 'Invalid input provided',
        details: 'Field "email" is required',
      });
    });

    it('should handle ValidationError with structured details', async () => {
      // ARRANGE
      fastify.get('/test-validation-error-object', () => {
        throw new ValidationError('Validation failed', {
          field: 'email',
          reason: 'Invalid format',
        });
      });

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/test-validation-error-object',
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        error: 'ValidationError',
        message: 'Validation failed',
        details: {
          field: 'email',
          reason: 'Invalid format',
        },
      });
    });

    it('should handle ValidationError without details', async () => {
      // ARRANGE
      fastify.get('/test-validation-error-no-details', () => {
        throw new ValidationError('Something went wrong');
      });

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/test-validation-error-no-details',
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('ValidationError');
      expect(body.message).toBe('Something went wrong');
      // details should be undefined or not present
      expect(body.details).toBeUndefined();
    });

    it('should handle subclasses of ValidationError', async () => {
      // ARRANGE
      class CustomValidationError extends ValidationError {
        constructor(message: string, details?: ValidationErrorDetails) {
          super(message, details);
          this.name = 'CustomValidationError';
        }
      }

      fastify.get('/test-validation-error-subclass', () => {
        throw new CustomValidationError('Custom validation failed', 'Invalid data');
      });

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/test-validation-error-subclass',
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        error: 'CustomValidationError',
        message: 'Custom validation failed',
        details: 'Invalid data',
      });
    });
  });

  describe('Fastify validation error handling', () => {
    it('should handle Fastify validation errors', async () => {
      // ARRANGE
      fastify.post(
        '/test-fastify-validation',
        {
          schema: {
            body: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string' },
              },
            },
          },
        },
        () => {
          return { success: true };
        }
      );

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/test-fastify-validation',
        payload: {}, // Missing required 'name' field
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Validation Error');
      expect(body.message).toBeDefined();
      expect(body.details).toBeDefined();
    });
  });

  describe('HTTP error handling', () => {
    it('should handle errors with statusCode property', async () => {
      // ARRANGE
      fastify.get('/test-http-error', () => {
        const error = new Error('Forbidden') as Error & { statusCode: number };
        error.statusCode = 403;
        throw error;
      });

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/test-http-error',
      });

      // ASSERT
      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Error');
      expect(body.message).toBe('Forbidden');
    });
  });

  describe('Default error handling', () => {
    it('should handle unexpected errors with 500 status', async () => {
      // ARRANGE
      fastify.get('/test-generic-error', () => {
        throw new Error('Something unexpected happened');
      });

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/test-generic-error',
      });

      // ASSERT
      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      });
    });

    it('should handle non-Error objects', async () => {
      // ARRANGE
      fastify.get('/test-non-error', () => {
        // biome-ignore lint/suspicious/noExplicitAny: Testing error handling with non-standard errors
        throw { custom: 'error object' } as any;
      });

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/test-non-error',
      });

      // ASSERT
      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal Server Error');
      expect(body.message).toBe('An unexpected error occurred');
    });
  });

  describe('Error precedence', () => {
    it('should prioritize ValidationError over other properties', async () => {
      // ARRANGE
      class ValidationErrorWithStatus extends ValidationError {
        statusCode = 409;
        constructor(message: string) {
          super(message, 'Conflict details');
          this.name = 'ValidationErrorWithStatus';
        }
      }

      fastify.get('/test-error-precedence', () => {
        throw new ValidationErrorWithStatus('Validation takes precedence');
      });

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/test-error-precedence',
      });

      // ASSERT
      // Should return 400 (ValidationError) not 409 (statusCode)
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('ValidationErrorWithStatus');
      expect(body.details).toBe('Conflict details');
    });
  });
});
