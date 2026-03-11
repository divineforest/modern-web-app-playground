import { apiContract } from '@mercado/api-contracts';
import * as Sentry from '@sentry/node';
import { generateOpenApi } from '@ts-rest/open-api';
import Fastify from 'fastify';
import { serverConfig } from './config/server.js';
import { authPlugin } from './infra/auth/index.js';
import { registerInfrastructureRoutes } from './infra/index.js';
import { env } from './lib/env.js';
import { ValidationError } from './lib/error-transformers.js';

/**
 * Build and configure the Fastify application
 * This function creates the app instance, registers plugins and routes,
 * but does not start the server
 */
export async function buildApp() {
  // Create Fastify instance with configuration
  const fastify = Fastify(serverConfig);

  // Register cookie support
  await fastify.register(import('@fastify/cookie'));

  // Register CORS
  await fastify.register(import('@fastify/cors'), {
    origin: env.NODE_ENV === 'development', // Allow all origins in dev
    credentials: true,
  });

  // Register Helmet for security headers
  await fastify.register(import('@fastify/helmet'), {
    global: true,
  });

  // Register rate limiting
  await fastify.register(import('@fastify/rate-limit'), {
    max: env.NODE_ENV === 'production' ? 100 : 10000,
    timeWindow: '1 minute',
  });

  // Register raw body plugin for webhook signature verification
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    (req as typeof req & { rawBody?: Buffer }).rawBody = body as Buffer;
    done(null, body);
  });

  fastify.addHook('preHandler', (request, _reply, done) => {
    const rawBody = (request as typeof request & { rawBody?: Buffer }).rawBody;
    if (rawBody && request.body) {
      try {
        request.body = JSON.parse(rawBody.toString('utf8'));
      } catch {
        // If JSON parsing fails, leave body as is
      }
    }
    done();
  });

  // Generate OpenAPI spec from ts-rest contracts (single source of truth)
  // @fastify/swagger is registered as a minimal shell required by @fastify/swagger-ui,
  // but the actual spec is replaced with the ts-rest-generated one via transformSpecification.
  const openApiSpec = generateOpenApi(apiContract, {
    openapi: '3.0.3',
    info: {
      title: 'Mercado E-commerce API',
      description: 'Mercado E-commerce System API',
      version: '1.0.0',
    },
    servers: [
      {
        url: `http://localhost:${env.PORT || 3000}`,
        description: 'Development server',
      },
    ],
  });

  await fastify.register(import('@fastify/swagger'));

  await fastify.register(import('@fastify/swagger-ui'), {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false,
    },
    staticCSP: true,
    transformSpecification: () => openApiSpec,
    transformSpecificationClone: true,
  });

  // Register infrastructure routes (health, metrics, etc.) - UNPROTECTED
  await fastify.register(registerInfrastructureRoutes);

  // Register auth routes - UNPROTECTED (login, register, logout are public; /me requires auth)
  const { registerAuthRoutes } = await import('./modules/auth/index.js');
  await fastify.register(registerAuthRoutes);

  // Register public API routes - UNPROTECTED
  const { registerProductsRoutes } = await import('./modules/products/index.js');
  await fastify.register(registerProductsRoutes);

  // Register cart routes - UNPROTECTED but with optional auth context
  const { registerCartRoutes } = await import('./modules/cart/index.js');
  await fastify.register(registerCartRoutes);

  // Register protected business API routes with authentication
  // All routes registered through this plugin will require API Bearer token authentication
  await fastify.register(async (protectedInstance) => {
    // Apply authentication to all routes in this scope
    await protectedInstance.register(authPlugin);

    // Register business API routes (all protected)
    const { registerOrdersRoutes } = await import('./modules/orders/index.js');
    const { registerCheckoutRoutes } = await import('./modules/checkout/index.js');

    await protectedInstance.register(registerOrdersRoutes);
    await protectedInstance.register(registerCheckoutRoutes);
  });

  // Add global error handler with Sentry integration
  fastify.setErrorHandler((error: Error, request, reply) => {
    // Capture error with Sentry (automatically disabled in development via enabled option)
    Sentry.captureException(error, {
      tags: {
        method: request.method,
        url: request.url,
      },
      user: {
        ip_address: request.ip,
      },
      extra: {
        headers: request.headers,
        params: request.params,
        query: request.query,
      },
    });

    fastify.log.error(error);

    // Handle domain validation errors
    // Note: All database constraint violations are transformed to ValidationError by services
    // using transformDatabaseError() before being thrown. This provides consistent error
    // handling with user-friendly messages mapped from constraint names.
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

  return fastify;
}

/**
 * Create a test-ready Fastify application
 * This is useful for testing where you don't want to start the actual server
 */
export async function buildTestApp() {
  const fastify = Fastify({
    ...serverConfig,
    logger: false, // Disable logging in tests
  });

  // Register cookie support
  await fastify.register(import('@fastify/cookie'));

  // Register only essential plugins for testing
  await fastify.register(import('@fastify/cors'), {
    origin: true,
    credentials: true,
  });

  // Register raw body plugin for webhook signature verification
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    (req as typeof req & { rawBody?: Buffer }).rawBody = body as Buffer;
    done(null, body);
  });

  fastify.addHook('preHandler', (request, _reply, done) => {
    const rawBody = (request as typeof request & { rawBody?: Buffer }).rawBody;
    if (rawBody && request.body) {
      try {
        request.body = JSON.parse(rawBody.toString('utf8'));
      } catch {
        // If JSON parsing fails, leave body as is
      }
    }
    done();
  });

  // Register infrastructure routes - UNPROTECTED
  await fastify.register(registerInfrastructureRoutes);

  // Register auth routes - UNPROTECTED (login, register, logout are public; /me requires auth)
  const { registerAuthRoutes } = await import('./modules/auth/index.js');
  await fastify.register(registerAuthRoutes);

  // Register public API routes - UNPROTECTED
  const { registerProductsRoutes } = await import('./modules/products/index.js');
  await fastify.register(registerProductsRoutes);

  // Register cart routes - UNPROTECTED but with optional auth context
  const { registerCartRoutes } = await import('./modules/cart/index.js');
  await fastify.register(registerCartRoutes);

  // Register webhook routes (external, unprotected)
  await fastify.register(async (webhookInstance) => {
    const { paymentWebhookRoutes } = await import('./modules/payment-webhooks/index.js');
    await webhookInstance.register(paymentWebhookRoutes);
  });

  // Register protected business API routes with authentication
  await fastify.register(async (protectedInstance) => {
    // Apply authentication to all routes in this scope
    await protectedInstance.register(authPlugin);

    // Register business API routes (all protected)
    const { registerOrdersRoutes } = await import('./modules/orders/index.js');
    const { registerCheckoutRoutes } = await import('./modules/checkout/index.js');

    await protectedInstance.register(registerOrdersRoutes);
    await protectedInstance.register(registerCheckoutRoutes);
  });

  // Add global error handler (same as production)
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

  return fastify;
}
