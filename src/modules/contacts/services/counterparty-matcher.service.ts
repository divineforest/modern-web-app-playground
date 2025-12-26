/**
 * Counterparty Matcher Service
 *
 * Matches a company against supplier/customer data from OCR extraction
 * to determine document type (expense vs income) and identify the counterparty to create.
 */

import { eq } from 'drizzle-orm';

import { companies, type Database, db } from '../../../db/index.js';
import { createModuleLogger } from '../../../lib/logger.js';
import {
  extractCustomerData,
  extractSupplierData,
  type RawExtractionData,
} from './raw-extraction-parser.service.js';

const logger = createModuleLogger('counterparty-matcher');

/**
 * Match result indicating which party the company matches
 */
export type MatchResult =
  | { matched: 'customer'; isExpense: true }
  | { matched: 'supplier'; isExpense: false }
  | { matched: null; isExpense: null };

/**
 * Company data for matching (subset of Company type)
 */
export interface CompanyMatchData {
  id: string;
  name: string;
  vatId: string | null;
}

/**
 * Company details from the JSONB company_details field
 */
export interface CompanyDetails {
  vatId?: string;
  vatType?: string;
}

/**
 * Error thrown when no matching counterparty is found
 */
export class NoMatchingCounterpartyError extends Error {
  constructor(companyName: string) {
    super(`No matching supplier or customer found for company: ${companyName}`);
    this.name = 'NoMatchingCounterpartyError';
  }
}

/**
 * Error thrown when company is not found
 */
export class CompanyNotFoundError extends Error {
  constructor(companyId: string) {
    super(`Company not found for companyId: ${companyId}`);
    this.name = 'CompanyNotFoundError';
  }
}

/**
 * Normalize VAT ID for comparison
 * - Removes all whitespace
 * - Converts to uppercase
 */
export function normalizeVatIdForComparison(vatId: string | null | undefined): string | null {
  if (!vatId) {
    return null;
  }
  return vatId.replace(/\s+/g, '').toUpperCase();
}

/**
 * Normalize name for comparison
 * - Trims whitespace
 * - Converts to uppercase
 * - Removes common suffixes (S.A., SARL, GmbH, etc.)
 */
export function normalizeNameForComparison(name: string | null | undefined): string | null {
  if (!name) {
    return null;
  }

  // Trim and uppercase
  let normalized = name.trim().toUpperCase();

  // Remove common legal suffixes
  const suffixes = [
    's\\.a\\.',
    's\\.a\\.r\\.l\\.',
    's\\.à\\.r\\.l\\.',
    'sarl',
    's\\.à r\\.l\\.-s',
    'gmbh',
    'ltd',
    'inc',
    'corp',
    'ag',
    'ohg',
    'mbh',
    'kg',
    'e\\.v\\.',
  ];

  const suffixPattern = new RegExp(`\\s*(${suffixes.join('|')})\\s*$`, 'i');

  // Remove suffixes iteratively (e.g., "OHG mbH" -> "OHG" -> "")
  let previousLength: number;
  do {
    previousLength = normalized.length;
    normalized = normalized.replace(suffixPattern, '').trim();
  } while (normalized.length !== previousLength && normalized.length > 0);

  return normalized;
}

/**
 * Check if two VAT IDs match (case-insensitive, ignoring whitespace)
 */
export function vatIdsMatch(
  vatId1: string | null | undefined,
  vatId2: string | null | undefined
): boolean {
  const normalized1 = normalizeVatIdForComparison(vatId1);
  const normalized2 = normalizeVatIdForComparison(vatId2);

  if (!normalized1 || !normalized2) {
    return false;
  }

  return normalized1 === normalized2;
}

/**
 * Check if two names match (normalized comparison)
 */
export function namesMatch(
  name1: string | null | undefined,
  name2: string | null | undefined
): boolean {
  const normalized1 = normalizeNameForComparison(name1);
  const normalized2 = normalizeNameForComparison(name2);

  if (!normalized1 || !normalized2) {
    return false;
  }

  return normalized1 === normalized2;
}

/**
 * Safely extracts vatId from companyDetails JSONB field.
 * Returns null if companyDetails is not a valid object or vatId is not a string.
 */
