/**
 * Contact Resolver Service
 * Orchestrates contact resolution from OCR extraction data
 * Handles VIES validation and fallback to OCR data
 */
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';

import type { Database } from '../../../db/index.js';
import { companies, db } from '../../../db/index.js';
import { isUniqueViolation } from '../../../lib/database-errors.js';
import { logger as rootLogger } from '../../../lib/logger.js';
import type { Address } from '../domain/address.types.js';
import type { Contact, ContactResponse } from '../domain/contact.entity.js';
import { toContact, toContactResponse } from '../domain/contact.entity.js';
import type { ContactEntityType, ContactSource } from '../domain/contact.types.js';
import type { ContactCompanyRole } from '../domain/global-contact-company.types.js';
import type { DocumentLinkResult } from '../domain/global-contact-document.types.js';
import type { RawExtractionData } from '../domain/raw-extraction.types.js';
import { createContact, findContactByVatId } from '../repositories/contacts.repository.js';
import {
  createContactCompanyRelationship,
  findBobIdByCompanyAndVatId,
} from '../repositories/global-contacts-companies.repository.js';
import { createContactDocumentLink } from '../repositories/global-contacts-documents.repository.js';
import { normalizeVatId, type ViesServiceConfig, validateVatId } from './vies.service.js';

const logger = rootLogger.child({ module: 'contact-resolver' });

/**
 * Input data from OCR extraction
 */
export interface OcrContactInput {
  /** Contact/company name (required) */
  name: string;
  /** VAT ID if extracted (triggers VIES validation) */
  vatId?: string | null | undefined;
  /** Structured address data */
  address?: Address | null | undefined;
  /** Contact email address */
  email?: string | null | undefined;
  /** Contact phone number */
  phone?: string | null | undefined;
  /** Entity type override */
  entityType?: ContactEntityType | undefined;
  /** Full OCR Provider response for audit trail */
  rawExtraction: RawExtractionData;
}

/**
 * Company linking options for contact resolution
 */
export interface CompanyLinkingOptions {
  /** Company ID to link the contact to */
  companyId: string;
  /** Role of the contact for this company */
  role: ContactCompanyRole;
}

/**
 * Relationship created as part of contact resolution
 */
export interface ContactRelationshipResult {
  /** Relationship ID */
  id: string;
  /** Company ID */
  companyId: string;
  /** Role */
  role: ContactCompanyRole;
}

/**
 * Result of contact resolution
 */
export interface ContactResolveResult {
  /** The resolved contact */
  contact: ContactResponse;
  /** Whether this is a new contact (true) or existing (false) */
  isNew: boolean;
  /** Relationship info when companyLinking is provided (created for new contacts, or for existing contacts when linking to a new company) */
  relationship?: ContactRelationshipResult | undefined;
  /** Document link info when documentId is provided */
  documentLink?: DocumentLinkResult | undefined;
}

/**
 * Contact resolver options
 */
export interface ContactResolverOptions {
  /** Database instance to use */
  database?: Database;
  /** VIES service configuration override */
  viesConfig?: ViesServiceConfig;
  /** Company linking options */
  companyLinking?: CompanyLinkingOptions | undefined;
}

/**
 * Error thrown when company validation fails
 */
export class CompanyNotFoundError extends Error {
  constructor(companyId: string) {
    super(`Company not found: ${companyId}`);
    this.name = 'CompanyNotFoundError';
  }
}

/**
 * Validate that a company exists
 */
async function validateCompanyExists(companyId: string, database: Database): Promise<boolean> {
  const result = await database
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  return result.length > 0;
}

/**
 * Create a company-contact relationship
 * If vatId is provided, looks up bob_id from bob_contacts table and includes it in the relationship
 * Returns the relationship or undefined if it already exists (duplicate)
 */
async function createRelationship(
  contactId: string,
  companyId: string,
  role: ContactCompanyRole,
  vatId: string | null | undefined,
  database: Database
): Promise<ContactRelationshipResult> {
  // Lookup bob_id if vatId is provided
  let bobId: string | null = null;
  if (vatId) {
    bobId = await findBobIdByCompanyAndVatId(companyId, vatId, database);
    if (bobId) {
      logger.debug(
        { companyId, vatId, bobId },
        'Found bob_id from bob_contacts for contact relationship'
      );
    }
  }

  const relationship = await createContactCompanyRelationship(
    {
      globalContactId: contactId,
      companyId,
      role,
      bobId,
    },
    database
  );

  return {
    id: relationship.id,
    companyId: relationship.companyId,
    role: relationship.role as ContactCompanyRole,
  };
}

