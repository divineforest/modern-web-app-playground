/**
 * Raw Extraction Parser Service
 *
 * Parses raw OCR extraction data (Mindee format) to extract contact information
 * for either supplier or customer based on document type determination.
 */

import type { Address } from '../domain/address.types.js';
import type { ContactEntityType } from '../domain/contact.types.js';
import type { CompanyRegistration, RawExtractionData } from '../domain/raw-extraction.types.js';
import { RegistrationTypes } from '../domain/raw-extraction.types.js';

// Re-export types for consumers who import from this module
export type { CompanyRegistration, RawExtractionData };

/**
 * Contact role for relationship creation
 */
export type ContactRole = 'supplier' | 'customer';

/**
 * Parsed contact data extracted from raw OCR extraction
 */
export interface ParsedContactData {
  /** Contact role (supplier or customer) */
  role: ContactRole;
  /** Contact/company name */
  name: string;
  /** VAT ID if found in company registrations */
  vatId: string | null;
  /** Entity type based on VAT ID presence */
  entityType: ContactEntityType;
  /** Structured address if available */
  address: Address | null;
  /** Email address (only available for supplier) */
  email: string | null;
  /** Phone number (only available for supplier) */
  phone: string | null;
  /** The full raw extraction for audit trail */
  rawExtraction: RawExtractionData;
}

/**
 * Supplier data extracted from raw OCR extraction
 */
export interface SupplierData {
  name: string | undefined;
  vatId: string | null;
  address: string | undefined;
  email: string | undefined;
  phone: string | undefined;
}

/**
 * Customer data extracted from raw OCR extraction
 */
export interface CustomerData {
  name: string | undefined;
  vatId: string | null;
  address: string | undefined;
}

/**
 * Extract VAT ID from company registrations array
 * Looks for entry with type === 'VAT NUMBER'
 */
export function extractVatIdFromRegistrations(
  registrations: CompanyRegistration[] | undefined
): string | null {
  if (!registrations || !Array.isArray(registrations)) {
    return null;
  }

  const vatEntry = registrations.find((r) => r.type === RegistrationTypes.VAT_NUMBER);
  return vatEntry?.value ?? null;
}

/**
 * Extract country code from VAT ID prefix
 * VAT IDs typically start with a 2-letter country code (e.g., 'LU35500410' -> 'LU')
 */
export function extractCountryCodeFromVatId(vatId: string | null): string | null {
  if (!vatId) {
    return null;
  }

  // Check if VAT ID starts with 2 uppercase letters
  const match = /^[A-Z]{2}/.exec(vatId);
  return match ? vatId.slice(0, 2) : null;
}

/**
 * Build structured address from address string and optional country code
 */
export function buildAddress(
  addressValue: string | undefined,
  countryCode: string | null
): Address | null {
  if (!addressValue) {
    return null;
  }

  return {
    countryCode: countryCode ?? '',
    addressLine: addressValue,
  };
}

/**
 * Determine entity type based on VAT ID presence
 */
export function determineEntityType(vatId: string | null): ContactEntityType {
  return vatId ? 'legal_entity' : 'individual';
}

/**
 * Extract supplier data from raw extraction
 */
export function extractSupplierData(rawExtraction: RawExtractionData): SupplierData {
  return {
    name: rawExtraction.supplierName?.value,
    vatId: extractVatIdFromRegistrations(rawExtraction.supplierCompanyRegistrations),
    address: rawExtraction.supplierAddress?.value,
    email: rawExtraction.supplierEmail?.value,
    phone: rawExtraction.supplierPhoneNumber?.value,
  };
}

/**
 * Extract customer data from raw extraction
 */
export function extractCustomerData(rawExtraction: RawExtractionData): CustomerData {
  return {
    name: rawExtraction.customerName?.value,
    vatId: extractVatIdFromRegistrations(rawExtraction.customerCompanyRegistrations),
    address: rawExtraction.customerAddress?.value,
  };
}

/**
 * Error thrown when contact name is not found in extraction
 */
export class ContactNameNotFoundError extends Error {
  constructor(role: ContactRole) {
    super(`Contact name not found in extraction for ${role}`);
    this.name = 'ContactNameNotFoundError';
  }
}

/**
 * Parse raw extraction to extract supplier contact data
 * Used when company matches customer (expense document)
 */
export function parseSupplierContact(rawExtraction: RawExtractionData): ParsedContactData {
  const supplier = extractSupplierData(rawExtraction);

  if (!supplier.name) {
    throw new ContactNameNotFoundError('supplier');
  }

  const countryCode = extractCountryCodeFromVatId(supplier.vatId);

  return {
    role: 'supplier',
    name: supplier.name,
    vatId: supplier.vatId,
    entityType: determineEntityType(supplier.vatId),
    address: buildAddress(supplier.address, countryCode),
    email: supplier.email ?? null,
    phone: supplier.phone ?? null,
    rawExtraction,
  };
}

/**
 * Parse raw extraction to extract customer contact data
 * Used when company matches supplier (income document)
 */
export function parseCustomerContact(rawExtraction: RawExtractionData): ParsedContactData {
  const customer = extractCustomerData(rawExtraction);

  if (!customer.name) {
    throw new ContactNameNotFoundError('customer');
  }

  const countryCode = extractCountryCodeFromVatId(customer.vatId);

  return {
    role: 'customer',
    name: customer.name,
    vatId: customer.vatId,
    entityType: determineEntityType(customer.vatId),
    address: buildAddress(customer.address, countryCode),
    // Email and phone are not available for customer in Mindee extraction
    email: null,
    phone: null,
    rawExtraction,
  };
}

/**
 * Parse raw extraction to extract contact data based on whether it's an expense or income document
 *
 * @param rawExtraction - The raw OCR extraction data
 * @param isExpense - True if company matches customer (expense document), false if company matches supplier (income document)
 * @returns Parsed contact data for the counterparty
 */
export function parseContactFromExtraction(
  rawExtraction: RawExtractionData,
  isExpense: boolean
): ParsedContactData {
  return isExpense ? parseSupplierContact(rawExtraction) : parseCustomerContact(rawExtraction);
}
