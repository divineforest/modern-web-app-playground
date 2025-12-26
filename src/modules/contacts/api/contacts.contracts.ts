/**
 * ts-rest contracts for the contacts API
 */
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

import { addressSchema as baseAddressSchema } from '../domain/address.schema.js';
import { rawExtractionSchema } from '../domain/raw-extraction.schema.js';

const c = initContract();

// Address schema for API input - extends base schema with stricter country code validation
const addressSchema = baseAddressSchema.extend({
  countryCode: z.string().length(2).describe('ISO 3166-1 alpha-2 country code'),
});

// Request body schema for fromOcr
const fromOcrRequestSchema = z.object({
  companyId: z.string().uuid().describe('Company ID to identify the requesting company'),
  documentId: z
    .string()
    .uuid()
    .describe('Document ID from which the contact data was extracted, for traceability'),
  rawExtraction: rawExtractionSchema.describe(
    'Complete document extraction from OCR provider (Mindee API)'
  ),
});

// Base contact response schema (used in fromOcr response)
const contactResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  vatId: z.string().nullable(),
  source: z.enum(['ocr', 'vies']),
  entityType: z.enum(['legal_entity', 'individual']),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  countryCode: z.string().nullable(),
  billingAddress: addressSchema.nullable(),
});

// Relationship schema for responses
const relationshipResponseSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  role: z.enum(['customer', 'supplier']),
});

// Document link schema for responses
const documentLinkResponseSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
});

// Success response schema for existing contact (200 OK) - includes document link
const successResponseSchema = z.object({
  contact: contactResponseSchema,
  documentLink: documentLinkResponseSchema,
});

// Create response schema for new contact (201 Created) - includes relationship and document link
const createResponseSchema = z.object({
  contact: contactResponseSchema,
  relationship: relationshipResponseSchema.optional(),
  documentLink: documentLinkResponseSchema,
});

// Extended contact schema for list API (includes timestamps and validation fields)
const contactListItemSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  vatId: z.string().nullable(),
  source: z.enum(['ocr', 'vies']),
  entityType: z.enum(['legal_entity', 'individual']),
  countryCode: z.string().nullable(),
  isValidVatId: z.boolean(),
  vatIdValidatedAt: z.string().datetime().nullable(),
  billingAddress: addressSchema.nullable(),
});

// Pagination schema
const paginationSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

// List contacts query parameters
const listContactsQuerySchema = z
  .object({
    company_id: z
      .string()
      .uuid()
      .optional()
      .describe('Filter contacts associated with this company'),
    bob_reference_id: z
      .string()
      .optional()
      .describe(
        "Filter contacts associated with a company by its Bob reference ID (alternative to 'company_id')"
      ),
    role: z
      .enum(['customer', 'supplier'])
      .optional()
      .describe("Filter by relationship role. Requires 'company_id' or 'bob_reference_id'"),
    source: z.enum(['ocr', 'vies']).optional().describe('Filter by data source'),
    is_valid_vat_id: z
      .enum(['true', 'false'])
      .transform((val) => val === 'true')
      .optional()
      .describe('Filter by VAT ID validation status'),
    country_code: z
      .string()
      .length(2)
      .optional()
      .describe('Filter by ISO 3166-1 alpha-2 country code'),
    entity_type: z
      .enum(['legal_entity', 'individual'])
      .optional()
      .describe('Filter by entity type'),
    updated_at_gt: z
      .string()
      .datetime({ offset: true })
      .optional()
      .describe('Filter contacts updated after (exclusive)'),
    updated_at_lt: z
      .string()
      .datetime({ offset: true })
      .optional()
      .describe('Filter contacts updated before (exclusive)'),
    sort: z
      .string()
      .regex(/^(created_at|updated_at|name):(asc|desc)$/)
      .optional()
      .default('updated_at:desc')
      .describe('Sort order as field:direction'),
    cursor: z.string().optional().describe('Opaque cursor from previous response'),
    limit: z
      .string()
      .regex(/^\d+$/)
      .optional()
      .default('100')
      .transform(Number)
      .refine((val) => val > 0 && val <= 500, {
        message: 'limit must be between 1 and 500',
      })
      .describe('Maximum number of items to return (1-500, default: 100)'),
  })
  .refine((data) => !data.role || !!data.company_id || !!data.bob_reference_id, {
    message: "role filter requires 'company_id' or 'bob_reference_id'",
    path: ['role'],
  })
  .refine((data) => !(data.company_id && data.bob_reference_id), {
    message: "'company_id' and 'bob_reference_id' are mutually exclusive",
    path: ['bob_reference_id'],
  });