/**
 * Process relationship creation if company linking is provided
 * Handles logging for the relationship creation process
 */
async function processRelationshipCreation(
  contact: Contact,
  companyLinking: CompanyLinkingOptions | undefined,
  vatId: string | null | undefined,
  correlationId: string,
  database: Database
): Promise<ContactRelationshipResult | undefined> {
  if (!companyLinking) {
    return undefined;
  }

  const relationship = await createRelationship(
    contact.id,
    companyLinking.companyId,
    companyLinking.role,
    vatId,
    database
  );

  logger.info(
    {
      correlationId,
      contactId: contact.id,
      companyId: companyLinking.companyId,
      role: companyLinking.role,
      relationshipId: relationship.id,
    },
    'Company relationship created or updated'
  );

  return relationship;
}

/**
 * Handle unique violation error by retrying to find the existing contact
 * Used to handle race conditions when multiple requests try to create the same contact
 */
async function handleUniqueViolationRetry(
  normalizedVatId: string,
  correlationId: string,
  database: Database,
  companyLinking?: CompanyLinkingOptions
): Promise<ContactResolveResult> {
  logger.info(
    { correlationId, vatId: normalizedVatId },
    'Contact already exists (race condition), returning existing contact'
  );

  const existingGlobalContact = await findContactByVatId(normalizedVatId, database);

  if (!existingGlobalContact) {
    logger.error(
      { correlationId, vatId: normalizedVatId },
      'Race condition detected but contact not found on retry - possible concurrent deletion'
    );
    throw new Error(
      `Contact with VAT ID ${normalizedVatId} caused a unique constraint violation ` +
        `but could not be retrieved. This may indicate a concurrent deletion.`
    );
  }

  const existingContact = toContact(existingGlobalContact);

  // Create company relationship for existing contacts (same as normal existing contact path)
  const relationship = await processRelationshipCreation(
    existingContact,
    companyLinking,
    normalizedVatId,
    correlationId,
    database
  );

  return {
    contact: toContactResponse(existingContact),
    isNew: false,
    relationship,
  };
}

/**
 * Resolve or create a contact from OCR extraction data
 *
 * Resolution flow:
 * 1. If companyId provided, validate company exists
 * 2. If VAT ID provided, search global_contacts by VAT ID
 * 3. If contact exists, return existing contact (no relationship created)
 * 4. If contact not found, call VIES API for validation
 * 5. If VIES returns valid data, create contact with source='vies'
 * 6. If VIES fails or no VAT ID, create contact from OCR data with source='ocr'
 * 7. If new contact created and companyId provided, create relationship
 *
 * @param input - OCR extraction data
 * @param options - Resolver options
 * @returns ContactResolveResult with contact, isNew flag, and optional relationship
 * @throws CompanyNotFoundError if companyId is provided but company doesn't exist
 */
