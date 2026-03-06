import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestApp } from '../../app.js';
import { db } from '../../db/index.js';
import { DATABASE_READINESS_TIMEOUT_MS } from './health.routes.js';

// Type definitions for API responses
interface HealthResponse {
  status: 'ok';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
}

interface ReadyResponse {
  status: 'ready' | 'not_ready';
  checks: {
    database: boolean;
  };
}

describe('Health Routes - Unit Tests', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    // Use the new buildTestApp function for consistent test setup
    fastify = await buildTestApp();
  });

  afterEach(async () => {
    // Clean up mock state between tests
    // Note: vi.useRealTimers() is safe here even after timeout tests because:
    // 1. The timeout test awaits the full request/response cycle before exiting
    // 2. All promises in the request chain have settled by the time we reach this
    // 3. The executeWithTimeout helper's finally block catches any lingering rejections
    // 4. No test pollution occurs because fake timers only affect setTimeout/setInterval
    vi.useRealTimers();
    vi.restoreAllMocks();

    // Clean up the Fastify instance
    if (fastify) {
      await fastify.close();
    }
  });

  describe('GET /healthz', () => {
    it('should return health status with basic information', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/healthz',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as HealthResponse;
      expect(body).toMatchObject({
        status: 'ok',
        version: expect.any(String),
        environment: expect.any(String),
      });

      // Check that timestamp is a valid ISO string
      expect(new Date(body.timestamp)).toBeInstanceOf(Date);
      expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Check that uptime is a positive number
      expect(typeof body.uptime).toBe('number');
      expect(body.uptime).toBeGreaterThan(0);
    });

    it('should return consistent structure on multiple calls', async () => {
      const response1 = await fastify.inject({
        method: 'GET',
        url: '/healthz',
      });
      const response2 = await fastify.inject({
        method: 'GET',
        url: '/healthz',
      });

      expect(response1.statusCode).toBe(200);
      expect(response2.statusCode).toBe(200);

      const body1 = JSON.parse(response1.payload) as HealthResponse;
      const body2 = JSON.parse(response2.payload) as HealthResponse;

      // Version should be the same (cached)
      expect(body1.version).toBe(body2.version);
      expect(body1.environment).toBe(body2.environment);
      expect(body1.status).toBe(body2.status);

      // Uptime should increase (though it may be minimal in inject tests)
      expect(body2.uptime).toBeGreaterThanOrEqual(body1.uptime);
    });

    it('should return proper HTTP headers', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/healthz',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-length']).toBeTruthy();
    });
  });

  describe('GET /ready', () => {
    it('should return ready status with database check', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as ReadyResponse;
      expect(body).toEqual({
        status: 'ready',
        checks: {
          database: true,
        },
      });
    });

    it('should return consistent ready status on multiple calls', async () => {
      const response1 = await fastify.inject({
        method: 'GET',
        url: '/ready',
      });
      const response2 = await fastify.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response1.statusCode).toBe(200);
      expect(response2.statusCode).toBe(200);

      const body1 = JSON.parse(response1.payload) as ReadyResponse;
      const body2 = JSON.parse(response2.payload) as ReadyResponse;

      expect(body1).toEqual(body2);
      expect(body1.status).toBe('ready');
      expect(body1.checks.database).toBe(true);
    });

    it('should report not_ready when the database check fails', async () => {
      const transactionSpy = vi.spyOn(db, 'transaction').mockImplementation(async (callback) => {
        const execute = vi
          .fn<typeof db.execute>()
          .mockResolvedValueOnce(undefined as unknown as Awaited<ReturnType<typeof db.execute>>)
          .mockRejectedValueOnce(new Error('db failure'));

        return await (callback as (tx: { execute: typeof db.execute }) => Promise<unknown>)({
          execute,
        } as unknown as { execute: typeof db.execute });
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(transactionSpy).toHaveBeenCalledTimes(1);
      expect(response.statusCode).toBe(503);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as ReadyResponse;
      expect(body).toEqual({
        status: 'not_ready',
        checks: {
          database: false,
        },
      });
    });

    it('should timeout the database check and return not_ready', async () => {
      vi.useFakeTimers();

      // Create a hanging promise that never resolves to simulate a stuck query.
      // The executeWithTimeout helper's finally block will catch this to prevent unhandled rejections.
      const hangingPromise = new Promise<never>(() => {});
      const transactionSpy = vi.spyOn(db, 'transaction').mockImplementation(async (callback) => {
        const execute = vi
          .fn<typeof db.execute>()
          .mockResolvedValueOnce(undefined as unknown as Awaited<ReturnType<typeof db.execute>>)
          .mockReturnValueOnce(hangingPromise as unknown as ReturnType<typeof db.execute>);

        return await (callback as (tx: { execute: typeof db.execute }) => Promise<unknown>)({
          execute,
        } as unknown as { execute: typeof db.execute });
      });

      // Start the request (which will hang waiting for the database query)
      const readinessRequest = fastify.inject({
        method: 'GET',
        url: '/ready',
      });

      // Advance fake timers to trigger the timeout, then await the response.
      // By the time we reach this point, all promises have settled and there are no
      // lingering microtasks because we await the full request/response cycle.
      // The afterEach hook can safely call vi.useRealTimers() without risk of test pollution.
      await vi.advanceTimersByTimeAsync(DATABASE_READINESS_TIMEOUT_MS);
      const response = await readinessRequest;

      expect(transactionSpy).toHaveBeenCalledTimes(1);
      expect(response.statusCode).toBe(503);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as ReadyResponse;
      expect(body).toEqual({
        status: 'not_ready',
        checks: {
          database: false,
        },
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid routes gracefully', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/invalid-route',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should handle invalid HTTP methods', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/healthz',
      });

      expect(response.statusCode).toBe(404); // Fastify returns 404 for unsupported methods
    });
  });

  describe('Performance', () => {
    it('should respond to health check within reasonable time', async () => {
      const start = Date.now();

      const response = await fastify.inject({
        method: 'GET',
        url: '/healthz',
      });
      const end = Date.now();

      expect(response.statusCode).toBe(200);
      expect(end - start).toBeLessThan(50); // Should respond much faster with inject
    });

    it('should handle concurrent requests', async () => {
      const requests = Array(10)
        .fill(null)
        .map(() =>
          fastify.inject({
            method: 'GET',
            url: '/healthz',
          })
        );

      const responses = await Promise.all(requests);

      for (const response of responses) {
        expect(response.statusCode).toBe(200);
      }
    });
  });

  describe('Route Registration', () => {
    it('should register routes correctly', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/healthz',
      });

      expect(response.statusCode).toBe(200);

      // Verify route is responsive
      const body = JSON.parse(response.payload) as HealthResponse;
      expect(body.status).toBe('ok');
    });
  });
});