// List contacts response schema
const listContactsResponseSchema = z.object({
  contacts: z.array(contactListItemSchema),
  pagination: paginationSchema,
});

// Company relationship for getById response
const companyRelationshipSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  role: z.enum(['customer', 'supplier']),
});

// Full contact schema for getById response (includes all fields and companies)
const fullContactSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  vatId: z.string().nullable(),
  vatType: z.enum(['eligible', 'exempt']).nullable(),
  taxNumber: z.string().nullable(),
  contactPerson: z.string().nullable(),
  source: z.enum(['ocr', 'vies']),
  entityType: z.enum(['legal_entity', 'individual']),
  countryCode: z.string().nullable(),
  isValidVatId: z.boolean(),
  vatIdValidatedAt: z.string().datetime().nullable(),
  billingAddress: addressSchema.nullable(),
  postalAddress: addressSchema.nullable(),
  companies: z.array(companyRelationshipSchema),
});

// Get contact by ID response schema
const getContactByIdResponseSchema = z.object({
  contact: fullContactSchema,
});

// Error response schemas
const validationErrorSchema = z.object({
  error: z.string(),
  details: z.record(z.string()).optional(),
});

const unauthorizedErrorSchema = z.object({
  error: z.string(),
});

const notFoundErrorSchema = z.object({
  error: z.string(),
});

const internalErrorSchema = z.object({
  error: z.string(),
});

/**
 * Contacts API contract
 */
export const contactsContract = c.router({
  /**
   * Create or retrieve a contact from OCR extraction data
   */
  fromOcr: {
    method: 'POST',
    path: '/api/internal/contacts/from-ocr',
    responses: {
      200: successResponseSchema.describe('Existing contact found'),
      201: createResponseSchema.describe('New contact created'),
      400: validationErrorSchema.describe('Validation error'),
      401: unauthorizedErrorSchema.describe('Authentication required'),
      500: internalErrorSchema.describe('Internal server error'),
    },
    body: fromOcrRequestSchema,
    summary: 'Create or retrieve contact from OCR data',
    description:
      'Processes pre-extracted contact data from Mindee OCR. ' +
      'If a VAT ID is provided, validates via VIES API. ' +
      'Returns existing contact if found, or creates a new one.',
  },

  /**
   * List global contacts with filtering and pagination
   */
  list: {
    method: 'GET',
    path: '/api/internal/global-contacts',
    responses: {
      200: listContactsResponseSchema.describe('Contacts list with pagination'),
      400: validationErrorSchema.describe('Validation error'),
      401: unauthorizedErrorSchema.describe('Authentication required'),
      500: internalErrorSchema.describe('Internal server error'),
    },
    query: listContactsQuerySchema,
    summary: 'List global contacts',
    description:
      'Returns a list of global contacts with optional filtering by company, role, source, ' +
      'validation status, country, and entity type. Supports cursor-based pagination.',
  },

  /**
   * Get a single contact by ID
   */
  getById: {
    method: 'GET',
    path: '/api/internal/global-contacts/:id',
    pathParams: z.object({
      id: z.string().uuid().describe('Contact UUID'),
    }),
    responses: {
      200: getContactByIdResponseSchema.describe('Contact details with company relationships'),
      400: validationErrorSchema.describe('Invalid UUID format'),
      401: unauthorizedErrorSchema.describe('Authentication required'),
      404: notFoundErrorSchema.describe('Contact not found'),
      500: internalErrorSchema.describe('Internal server error'),
    },
    summary: 'Get contact by ID',
    description: 'Returns a single contact with all fields and associated company relationships.',
  },
});
