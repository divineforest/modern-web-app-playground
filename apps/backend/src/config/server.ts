import type { FastifyServerOptions } from 'fastify';
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
 * Enables response validation in non-production to catch contract drift early.
 */
export const tsRestRouterOptions = {
  logInitialization: true,
  responseValidation: env.NODE_ENV !== 'production',
};
