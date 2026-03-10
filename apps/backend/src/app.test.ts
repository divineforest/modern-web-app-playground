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
      fastify.get('/test-validation-error-string', () => {
        throw new ValidationError('Invalid input provided', 'Field "email" is required');
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/test-validation-error-string',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        error: 'ValidationError',
        message: 'Invalid input provided',
        details: 'Field "email" is required',
      });
    });

    it('should handle ValidationError with structured details', async () => {
      fastify.get('/test-validation-error-object', () => {
        throw new ValidationError('Validation failed', {
          field: 'email',
          reason: 'Invalid format',
        });
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/test-validation-error-object',
      });

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
      fastify.get('/test-validation-error-no-details', () => {
        throw new ValidationError('Something went wrong');
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/test-validation-error-no-details',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('ValidationError');
      expect(body.message).toBe('Something went wrong');
      // details should be undefined or not present
      expect(body.details).toBeUndefined();
    });

    it('should handle subclasses of ValidationError', async () => {
      class CustomValidationError extends ValidationError {
        constructor(message: string, details?: ValidationErrorDetails) {
          super(message, details);
          this.name = 'CustomValidationError';
        }
      }

      fastify.get('/test-validation-error-subclass', () => {
        throw new CustomValidationError('Custom validation failed', 'Invalid data');
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/test-validation-error-subclass',
      });

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

      const response = await fastify.inject({
        method: 'POST',
        url: '/test-fastify-validation',
        payload: {}, // Missing required 'name' field
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Validation Error');
      expect(body.message).toBeDefined();
      expect(body.details).toBeDefined();
    });
  });

  describe('HTTP error handling', () => {
    it('should handle errors with statusCode property', async () => {
      fastify.get('/test-http-error', () => {
        const error = new Error('Forbidden') as Error & { statusCode: number };
        error.statusCode = 403;
        throw error;
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/test-http-error',
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Error');
      expect(body.message).toBe('Forbidden');
    });
  });

  describe('Default error handling', () => {
    it('should handle unexpected errors with 500 status', async () => {
      fastify.get('/test-generic-error', () => {
        throw new Error('Something unexpected happened');
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/test-generic-error',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      });
    });

    it('should handle non-Error objects', async () => {
      fastify.get('/test-non-error', () => {
        // Testing error handling with non-standard errors - intentionally throwing non-Error object
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw { custom: 'error object' } as never;
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/test-non-error',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal Server Error');
      expect(body.message).toBe('An unexpected error occurred');
    });
  });

  describe('Error precedence', () => {
    it('should prioritize ValidationError over other properties', async () => {
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

      const response = await fastify.inject({
        method: 'GET',
        url: '/test-error-precedence',
      });

      // Should return 400 (ValidationError) not 409 (statusCode)
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('ValidationErrorWithStatus');
      expect(body.details).toBe('Conflict details');
    });
  });
});
