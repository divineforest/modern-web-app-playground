import { initServer } from '@ts-rest/fastify';
import type { FastifyInstance } from 'fastify';
import {
  JobTemplateNotFoundError,
  JobTemplateValidationError,
  jobTemplatesService,
} from '../services/job-templates.service.js';
import { jobTemplatesContract } from './job-templates.contracts.js';

/**
 * Initialize ts-rest server for type-safe route handling
 */
const s = initServer();

/**
 * Job Templates route handlers
 */
const router = s.router(jobTemplatesContract, {
  /**
   * Create a new job template
   */
  create: async ({ body }) => {
    try {
      const jobTemplate = await jobTemplatesService.create(body);

      return {
        status: 201 as const,
        body: jobTemplate,
      };
    } catch (error) {
      if (error instanceof JobTemplateValidationError) {
        return {
          status: 400 as const,
          body: {
            error: error.message,
            details: error.details,
          },
        };
      }

      return {
        status: 500 as const,
        body: {
          error: 'Internal server error',
        },
      };
    }
  },

  /**
   * Get a job template by ID
   */
  getById: async ({ params }) => {
    try {
      const jobTemplate = await jobTemplatesService.getById(params.id);

      return {
        status: 200 as const,
        body: jobTemplate,
      };
    } catch (error) {
      if (error instanceof JobTemplateNotFoundError) {
        return {
          status: 404 as const,
          body: {
            error: error.message,
          },
        };
      }

      return {
        status: 500 as const,
        body: {
          error: 'Internal server error',
        },
      };
    }
  },

  /**
   * List all job templates
   */
  list: async ({ query }) => {
    try {
      const jobTemplates = await jobTemplatesService.list(query);

      return {
        status: 200 as const,
        body: {
          jobTemplates: jobTemplates,
        },
      };
    } catch {
      return {
        status: 500 as const,
        body: {
          error: 'Internal server error',
        },
      };
    }
  },

  /**
   * Update a job template by ID
   */
  update: async ({ params, body }) => {
    try {
      const jobTemplate = await jobTemplatesService.update(params.id, body);

      return {
        status: 200 as const,
        body: jobTemplate,
      };
    } catch (error) {
      if (error instanceof JobTemplateNotFoundError) {
        return {
          status: 404 as const,
          body: {
            error: error.message,
          },
        };
      }

      if (error instanceof JobTemplateValidationError) {
        return {
          status: 400 as const,
          body: {
            error: error.message,
            details: error.details,
          },
        };
      }

      return {
        status: 500 as const,
        body: {
          error: 'Internal server error',
        },
      };
    }
  },

  /**
   * Delete a job template by ID
   */
  delete: async ({ params }) => {
    try {
      const id = await jobTemplatesService.delete(params.id);

      return {
        status: 200 as const,
        body: {
          success: true,
          id,
        },
      };
    } catch (error) {
      if (error instanceof JobTemplateNotFoundError) {
        return {
          status: 404 as const,
          body: {
            error: error.message,
          },
        };
      }

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
 * Register job templates routes with Fastify
 * @param fastify Fastify instance
 */
export function jobTemplatesRoutes(fastify: FastifyInstance) {
  s.registerRouter(jobTemplatesContract, router, fastify, {
    logInitialization: true,
  });
}
