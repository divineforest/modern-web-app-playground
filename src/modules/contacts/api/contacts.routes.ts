/**
 * Contacts API routes
 */
import { initServer } from '@ts-rest/fastify';
import type { FastifyInstance } from 'fastify';
import { logger as rootLogger } from '../../../lib/logger.js';
import { CursorSortMismatchError, InvalidCursorError } from '../domain/contact.errors.js';
import type {
  ContactListFilters,
  ContactPaginationOptions,
  ContactSortField,
  SortDirection,
} from '../domain/contact.types.js';

import { findContactByIdWithCompanies, listContacts } from '../repositories/contacts.repository.js';
import type { ContactResolveResult } from '../services/contact-resolver.service.js';
import { resolveContactFromExtraction } from '../services/contact-resolver.service.js';
import {
  CompanyNotFoundError,
  NoMatchingCounterpartyError,
} from '../services/counterparty-matcher.service.js';
import { ContactNameNotFoundError } from '../services/raw-extraction-parser.service.js';
import { contactsContract } from './contacts.contracts.js';

const logger = rootLogger.child({ module: 'contacts-routes' });
const s = initServer();

/**
 * Parse sort parameter into sort configuration
 */
function parseSort(sortParam?: string): { field: ContactSortField; direction: SortDirection } {
  if (!sortParam) {
    return { field: 'updated_at', direction: 'desc' };
  }

  const [field, direction] = sortParam.split(':');
  // Schema already validates format via regex, but defensive check for fallback defaults
  return {
    field: (field as ContactSortField) || 'updated_at',
    direction: (direction as SortDirection) || 'desc',
  };
}

/**
 * Transform a database contact to API response format
 *
 * When bobId is provided (from company-filtered queries), it is used as the id
 * in the response instead of the contact's internal id. This allows external
 * systems to reference contacts by their Bob ID.
 */
function formatContactForListResponse(contact: {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  email: string | null;
  phone: string | null;
  vatId: string | null;
  source: string;
  entityType: string;
  countryCode: string | null;
  isValidVatId: boolean;
  vatIdValidatedAt: Date | null;
  billingAddress: unknown;
  /** Optional Bob ID from company relationship - used as id when present */
  bobId?: string | null;
}) {
  return {
    // Use bobId if available, otherwise use internal contact id
    id: contact.bobId ?? contact.id,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    vatId: contact.vatId,
    source: contact.source as 'ocr' | 'vies',
    entityType: contact.entityType as 'legal_entity' | 'individual',
    countryCode: contact.countryCode,
    isValidVatId: contact.isValidVatId,
    vatIdValidatedAt: contact.vatIdValidatedAt?.toISOString() ?? null,
    billingAddress: contact.billingAddress as {
      countryCode: string;
      addressLine: string;
      city?: string;
      postalCode?: string;
    } | null,
  };
}

