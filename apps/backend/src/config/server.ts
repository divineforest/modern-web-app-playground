import { RequestValidationError } from '@ts-rest/fastify';
import type { FastifyReply, FastifyRequest, FastifyServerOptions } from 'fastify';
import { fromError } from 'zod-validation-error';
import { env } from '../lib/env.js';
import { baseLoggerConfig } from '../lib/logger.js';

export const serverConfig: FastifyServerOptions = {
  logger:
    env.NODE_ENV === 'development'
      ? {
          ...baseLoggerConfig,
          transport: {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
              colorize: true,
            },
          },
        }
      : baseLoggerConfig,
  trustProxy: env.NODE_ENV === 'production',
};

export const serverPort = env.PORT || 3000;
export const serverHost = env.HOST || '0.0.0.0';

/**
 * Shared options for ts-rest registerRouter calls.
 * - Response validation in non-production catches contract drift early
 * - Request validation errors formatted via zod-validation-error for clean messages
 */
export const tsRestRouterOptions = {
  logInitialization: true,
  responseValidation: env.NODE_ENV !== 'production',
  requestValidationErrorHandler: (
    err: RequestValidationError,
    _request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const zodError = err.body ?? err.query ?? err.pathParams ?? err.headers;
    const message = zodError ? fromError(zodError).toString() : 'Validation failed';

    reply.status(400).send({ error: message });
  },
};
