import type { Database, GlobalContact, NewGlobalContact } from '../../src/db/index.js';
import { db, globalContacts } from '../../src/db/index.js';
import type { Address } from '../../src/modules/contacts/domain/address.types.js';
import type {
  ContactEntityType,
  ContactSource,
} from '../../src/modules/contacts/domain/contact.types.js';
import type { RawExtractionData } from '../../src/modules/contacts/domain/raw-extraction.types.js';

/**
 * Build test global contact data with default values that can be overridden
 * Use this for validation tests that don't need database records
 */
export function buildTestGlobalContactData(
  overrides: Partial<NewGlobalContact> = {}
): NewGlobalContact {
  return {
    name: overrides.name ?? 'Test Contact',
    email: overrides.email ?? 'test@example.com',
    entityType: (overrides.entityType as ContactEntityType) ?? 'legal_entity',
    source: (overrides.source as ContactSource) ?? 'ocr',
    phone: overrides.phone ?? '+49 30 12345678',
    vatId: overrides.vatId ?? null,
    vatType: overrides.vatType ?? null,
    taxNumber: overrides.taxNumber ?? null,
    contactPerson: overrides.contactPerson ?? null,
    countryCode: overrides.countryCode ?? 'DE',
    billingAddress: overrides.billingAddress ?? null,
    postalAddress: overrides.postalAddress ?? null,
    rawExtraction: overrides.rawExtraction ?? null,
    rawViesResponse: overrides.rawViesResponse ?? null,
    isValidVatId: overrides.isValidVatId,
    vatIdValidatedAt: overrides.vatIdValidatedAt ?? null,
  };
}

/**
 * Create a test global contact record in the database
 */
export async function createTestGlobalContact(
  overrides: Partial<NewGlobalContact> = {},
  database: Database = db
): Promise<GlobalContact> {
  // Ensure unique VAT ID if provided
  const vatId = overrides.vatId ?? (overrides.source === 'vies' ? `DE${Date.now()}` : null);

  const contactData = buildTestGlobalContactData({
    ...overrides,
    vatId,
  });

  const results = await database.insert(globalContacts).values(contactData).returning();

  if (!results[0]) {
    throw new Error('Failed to create test global contact');
  }

  return results[0];
}

/**
 * Build a test address object
 */
export function buildTestAddress(overrides: Partial<Address> = {}): Address {
  return {
    countryCode: overrides.countryCode ?? 'DE',
    city: overrides.city ?? 'Berlin',
    postalCode: overrides.postalCode ?? '10115',
    addressLine: overrides.addressLine ?? 'Hauptstraße 123',
  };
}

/**
 * Build a test raw extraction object
 */
function buildTestRawExtraction(overrides: Partial<RawExtractionData> = {}): RawExtractionData {
  const result: RawExtractionData = {
    supplierName: overrides.supplierName ?? { value: 'Test Supplier' },
    customerName: overrides.customerName ?? { value: 'Test Customer' },
  };

  if (overrides.supplierAddress !== undefined) {
    result.supplierAddress = overrides.supplierAddress;
  }
  if (overrides.customerAddress !== undefined) {
    result.customerAddress = overrides.customerAddress;
  }
  if (overrides.supplierEmail !== undefined) {
    result.supplierEmail = overrides.supplierEmail;
  }
  if (overrides.supplierPhoneNumber !== undefined) {
    result.supplierPhoneNumber = overrides.supplierPhoneNumber;
  }
  if (overrides.supplierCompanyRegistrations !== undefined) {
    result.supplierCompanyRegistrations = overrides.supplierCompanyRegistrations;
  }
  if (overrides.customerCompanyRegistrations !== undefined) {
    result.customerCompanyRegistrations = overrides.customerCompanyRegistrations;
  }

  return result;
}

/**
 * Build test OCR contact input data
 */
export function buildTestOcrContactInput(
  overrides: {
    name?: string;
    vatId?: string | null;
    address?: Address | null;
    email?: string | null;
    phone?: string | null;
    entityType?: ContactEntityType;
    rawExtraction?: RawExtractionData;
  } = {}
): {
  name: string;
  vatId: string | null;
  address: Address | null;
  email: string | null;
  phone: string | null;
  entityType?: ContactEntityType;
  rawExtraction: RawExtractionData;
} {
  return {
    name: overrides.name ?? 'Test Company',
    vatId: overrides.vatId ?? null,
    address: overrides.address ?? buildTestAddress(),
    email: overrides.email ?? 'contact@test.com',
    phone: overrides.phone ?? '+49 30 12345678',
    ...(overrides.entityType !== undefined && { entityType: overrides.entityType }),
    rawExtraction: overrides.rawExtraction ?? buildTestRawExtraction(),
  };
}
