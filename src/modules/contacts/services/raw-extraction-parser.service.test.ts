/**
 * Raw Extraction Parser Service Unit Tests
 *
 * Tests for parsing Mindee OCR extraction data into contact information
 * for supplier and customer contacts.
 */

import { describe, expect, it } from 'vitest';

import {
  buildAddress,
  ContactNameNotFoundError,
  determineEntityType,
  extractCountryCodeFromVatId,
  extractCustomerData,
  extractSupplierData,
  extractVatIdFromRegistrations,
  parseContactFromExtraction,
  parseCustomerContact,
  parseSupplierContact,
  type RawExtractionData,
} from './raw-extraction-parser.service.js';

describe('raw-extraction-parser.service', () => {
  describe('extractVatIdFromRegistrations', () => {
    it('returns null for undefined registrations', () => {
      // ACT & ASSERT
      expect(extractVatIdFromRegistrations(undefined)).toBeNull();
    });

    it('returns null for empty array', () => {
      // ACT & ASSERT
      expect(extractVatIdFromRegistrations([])).toBeNull();
    });

    it('returns null when no VAT NUMBER type found', () => {
      // ARRANGE
      const registrations = [
        { type: 'COMPANY REGISTRATION', value: '12345' },
        { type: 'TAX NUMBER', value: '67890' },
      ];

      // ACT & ASSERT
      expect(extractVatIdFromRegistrations(registrations)).toBeNull();
    });

    it('extracts VAT NUMBER value when present', () => {
      // ARRANGE
      const registrations = [
        { type: 'COMPANY REGISTRATION', value: '12345' },
        { type: 'VAT NUMBER', value: 'DE123456789' },
      ];

      // ACT & ASSERT
      expect(extractVatIdFromRegistrations(registrations)).toBe('DE123456789');
    });

    it('returns first VAT NUMBER when multiple exist', () => {
      // ARRANGE
      const registrations = [
        { type: 'VAT NUMBER', value: 'DE111111111' },
        { type: 'VAT NUMBER', value: 'DE222222222' },
      ];

      // ACT & ASSERT
      expect(extractVatIdFromRegistrations(registrations)).toBe('DE111111111');
    });

    it('handles registrations array that is not an array', () => {
      // ACT & ASSERT
      // @ts-expect-error - testing invalid input
      expect(extractVatIdFromRegistrations('not-an-array')).toBeNull();
    });
  });

  describe('extractCountryCodeFromVatId', () => {
    it('returns null for null input', () => {
      // ACT & ASSERT
      expect(extractCountryCodeFromVatId(null)).toBeNull();
    });

    it('returns null for empty string', () => {
      // ACT & ASSERT
      expect(extractCountryCodeFromVatId('')).toBeNull();
    });

    it('extracts DE country code', () => {
      // ACT & ASSERT
      expect(extractCountryCodeFromVatId('DE123456789')).toBe('DE');
    });

    it('extracts LU country code', () => {
      // ACT & ASSERT
      expect(extractCountryCodeFromVatId('LU26375245')).toBe('LU');
    });

    it('extracts AT country code', () => {
      // ACT & ASSERT
      expect(extractCountryCodeFromVatId('ATU12345678')).toBe('AT');
    });

    it('returns null for VAT ID without country prefix', () => {
      // ACT & ASSERT
      expect(extractCountryCodeFromVatId('123456789')).toBeNull();
    });

    it('returns null for lowercase country prefix', () => {
      // ACT & ASSERT - implementation requires uppercase
      expect(extractCountryCodeFromVatId('de123456789')).toBeNull();
    });

    it('returns null for single letter prefix', () => {
      // ACT & ASSERT
      expect(extractCountryCodeFromVatId('D123456789')).toBeNull();
    });
  });

  describe('buildAddress', () => {
    it('returns null for undefined address value', () => {
      // ACT & ASSERT
      expect(buildAddress(undefined, 'DE')).toBeNull();
    });

    it('returns null for empty string address value', () => {
      // ACT & ASSERT
      expect(buildAddress('', 'DE')).toBeNull();
    });

    it('builds address with country code', () => {
      // ACT
      const result = buildAddress('Hauptstraße 123, 10115 Berlin', 'DE');

      // ASSERT
      expect(result).toEqual({
        countryCode: 'DE',
        addressLine: 'Hauptstraße 123, 10115 Berlin',
      });
    });

    it('builds address with empty country code when null', () => {
      // ACT
      const result = buildAddress('123 Main St, City', null);

      // ASSERT
      expect(result).toEqual({
        countryCode: '',
        addressLine: '123 Main St, City',
      });
    });

    it('preserves multiline addresses', () => {
      // ACT
      const result = buildAddress('38, AVENUE JOHN F. KENNEDY\nL-1855  LUXEMBOURG', 'LU');

      // ASSERT
      expect(result).toEqual({
        countryCode: 'LU',
        addressLine: '38, AVENUE JOHN F. KENNEDY\nL-1855  LUXEMBOURG',
      });
    });
  });

  describe('determineEntityType', () => {
    it('returns legal_entity when VAT ID is present', () => {
      // ACT & ASSERT
      expect(determineEntityType('DE123456789')).toBe('legal_entity');
    });

    it('returns individual when VAT ID is null', () => {
      // ACT & ASSERT
      expect(determineEntityType(null)).toBe('individual');
    });

    it('returns legal_entity for any non-null VAT ID', () => {
      // ACT & ASSERT
      expect(determineEntityType('123')).toBe('legal_entity');
    });
  });

  describe('extractSupplierData', () => {
    it('extracts all supplier fields when present', () => {
      // ARRANGE
      const extraction: RawExtractionData = {
        supplierName: { value: 'ACME Corp' },
        supplierAddress: { value: '123 Main St' },
        supplierEmail: { value: 'billing@acme.de' },
        supplierPhoneNumber: { value: '+49 30 12345678' },
        supplierCompanyRegistrations: [{ type: 'VAT NUMBER', value: 'DE123456789' }],
      };

      // ACT
      const result = extractSupplierData(extraction);

      // ASSERT
      expect(result).toEqual({
        name: 'ACME Corp',
        vatId: 'DE123456789',
        address: '123 Main St',
        email: 'billing@acme.de',
        phone: '+49 30 12345678',
      });
    });

    it('handles missing optional fields', () => {
      // ARRANGE
      const extraction: RawExtractionData = {
        supplierName: { value: 'ACME Corp' },
      };

      // ACT
      const result = extractSupplierData(extraction);

      // ASSERT
      expect(result).toEqual({
        name: 'ACME Corp',
        vatId: null,
        address: undefined,
        email: undefined,
        phone: undefined,
      });
    });

    it('handles empty extraction', () => {
      // ARRANGE
      const extraction: RawExtractionData = {};

      // ACT
      const result = extractSupplierData(extraction);

      // ASSERT
      expect(result).toEqual({
        name: undefined,
        vatId: null,
        address: undefined,
        email: undefined,
        phone: undefined,
      });
    });
  });

  describe('extractCustomerData', () => {
    it('extracts all customer fields when present', () => {
      // ARRANGE
      const extraction: RawExtractionData = {
        customerName: { value: 'Client Inc' },
        customerAddress: { value: '456 Oak Ave' },
        customerCompanyRegistrations: [{ type: 'VAT NUMBER', value: 'LU987654321' }],
      };

      // ACT
      const result = extractCustomerData(extraction);

      // ASSERT
      expect(result).toEqual({
        name: 'Client Inc',
        vatId: 'LU987654321',
        address: '456 Oak Ave',
      });
    });

    it('handles missing optional fields', () => {
      // ARRANGE
      const extraction: RawExtractionData = {
        customerName: { value: 'Client Inc' },
      };

      // ACT
      const result = extractCustomerData(extraction);

      // ASSERT
      expect(result).toEqual({
        name: 'Client Inc',
        vatId: null,
        address: undefined,
      });
    });
  });

  describe('parseSupplierContact', () => {
    it('parses complete supplier contact data', () => {
      // ARRANGE
      const extraction: RawExtractionData = {
        supplierName: { value: 'ACME Corp' },
        supplierAddress: { value: '123 Main St, Berlin' },
        supplierEmail: { value: 'billing@acme.de' },
        supplierPhoneNumber: { value: '+49 30 12345678' },
        supplierCompanyRegistrations: [{ type: 'VAT NUMBER', value: 'DE123456789' }],
      };

      // ACT
      const result = parseSupplierContact(extraction);

      // ASSERT
      expect(result).toEqual({
        role: 'supplier',
        name: 'ACME Corp',
        vatId: 'DE123456789',
        entityType: 'legal_entity',
        address: {
          countryCode: 'DE',
          addressLine: '123 Main St, Berlin',
        },
        email: 'billing@acme.de',
        phone: '+49 30 12345678',
        rawExtraction: extraction,
      });
    });

    it('throws ContactNameNotFoundError when supplier name is missing', () => {
      // ARRANGE
      const extraction: RawExtractionData = {
        supplierEmail: { value: 'billing@acme.de' },
      };

      // ACT & ASSERT
      expect(() => parseSupplierContact(extraction)).toThrow(ContactNameNotFoundError);
      expect(() => parseSupplierContact(extraction)).toThrow(
        'Contact name not found in extraction for supplier'
      );
    });

    it('sets entityType to individual when no VAT ID', () => {
      // ARRANGE
      const extraction: RawExtractionData = {
        supplierName: { value: 'John Doe' },
      };

      // ACT
      const result = parseSupplierContact(extraction);

      // ASSERT
      expect(result.entityType).toBe('individual');
      expect(result.vatId).toBeNull();
    });

    it('extracts country code from VAT ID prefix', () => {
      // ARRANGE
      const extraction: RawExtractionData = {
        supplierName: { value: 'Amazon Luxembourg' },
        supplierAddress: { value: '38 Avenue JFK' },
        supplierCompanyRegistrations: [{ type: 'VAT NUMBER', value: 'LU26375245' }],
      };

      // ACT
      const result = parseSupplierContact(extraction);

      // ASSERT
      expect(result.address?.countryCode).toBe('LU');
    });

    it('handles missing email and phone', () => {
      // ARRANGE
      const extraction: RawExtractionData = {
        supplierName: { value: 'Minimal Supplier' },
      };

      // ACT
      const result = parseSupplierContact(extraction);

      // ASSERT
      expect(result.email).toBeNull();
      expect(result.phone).toBeNull();
    });

    it('handles missing address', () => {
      // ARRANGE
      const extraction: RawExtractionData = {
        supplierName: { value: 'No Address Supplier' },
      };

      // ACT
      const result = parseSupplierContact(extraction);

      // ASSERT
      expect(result.address).toBeNull();
    });
  });

  describe('parseCustomerContact', () => {
    it('parses complete customer contact data', () => {
      // ARRANGE
      const extraction: RawExtractionData = {
        customerName: { value: 'Client Inc' },
        customerAddress: { value: '456 Oak Ave, Munich' },
        customerCompanyRegistrations: [{ type: 'VAT NUMBER', value: 'DE987654321' }],
      };

      // ACT
      const result = parseCustomerContact(extraction);

      // ASSERT
      expect(result).toEqual({
        role: 'customer',
        name: 'Client Inc',
        vatId: 'DE987654321',
        entityType: 'legal_entity',
        address: {
          countryCode: 'DE',
          addressLine: '456 Oak Ave, Munich',
        },
        email: null, // Always null for customer
        phone: null, // Always null for customer
        rawExtraction: extraction,
      });
    });

    it('throws ContactNameNotFoundError when customer name is missing', () => {
      // ARRANGE
      const extraction: RawExtractionData = {
        customerAddress: { value: '456 Oak Ave' },
      };

      // ACT & ASSERT
      expect(() => parseCustomerContact(extraction)).toThrow(ContactNameNotFoundError);
      expect(() => parseCustomerContact(extraction)).toThrow(
        'Contact name not found in extraction for customer'
      );
    });

    it('always sets email and phone to null', () => {
      // ARRANGE - Even if customer email/phone were in extraction
      const extraction: RawExtractionData = {
        customerName: { value: 'Client Inc' },
        // Note: Mindee doesn't provide customer email/phone in their schema
      };

      // ACT
      const result = parseCustomerContact(extraction);

      // ASSERT
      expect(result.email).toBeNull();
      expect(result.phone).toBeNull();
    });

    it('sets entityType to individual when no VAT ID', () => {
      // ARRANGE
      const extraction: RawExtractionData = {
        customerName: { value: 'Jane Doe' },
      };

      // ACT
      const result = parseCustomerContact(extraction);

      // ASSERT
      expect(result.entityType).toBe('individual');
    });
  });

  describe('parseContactFromExtraction', () => {
    const fullExtraction: RawExtractionData = {
      supplierName: { value: 'Supplier Co' },
      supplierAddress: { value: 'Supplier Street 1' },
      supplierEmail: { value: 'supplier@example.com' },
      supplierPhoneNumber: { value: '+49 111 222333' },
      supplierCompanyRegistrations: [{ type: 'VAT NUMBER', value: 'DE111111111' }],
      customerName: { value: 'Customer Co' },
      customerAddress: { value: 'Customer Street 2' },
      customerCompanyRegistrations: [{ type: 'VAT NUMBER', value: 'DE222222222' }],
    };

    it('parses supplier contact when isExpense=true', () => {
      // ACT
      const result = parseContactFromExtraction(fullExtraction, true);

      // ASSERT
      expect(result.role).toBe('supplier');
      expect(result.name).toBe('Supplier Co');
      expect(result.vatId).toBe('DE111111111');
      expect(result.email).toBe('supplier@example.com');
      expect(result.phone).toBe('+49 111 222333');
    });

    it('parses customer contact when isExpense=false', () => {
      // ACT
      const result = parseContactFromExtraction(fullExtraction, false);

      // ASSERT
      expect(result.role).toBe('customer');
      expect(result.name).toBe('Customer Co');
      expect(result.vatId).toBe('DE222222222');
      expect(result.email).toBeNull(); // Customer has no email in Mindee
      expect(result.phone).toBeNull(); // Customer has no phone in Mindee
    });
  });

  describe('integration scenarios from spec', () => {
    describe('expense document - full supplier data', () => {
      it('extracts complete supplier contact from real-world extraction', () => {
        // ARRANGE - Simulating real Mindee extraction
        const extraction: RawExtractionData = {
          supplierName: { value: 'AMAZON EUROPE CORE S.A R.L.' },
          supplierAddress: { value: '38, AVENUE JOHN F. KENNEDY\nL-1855  LUXEMBOURG' },
          supplierEmail: { value: 'orders@amazon.lu' },
          supplierPhoneNumber: { value: '+352 26 73 00' },
          supplierCompanyRegistrations: [
            { type: 'COMPANY REGISTRATION', value: 'B-148441' },
            { type: 'VAT NUMBER', value: 'LU26375245' },
          ],
          customerName: { value: 'My Company GmbH' },
          customerAddress: { value: 'Hauptstraße 1, 10115 Berlin' },
          customerCompanyRegistrations: [{ type: 'VAT NUMBER', value: 'DE123456789' }],
        };

        // ACT
        const result = parseContactFromExtraction(extraction, true); // expense = create supplier

        // ASSERT
        expect(result.role).toBe('supplier');
        expect(result.name).toBe('AMAZON EUROPE CORE S.A R.L.');
        expect(result.vatId).toBe('LU26375245');
        expect(result.entityType).toBe('legal_entity');
        expect(result.address).toEqual({
          countryCode: 'LU',
          addressLine: '38, AVENUE JOHN F. KENNEDY\nL-1855  LUXEMBOURG',
        });
        expect(result.email).toBe('orders@amazon.lu');
        expect(result.phone).toBe('+352 26 73 00');
      });
    });

    describe('income document - customer data', () => {
      it('extracts customer contact without email/phone', () => {
        // ARRANGE
        const extraction: RawExtractionData = {
          supplierName: { value: 'My Company GmbH' },
          supplierAddress: { value: 'Hauptstraße 1' },
          supplierCompanyRegistrations: [{ type: 'VAT NUMBER', value: 'DE123456789' }],
          customerName: { value: 'Client Corp' },
          customerAddress: { value: '5th Avenue, NYC' },
          customerCompanyRegistrations: [{ type: 'VAT NUMBER', value: 'US123456789' }],
        };

        // ACT
        const result = parseContactFromExtraction(extraction, false); // income = create customer

        // ASSERT
        expect(result.role).toBe('customer');
        expect(result.name).toBe('Client Corp');
        expect(result.vatId).toBe('US123456789');
        expect(result.email).toBeNull();
        expect(result.phone).toBeNull();
      });
    });

    describe('no VAT ID scenarios', () => {
      it('sets entityType to individual when supplier has no VAT', () => {
        // ARRANGE
        const extraction: RawExtractionData = {
          supplierName: { value: 'Freelancer John' },
          supplierAddress: { value: 'Some Street 5' },
          supplierCompanyRegistrations: [], // empty registrations
        };

        // ACT
        const result = parseContactFromExtraction(extraction, true);

        // ASSERT
        expect(result.entityType).toBe('individual');
        expect(result.vatId).toBeNull();
        expect(result.address?.countryCode).toBe(''); // No country from VAT
      });

      it('sets entityType to individual when customer has no VAT', () => {
        // ARRANGE
        const extraction: RawExtractionData = {
          customerName: { value: 'Private Person' },
          customerAddress: { value: 'Home Address' },
          // No customerCompanyRegistrations
        };

        // ACT
        const result = parseContactFromExtraction(extraction, false);

        // ASSERT
        expect(result.entityType).toBe('individual');
        expect(result.vatId).toBeNull();
      });
    });

    describe('multiple registrations', () => {
      it('only extracts VAT NUMBER type from registrations', () => {
        // ARRANGE
        const extraction: RawExtractionData = {
          supplierName: { value: 'Multi-Reg Company' },
          supplierCompanyRegistrations: [
            { type: 'COMPANY REGISTRATION', value: 'REG-12345' },
            { type: 'TAX NUMBER', value: 'TAX-67890' },
            { type: 'SIRET', value: '123456789' },
            { type: 'VAT NUMBER', value: 'FR12345678901' },
          ],
        };

        // ACT
        const result = parseContactFromExtraction(extraction, true);

        // ASSERT
        expect(result.vatId).toBe('FR12345678901');
      });
    });
  });
});
