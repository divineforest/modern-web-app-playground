/**
 * Contact entity types and related interfaces
 * Represents the global_contacts table in the database
 */
import type { GlobalContact, NewGlobalContact } from '../../../db/index.js';
import { parseAddress } from './address.schema.js';
import type { Address } from './address.types.js';
import {
  parseContactEntityType,
  parseContactSource,
  parseContactVatTypeSafe,
} from './contact.schema.js';
import type { ContactEntityType, ContactSource, ContactVatType } from './contact.types.js';
import { parseRawExtraction } from './raw-extraction.schema.js';
import type { RawExtractionData } from './raw-extraction.types.js';

// Re-export the Drizzle-inferred types for convenience
export type { GlobalContact, NewGlobalContact };

/**
 * Contact entity with proper typing for JSONB fields
 * This extends the Drizzle-inferred type with proper Address typing
 */
export interface Contact {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  email: string | null;
  entityType: ContactEntityType;
  source: ContactSource;
  phone: string | null;
  vatId: string | null;
  vatType: ContactVatType | null;
  taxNumber: string | null;
  contactPerson: string | null;
  countryCode: string | null;
  billingAddress: Address | null;
  postalAddress: Address | null;
  rawExtraction: RawExtractionData | null;
  rawViesResponse: unknown;
  isValidVatId: boolean;
  vatIdValidatedAt: Date | null;
}

/**
 * Contact response returned from the API (subset of stored fields)
 */
export interface ContactResponse {
  id: string;
  name: string;
  vatId: string | null;
  source: ContactSource;
  entityType: ContactEntityType;
  email: string | null;
  phone: string | null;
  countryCode: string | null;
  billingAddress: Address | null;
}

/**
 * Convert a GlobalContact (Drizzle type) to a Contact (domain type with proper JSONB typing)
 * Uses Zod validation to ensure JSONB fields conform to their expected schemas
 */
export function toContact(globalContact: GlobalContact): Contact {
  return {
    id: globalContact.id,
    createdAt: globalContact.createdAt,
    updatedAt: globalContact.updatedAt,
    name: globalContact.name,
    email: globalContact.email,
    entityType: parseContactEntityType(globalContact.entityType),
    source: parseContactSource(globalContact.source),
    phone: globalContact.phone,
    vatId: globalContact.vatId,
    vatType: parseContactVatTypeSafe(globalContact.vatType),
    taxNumber: globalContact.taxNumber,
    contactPerson: globalContact.contactPerson,
    countryCode: globalContact.countryCode,
    billingAddress: parseAddress(globalContact.billingAddress),
    postalAddress: parseAddress(globalContact.postalAddress),
    rawExtraction: parseRawExtraction(globalContact.rawExtraction),
    rawViesResponse: globalContact.rawViesResponse,
    isValidVatId: globalContact.isValidVatId,
    vatIdValidatedAt: globalContact.vatIdValidatedAt,
  };
}

/**
 * Convert a Contact to a ContactResponse (API response subset)
 */
export function toContactResponse(contact: Contact): ContactResponse {
  return {
    id: contact.id,
    name: contact.name,
    vatId: contact.vatId,
    source: contact.source,
    entityType: contact.entityType,
    email: contact.email,
    phone: contact.phone,
    countryCode: contact.countryCode,
    billingAddress: contact.billingAddress,
  };
}