function extractVatIdFromCompanyDetails(companyDetails: CompanyDetails | null): string | null {
  if (companyDetails === null || typeof companyDetails !== 'object') {
    return null;
  }

  const vatId = companyDetails.vatId;

  if (typeof vatId !== 'string') {
    return null;
  }

  return vatId;
}

async function getCompanyWithVatId(
  companyId: string,
  database: Database = db
): Promise<CompanyMatchData | null> {
  const [company] = await database.select().from(companies).where(eq(companies.id, companyId));

  if (!company) {
    return null;
  }

  // Safely extract vatId from companyDetails JSONB field with runtime validation
  const vatId = extractVatIdFromCompanyDetails(company.companyDetails as CompanyDetails | null);

  return {
    id: company.id,
    name: company.name,
    vatId,
  };
}

/**
 * Match company against supplier/customer in the extraction
 *
 * @param company - Company data (name and VAT ID)
 * @param rawExtraction - Raw OCR extraction data
 * @returns Match result indicating which party the company matches
 */
export function matchCompanyToExtraction(
  company: CompanyMatchData,
  rawExtraction: RawExtractionData
): MatchResult {
  const supplier = extractSupplierData(rawExtraction);
  const customer = extractCustomerData(rawExtraction);

  logger.debug(
    {
      companyId: company.id,
      companyName: company.name,
      companyVatId: company.vatId,
      supplierName: supplier.name,
      supplierVatId: supplier.vatId,
      customerName: customer.name,
      customerVatId: customer.vatId,
    },
    'Matching company against extraction'
  );

  // Primary matching: VAT ID
  if (company.vatId) {
    // Check if company VAT ID matches customer
    if (vatIdsMatch(company.vatId, customer.vatId)) {
      logger.info(
        { companyId: company.id, matchType: 'vatId', matched: 'customer' },
        'Company matched customer by VAT ID - expense document'
      );
      return { matched: 'customer', isExpense: true };
    }

    // Check if company VAT ID matches supplier
    if (vatIdsMatch(company.vatId, supplier.vatId)) {
      logger.info(
        { companyId: company.id, matchType: 'vatId', matched: 'supplier' },
        'Company matched supplier by VAT ID - income document'
      );
      return { matched: 'supplier', isExpense: false };
    }
  }

  // Secondary matching: Name (if VAT ID didn't match)
  // Check if company name matches customer
  if (namesMatch(company.name, customer.name)) {
    logger.info(
      { companyId: company.id, matchType: 'name', matched: 'customer' },
      'Company matched customer by name - expense document'
    );
    return { matched: 'customer', isExpense: true };
  }

  // Check if company name matches supplier
  if (namesMatch(company.name, supplier.name)) {
    logger.info(
      { companyId: company.id, matchType: 'name', matched: 'supplier' },
      'Company matched supplier by name - income document'
    );
    return { matched: 'supplier', isExpense: false };
  }

  // No match found
  logger.warn(
    {
      companyId: company.id,
      companyName: company.name,
      companyVatId: company.vatId,
      supplierName: supplier.name,
      customerName: customer.name,
    },
    'No match found for company'
  );
  return { matched: null, isExpense: null };
}

/**
 * Find and validate company, then match against extraction
 *
 * @param companyId - Company UUID
 * @param rawExtraction - Raw OCR extraction data
 * @param database - Database connection
 * @returns Object indicating whether it's an expense document
 * @throws CompanyNotFoundError if company doesn't exist
 * @throws NoMatchingCounterpartyError if no match found
 */
export async function matchCounterparty(
  companyId: string,
  rawExtraction: RawExtractionData,
  database: Database = db
): Promise<{ isExpense: boolean; company: CompanyMatchData }> {
  // Get company from database
  const company = await getCompanyWithVatId(companyId, database);

  if (!company) {
    throw new CompanyNotFoundError(companyId);
  }

  // Match company against extraction
  const matchResult = matchCompanyToExtraction(company, rawExtraction);

  if (matchResult.matched === null) {
    throw new NoMatchingCounterpartyError(company.name);
  }

  return {
    isExpense: matchResult.isExpense,
    company,
  };
}
