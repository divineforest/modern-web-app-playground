import { initServer } from '@ts-rest/fastify';
import type { FastifyInstance } from 'fastify';
import { logger } from '../../../lib/logger.js';
import {
  InvoiceNotFoundError,
  InvoiceValidationError,
  invoicesService,
} from '../services/invoices.service.js';
import { invoicesContract } from './invoices.contracts.js';

/**
 * Initialize ts-rest server for type-safe route handling
 */
const s = initServer();

/**
 * Invoices route handlers
 */
const router = s.router(invoicesContract, {
  /**
   * Create a new invoice
   */
  create: async ({ body }) => {
    try {
      const invoice = await invoicesService.create(body);

      return {
        status: 201 as const,
        body: invoice,
      };
    } catch (error) {
      if (error instanceof InvoiceValidationError) {
        // Check if it's a duplicate invoice number error
        if (error.message.includes('Duplicate') || error.message.includes('already exists')) {
          return {
            status: 409 as const,
            body: {
              error: error.message,
              details: error.details as string | undefined,
            },
          };
        }
        return {
          status: 400 as const,
          body: {
            error: error.message,
            details: error.details,
          },
        };
      }

      logger.error({ error, body }, 'Unexpected error in create invoice route');
      return {
        status: 500 as const,
        body: {
          error: 'Internal server error',
        },
      };
    }
  },

  /**
   * Get an invoice by ID
   */
  getById: async ({ params }) => {
    try {
      const invoice = await invoicesService.getById(params.id);

      return {
        status: 200 as const,
        body: invoice,
      };
    } catch (error) {
      if (error instanceof InvoiceNotFoundError) {
        return {
          status: 404 as const,
          body: {
            error: error.message,
          },
        };
      }

      logger.error({ error, invoiceId: params.id }, 'Unexpected error in get invoice by ID route');
      return {
        status: 500 as const,
        body: {
          error: 'Internal server error',
        },
      };
    }
  },

  /**
   * List all invoices
   */
  list: async ({ query }) => {
    try {
      const invoices = await invoicesService.list(query);

      return {
        status: 200 as const,
        body: {
          invoices,
        },
      };
    } catch (error) {
      logger.error({ error, query }, 'Unexpected error in list invoices route');
      return {
        status: 500 as const,
        body: {
          error: 'Internal server error',
        },
      };
    }
  },

  /**
   * Update an invoice by ID
   */
  update: async ({ params, body }) => {
    try {
      const invoice = await invoicesService.update(params.id, body);

      return {
        status: 200 as const,
        body: invoice,
      };
    } catch (error) {
      if (error instanceof InvoiceNotFoundError) {
        return {
          status: 404 as const,
          body: {
            error: error.message,
          },
        };
      }

      if (error instanceof InvoiceValidationError) {
        // Check if it's a duplicate invoice number error
        if (error.message.includes('Duplicate') || error.message.includes('already exists')) {
          return {
            status: 409 as const,
            body: {
              error: error.message,
              details: error.details as string | undefined,
            },
          };
        }
        return {
          status: 400 as const,
          body: {
            error: error.message,
            details: error.details,
          },
        };
      }

      logger.error(
        { error, invoiceId: params.id, body },
        'Unexpected error in update invoice route'
      );
      return {
        status: 500 as const,
        body: {
          error: 'Internal server error',
        },
      };
    }
  },

  /**
   * Delete an invoice by ID
   */
  delete: async ({ params }) => {
    try {
      const id = await invoicesService.delete(params.id);

      return {
        status: 200 as const,
        body: {
          success: true,
          id,
        },
      };
    } catch (error) {
      if (error instanceof InvoiceNotFoundError) {
        return {
          status: 404 as const,
          body: {
            error: error.message,
          },
        };
      }

      logger.error({ error, invoiceId: params.id }, 'Unexpected error in delete invoice route');
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
 * Register invoices routes with Fastify
 * @param fastify Fastify instance
 */
export function registerInvoicesRoutes(fastify: FastifyInstance) {
  s.registerRouter(invoicesContract, router, fastify, {
    logInitialization: true,
  });
}