export async function resolveContactFromOcr(
  input: OcrContactInput,
  options: ContactResolverOptions = {}
): Promise<ContactResolveResult> {
  const database = options.database ?? db;
  const correlationId = randomUUID();
  const companyLinking = options.companyLinking;

  logger.info(
    {
      correlationId,
      hasVatId: !!input.vatId,
      name: input.name,
      hasCompanyLinking: !!companyLinking,
    },
    'Starting contact resolution'
  );

  // Step 1: If companyId provided, validate company exists (guard clause)
  if (companyLinking) {
    const companyExists = await validateCompanyExists(companyLinking.companyId, database);
    if (!companyExists) {
      logger.warn(
        { correlationId, companyId: companyLinking.companyId },
        'Company not found for linking'
      );
      throw new CompanyNotFoundError(companyLinking.companyId);
    }
  }

  // Step 2-6: No VAT ID - create contact directly from OCR data (early return)
  if (!input.vatId) {
    logger.info({ correlationId, name: input.name }, 'Creating contact from OCR data');
    const contact = await createContactFromOcr(input, database);
    const relationship = await processRelationshipCreation(
      contact,
      companyLinking,
      null, // No VAT ID, so no bob_id lookup needed
      correlationId,
      database
    );

    return {
      contact: toContactResponse(contact),
      isNew: true,
      relationship,
    };
  }

  // From here: VAT ID is present
  const normalizedVatId = normalizeVatId(input.vatId);
  logger.debug(
    { correlationId, vatId: normalizedVatId },
    'Searching for existing contact by VAT ID'
  );

  // Step 3: Check for existing contact by VAT ID (early return if found)
  const existingGlobalContact = await findContactByVatId(normalizedVatId, database);
  if (existingGlobalContact) {
    const existingContact = toContact(existingGlobalContact);
    logger.info(
      { correlationId, contactId: existingContact.id, vatId: normalizedVatId },
      'Found existing contact by VAT ID'
    );

    const relationship = await processRelationshipCreation(
      existingContact,
      companyLinking,
      normalizedVatId, // Pass VAT ID for bob_id lookup
      correlationId,
      database
    );

    return {
      contact: toContactResponse(existingContact),
      isNew: false,
      relationship,
    };
  }

  // Step 4-5: No existing contact, try VIES validation
  logger.debug({ correlationId, vatId: normalizedVatId }, 'No existing contact, calling VIES API');
  const viesResult = await validateVatId(normalizedVatId, options.viesConfig);

  // Step 5: VIES validation successful - create contact from VIES data
  if (viesResult.success && viesResult.data) {
    logger.info(
      { correlationId, vatId: normalizedVatId, viesName: viesResult.data.name },
      'VIES validation successful, creating contact from VIES data'
    );

    try {
      const contact = await createContactFromVies(
        input,
        viesResult.data,
        viesResult.rawResponse,
        database
      );
      const relationship = await processRelationshipCreation(
        contact,
        companyLinking,
        normalizedVatId, // Pass VAT ID for bob_id lookup
        correlationId,
        database
      );

      return {
        contact: toContactResponse(contact),
        isNew: true,
        relationship,
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        return handleUniqueViolationRetry(normalizedVatId, correlationId, database, companyLinking);
      }
      throw error;
    }
  }

  // Step 6: VIES failed - fall back to OCR data (still use the VAT ID from input)
  logger.info(
    { correlationId, vatId: normalizedVatId, error: viesResult.error },
    'VIES validation failed, falling back to OCR data'
  );

  try {
    const contact = await createContactFromOcr(input, database, viesResult.rawResponse);
    const relationship = await processRelationshipCreation(
      contact,
      companyLinking,
      normalizedVatId, // Pass VAT ID for bob_id lookup (even if VIES failed, we may have a bob_contacts match)
      correlationId,
      database
    );

    return {
      contact: toContactResponse(contact),
      isNew: true,
      relationship,
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return handleUniqueViolationRetry(normalizedVatId, correlationId, database, companyLinking);
    }
    throw error;
  }
}

/**
 * Create a contact from VIES validation data
 * Converts repository result (GlobalContact) to domain type (Contact)
 */
async function createContactFromVies(
  ocrInput: OcrContactInput,
  viesData: {
    name: string;
    address: string;
    countryCode: string;
    isRegistered: boolean;
  },
  rawViesResponse: unknown,
  database: Database
): Promise<Contact> {
  // Use VIES name but fall back to OCR name if empty
  const name = viesData.name || ocrInput.name;

  // Validate that the resolved name is non-empty
  if (!name || name.trim().length === 0) {
    throw new Error('Contact name is required but was empty');
  }

  // Create billing address from VIES data (unparsed address line)
  const billingAddress: Address = {
    countryCode: viesData.countryCode,
    addressLine: viesData.address,
  };

  const globalContact = await createContact(
    {
      name,
      email: ocrInput.email ?? null,
      entityType: ocrInput.entityType ?? 'legal_entity',
      source: 'vies' as ContactSource,
      phone: ocrInput.phone ?? null,
      vatId: ocrInput.vatId ? normalizeVatId(ocrInput.vatId) : null,
      countryCode: viesData.countryCode,
      billingAddress,
      rawExtraction: ocrInput.rawExtraction,
      rawViesResponse,
      isValidVatId: true,
      vatIdValidatedAt: new Date(),
    },
    database
  );

  return toContact(globalContact);
}