const router = s.router(contactsContract, {
  /**
   * Create or retrieve a contact from OCR extraction data
   *
   * Flow:
   * 1. Match company against supplier/customer in extraction
   * 2. Parse contact data from the non-matched party
   * 3. Create or retrieve contact using standard resolution flow
   * 4. Create document link for traceability
   */
  fromOcr: async ({ body }) => {
    const { companyId, documentId, rawExtraction } = body;

    logger.info({ companyId, documentId }, 'Processing contact from OCR extraction request');

    let result: ContactResolveResult;
    try {
      // Cast Zod-validated data to RawExtractionData
      // The Zod schema validates the structure, but its inferred type differs slightly
      // from our interface due to exactOptionalPropertyTypes
      result = await resolveContactFromExtraction({
        companyId,
        documentId,
        rawExtraction,
      });
    } catch (error) {
      // Handle known domain errors with 400 response
      if (
        error instanceof CompanyNotFoundError ||
        error instanceof NoMatchingCounterpartyError ||
        error instanceof ContactNameNotFoundError
      ) {
        return {
          status: 400 as const,
          body: { error: error.message },
        };
      }

      logger.error({ error }, 'Unexpected error in from-ocr route');
      return {
        status: 500 as const,
        body: { error: 'Internal server error' },
      };
    }

    // Return 200 if existing contact, 201 if new
    const statusCode = result.isNew ? 201 : 200;

    logger.info(
      {
        contactId: result.contact.id,
        isNew: result.isNew,
        statusCode,
        hasRelationship: !!result.relationship,
        hasDocumentLink: !!result.documentLink,
      },
      'Contact resolution from extraction completed'
    );

    // Build response body - documentLink is always present
    const responseBody: {
      contact: typeof result.contact;
      relationship?: { id: string; companyId: string; role: 'customer' | 'supplier' };
      documentLink: { id: string; documentId: string };
    } = {
      contact: result.contact,
      documentLink: result.documentLink as { id: string; documentId: string },
    };

    // Include relationship in response only for new contacts
    if (result.relationship) {
      responseBody.relationship = {
        id: result.relationship.id,
        companyId: result.relationship.companyId,
        role: result.relationship.role,
      };
    }

    return {
      status: statusCode,
      body: responseBody,
    };
  },

  /**
   * List global contacts with filtering and pagination
   */
  list: async ({ query }) => {
    try {
      logger.info({ query }, 'Listing global contacts');

      // Build filters
      const filters: ContactListFilters = {};

      if (query.company_id) {
        filters.companyId = query.company_id;
      }
      if (query.bob_reference_id) {
        filters.bobReferenceId = query.bob_reference_id;
      }
      if (query.role) {
        filters.role = query.role;
      }
      if (query.source) {
        filters.source = query.source;
      }
      if (query.is_valid_vat_id !== undefined) {
        filters.isValidVatId = query.is_valid_vat_id;
      }
      if (query.country_code) {
        filters.countryCode = query.country_code;
      }
      if (query.entity_type) {
        filters.entityType = query.entity_type;
      }
      if (query.updated_at_gt) {
        filters.updatedAtGt = new Date(query.updated_at_gt);
      }
      if (query.updated_at_lt) {
        filters.updatedAtLt = new Date(query.updated_at_lt);
      }

      // Build pagination options
      const sort = parseSort(query.sort);
      const pagination: ContactPaginationOptions = {
        sort,
        cursor: query.cursor,
        limit: query.limit,
      };

      // Execute query
      const result = await listContacts(filters, pagination);

      logger.info(
        { count: result.contacts.length, hasMore: result.pagination.hasMore },
        'Contacts list retrieved'
      );

      return {
        status: 200 as const,
        body: {
          contacts: result.contacts.map(formatContactForListResponse),
          pagination: result.pagination,
        },
      };
    } catch (error) {
      // Handle cursor-related errors with 400 status
      if (error instanceof InvalidCursorError || error instanceof CursorSortMismatchError) {
        return {
          status: 400 as const,
          body: {
            error: error.message,
          },
        };
      }

      logger.error({ error }, 'Unexpected error in list route');

      return {
        status: 500 as const,
        body: {
          error: 'Internal server error',
        },
      };
    }
  },

  /**
   * Get a single contact by ID
   */
  getById: async ({ params }) => {
    try {
      const { id } = params;
      logger.info({ contactId: id }, 'Getting contact by ID');

      const result = await findContactByIdWithCompanies(id);

      if (!result) {
        return {
          status: 404 as const,
          body: {
            error: 'Contact not found',
          },
        };
      }

      logger.info({ contactId: id, companiesCount: result.companies.length }, 'Contact retrieved');

      const { contact, companies } = result;

      return {
        status: 200 as const,
        body: {
          contact: {
            id: contact.id,
            createdAt: contact.createdAt.toISOString(),
            updatedAt: contact.updatedAt.toISOString(),
            name: contact.name,
            email: contact.email,
            phone: contact.phone,
            vatId: contact.vatId,
            vatType: contact.vatType as 'eligible' | 'exempt' | null,
            taxNumber: contact.taxNumber,
            contactPerson: contact.contactPerson,
            source: contact.source as 'ocr' | 'vies',
            entityType: contact.entityType as 'legal_entity' | 'individual',
            countryCode: contact.countryCode,
            isValidVatId: contact.isValidVatId,
            vatIdValidatedAt: contact.vatIdValidatedAt?.toISOString() ?? null,
            billingAddress: contact.billingAddress as {
              countryCode: string;
              addressLine: string;
              city?: string;
              postalCode?: string;
            } | null,
            postalAddress: contact.postalAddress as {
              countryCode: string;
              addressLine: string;
              city?: string;
              postalCode?: string;
            } | null,
            companies: companies.map((c) => ({
              id: c.id,
              companyId: c.companyId,
              role: c.role as 'customer' | 'supplier',
            })),
          },
        },
      };
    } catch (error) {
      logger.error({ error }, 'Unexpected error in getById route');

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
 * Register contacts routes on the Fastify instance
 */
export function registerContactsRoutes(fastify: FastifyInstance) {
  s.registerRouter(contactsContract, router, fastify, {
    logInitialization: true,
  });
}
