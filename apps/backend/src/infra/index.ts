import type { FastifyInstance } from 'fastify';
import { healthRoutes } from './health/index.js';

/**
 * Register all infrastructure routes
 * These are operational/monitoring endpoints that are separate from business logic
 *
 * Infrastructure routes include:
 * - Health checks (/healthz, /ready)
 * - Future: Metrics endpoints (/metrics)
 * - Future: Readiness/liveness probes for K8s
 */
export async function registerInfrastructureRoutes(fastify: FastifyInstance) {
  // Register health check routes
  await fastify.register(healthRoutes);

  // Future infrastructure routes:
  // await fastify.register(metricsRoutes);
  // await fastify.register(observabilityRoutes);
}
