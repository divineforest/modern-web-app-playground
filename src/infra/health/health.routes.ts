import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../../db/connection.js';
import { env } from '../../lib/env.js';

export const DATABASE_READINESS_TIMEOUT_MS = 5000;

async function executeWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const operationPromise = operation();
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operationPromise, timeoutPromise]);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Database readiness check failed', { cause: error });
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    void operationPromise.catch(() => {
      // Swallow to avoid unhandled rejections when the timeout wins the race.
    });
  }
}

// Cache the package.json to avoid reading it repeatedly
let packageVersion: string | null = null;

async function getVersion(): Promise<string> {
  if (packageVersion !== null) {
    return packageVersion;
  }

  try {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const packagePath = path.resolve(process.cwd(), 'package.json');
    const packageContent = await fs.readFile(packagePath, 'utf-8');
    const packageData = JSON.parse(packageContent) as { version?: string };
    packageVersion = packageData.version || '1.0.0';
    return packageVersion;
  } catch (error) {
    console.warn('Failed to read package.json version:', error);
    packageVersion = '1.0.0';
    return packageVersion;
  }
}

/**
 * Health check routes for infrastructure monitoring.
 *
 * - `/healthz`: liveness probe. Answers "is the process alive?" and must stay fast.
 *   No dependency checks here, because Render uses it to decide when to restart the service.
 * - `/ready`: readiness probe. Answers "can we serve traffic?" and may check dependencies.
 *   We verify database connectivity and return 503 when the app should not get traffic.
 */
export async function healthRoutes(fastify: FastifyInstance) {
  /**
   * Liveness probe - checks if process is alive
   * Used by Render health checks - must be fast and reliable
   */
  fastify.get('/healthz', async (_request, reply) => {
    const version = await getVersion();

    return reply.status(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version,
      environment: env.NODE_ENV,
    });
  });

  /**
   * Readiness probe - checks if app can serve traffic
   * Verifies all critical dependencies are available
   */
  fastify.get('/ready', async (_request, reply) => {
    const checks = {
      database: false,
    };

    // Check database connectivity
    try {
      await executeWithTimeout(
        () =>
          db.transaction(async (tx) => {
            await tx.execute(
              sql.raw(`SET LOCAL statement_timeout = '${DATABASE_READINESS_TIMEOUT_MS}ms'`)
            );
            await tx.execute(sql`SELECT 1`);
          }),
        DATABASE_READINESS_TIMEOUT_MS,
        'Database readiness check timed out'
      );
      checks.database = true;
    } catch (error) {
      fastify.log.error({ err: error }, 'Database readiness check failed');
    }

    // Determine overall readiness
    const isReady = Object.values(checks).every((check) => check);
    const statusCode = isReady ? 200 : 503;

    return reply.status(statusCode).send({
      status: isReady ? 'ready' : 'not_ready',
      checks,
    });
  });
}