/**
 * Create a contact from OCR extraction data
 * Converts repository result (GlobalContact) to domain type (Contact)
 */
async function createContactFromOcr(
  input: OcrContactInput,
  database: Database,
  rawViesResponse?: unknown
): Promise<Contact> {
  const name = input.name?.trim();
  if (!name) {
    throw new Error('Contact name is required but was empty');
  }

  const globalContact = await createContact(
    {
      name,
      email: input.email ?? null,
      entityType: input.entityType ?? 'legal_entity',
      source: 'ocr' as ContactSource,
      phone: input.phone ?? null,
      vatId: input.vatId ? normalizeVatId(input.vatId) : null,
      countryCode: input.address?.countryCode ?? null,
      billingAddress: input.address ?? null,
      rawExtraction: input.rawExtraction,
      rawViesResponse,
    },
    database
  );

  return toContact(globalContact);
}

/**
 * Input data for processing raw OCR extraction
 */
export interface FromOcrInput {
  /** Company ID to identify the requesting company */
  companyId: string;
  /** Document ID for traceability */
  documentId: string;
  /** Complete document extraction from OCR provider */
  rawExtraction: RawExtractionData;
}

/**
 * Options for resolving contact from raw extraction
 */
export interface ResolveFromExtractionOptions {
  /** Database instance to use */
  database?: Database;
  /** VIES service configuration override */
  viesConfig?: ViesServiceConfig;
}

/**
 * Resolve or create a contact from raw OCR extraction data
 *
 * This is the main entry point for the new /from-ocr endpoint flow:
 * 1. Match company against supplier/customer in extraction
 * 2. Parse contact data from the non-matched party
 * 3. Create or retrieve contact using standard resolution flow
 *
 * @param input - Raw extraction input with companyId
 * @param options - Resolver options
 * @returns ContactResolveResult with contact, isNew flag, and relationship
 * @throws CompanyNotFoundError if company doesn't exist
 * @throws NoMatchingCounterpartyError if no match found
 * @throws ContactNameNotFoundError if contact name not found in extraction
 */
export async function resolveContactFromExtraction(
  input: FromOcrInput,
  options: ResolveFromExtractionOptions = {}
): Promise<ContactResolveResult> {
  const database = options.database ?? db;
  const correlationId = randomUUID();

  // Import dynamically to avoid circular dependencies
  const { matchCounterparty } = await import('./counterparty-matcher.service.js');
  const { parseContactFromExtraction } = await import('./raw-extraction-parser.service.js');

  // Step 1: Match company against extraction and determine document type
  const { isExpense, company } = await matchCounterparty(
    input.companyId,
    input.rawExtraction,
    database
  );

  // Step 2: Parse contact data from the counterparty
  const parsedContact = parseContactFromExtraction(input.rawExtraction, isExpense);

  // Step 3: Use existing resolution flow with parsed data
  const ocrInput: OcrContactInput = {
    name: parsedContact.name,
    vatId: parsedContact.vatId,
    address: parsedContact.address,
    email: parsedContact.email,
    phone: parsedContact.phone,
    entityType: parsedContact.entityType,
    rawExtraction: parsedContact.rawExtraction,
  };

  const companyLinking: CompanyLinkingOptions = {
    companyId: company.id,
    role: parsedContact.role,
  };

  const result = await resolveContactFromOcr(ocrInput, {
    database,
    ...(options.viesConfig && { viesConfig: options.viesConfig }),
    companyLinking,
  });

  // Step 4: Create document link for traceability
  const documentLink = await createContactDocumentLink(
    {
      globalContactId: result.contact.id,
      documentId: input.documentId,
    },
    database
  );

  logger.info(
    {
      correlationId,
      contactId: result.contact.id,
      documentId: input.documentId,
      documentLinkId: documentLink.id,
      isNew: result.isNew,
    },
    'Document link created for contact'
  );

  return {
    ...result,
    documentLink: {
      id: documentLink.id,
      documentId: documentLink.documentId,
    },
  };
}
