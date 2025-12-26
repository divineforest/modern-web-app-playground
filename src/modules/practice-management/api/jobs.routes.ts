import { initServer } from '@ts-rest/fastify';
import type { FastifyInstance } from 'fastify';
import { logger } from '../../../lib/logger.js';
import { JobNotFoundError, JobValidationError, jobsService } from '../services/jobs.service.js';
import { jobsContract } from './jobs.contracts.js';

/**
 * Initialize ts-rest server for type-safe route handling
 */
const s = initServer();

/**
 * Jobs route handlers
 */
const router = s.router(jobsContract, {
  /**
   * Create a new job
   */
  create: async ({ body }) => {
    try {
      const job = await jobsService.create(body);

      return {
        status: 201 as const,
        body: job,
      };
    } catch (error) {
      if (error instanceof JobValidationError) {
        return {
          status: 400 as const,
          body: {
            error: error.message,
            details: error.details,
          },
        };
      }

      logger.error({ error, body }, 'Unexpected error in create job route');
      return {
        status: 500 as const,
        body: {
          error: 'Internal server error',
        },
      };
    }
  },

  /**
   * Get a job by ID
   */
  getById: async ({ params }) => {
    try {
      const job = await jobsService.getById(params.id);

      return {
        status: 200 as const,
        body: job,
      };
    } catch (error) {
      if (error instanceof JobNotFoundError) {
        return {
          status: 404 as const,
          body: {
            error: error.message,
          },
        };
      }

      logger.error({ error, jobId: params.id }, 'Unexpected error in get job by ID route');
      return {
        status: 500 as const,
        body: {
          error: 'Internal server error',
        },
      };
    }
  },

  /**
   * List all jobs
   */
  list: async ({ query }) => {
    try {
      const jobs = await jobsService.list(query);

      return {
        status: 200 as const,
        body: {
          jobs,
        },
      };
    } catch (error) {
      logger.error({ error, query }, 'Unexpected error in list jobs route');
      return {
        status: 500 as const,
        body: {
          error: 'Internal server error',
        },
      };
    }
  },

  /**
   * Update a job by ID
   */
  update: async ({ params, body }) => {
    try {
      const job = await jobsService.update(params.id, body);

      return {
        status: 200 as const,
        body: job,
      };
    } catch (error) {
      if (error instanceof JobNotFoundError) {
        return {
          status: 404 as const,
          body: {
            error: error.message,
          },
        };
      }

      if (error instanceof JobValidationError) {
        return {
          status: 400 as const,
          body: {
            error: error.message,
            details: error.details,
          },
        };
      }

      logger.error({ error, jobId: params.id, body }, 'Unexpected error in update job route');
      return {
        status: 500 as const,
        body: {
          error: 'Internal server error',
        },
      };
    }
  },

  /**
   * Delete a job by ID
   */
  delete: async ({ params }) => {
    try {
      const id = await jobsService.delete(params.id);

      return {
        status: 200 as const,
        body: {
          success: true,
          id,
        },
      };
    } catch (error) {
      if (error instanceof JobNotFoundError) {
        return {
          status: 404 as const,
          body: {
            error: error.message,
          },
        };
      }

      logger.error({ error, jobId: params.id }, 'Unexpected error in delete job route');
      return {
        status: 500 as const,
        body: {
          error: 'Internal server error',
        },
      };
    }
  },
});

/**
 * Register jobs routes with Fastify
 * @param fastify Fastify instance
 */
export async function registerJobsRoutes(fastify: FastifyInstance) {
  await s.registerRouter(jobsContract, router, fastify, {
    logInitialization: true,
  });
}
