import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import {
  buildTestAddress,
  buildTestOcrContactInput,
  createTestCompany,
  createTestGlobalContact,
} from '../../../../tests/factories/index.js';
import { db } from '../../../db/index.js';
import { server } from '../../../mocks/server.js';
import * as contactsRepository from '../repositories/contacts.repository.js';
import { findContactById } from '../repositories/contacts.repository.js';
import { findRelationshipsByContactId } from '../repositories/global-contacts-companies.repository.js';
import {
  CompanyNotFoundError,
  type ContactResolverOptions,
  resolveContactFromOcr,
} from './contact-resolver.service.js';
import type { ViesServiceConfig } from './vies.service.js';

// Test VIES config
const testViesConfig: ViesServiceConfig = {
  apiKey: 'test-api-key',
  baseUrl: 'https://api.vatcheckapi.com/v2',
  timeout: 5000,
  retryAttempts: 0,
  retryDelayMs: 100,
};

const testOptions: ContactResolverOptions = {
  database: db,
  viesConfig: testViesConfig,
};

describe('contact-resolver.service', () => {
  describe('resolveContactFromOcr', () => {
    describe('when no VAT ID is provided', () => {
      it('creates contact from OCR data with source=ocr', async () => {
        // ARRANGE:
        const input = buildTestOcrContactInput({
          name: 'OCR Only Company',
          vatId: null,
          email: 'ocr@example.com',
        });

        // ACT:
        const result = await resolveContactFromOcr(input, testOptions);

        // ASSERT:
        expect(result.isNew).toBe(true);
        expect(result.contact.name).toBe('OCR Only Company');
        expect(result.contact.source).toBe('ocr');
        expect(result.contact.email).toBe('ocr@example.com');
        expect(result.contact.vatId).toBeNull();
      });

      it('stores address from OCR data', async () => {
        // ARRANGE:
        const address = buildTestAddress({
          countryCode: 'DE',
          city: 'Munich',
          postalCode: '80331',
        });
        const input = buildTestOcrContactInput({
          name: 'Address Test',
          vatId: null,
          address,
        });

        // ACT:
        const result = await resolveContactFromOcr(input, testOptions);

        // ASSERT:
        expect(result.contact.billingAddress).toEqual(address);
        expect(result.contact.countryCode).toBe('DE');
      });
    });

    describe('when VAT ID is provided and contact exists', () => {
      it('returns existing contact with isNew=false', async () => {
        // ARRANGE:
        const vatId = `DE${Date.now()}`;
        const existingContact = await createTestGlobalContact({
          name: 'Existing Company',
          source: 'vies',
          vatId,
        });

        const input = buildTestOcrContactInput({
          name: 'Different Name',
          vatId,
        });

        // ACT:
        const result = await resolveContactFromOcr(input, testOptions);

        // ASSERT:
        expect(result.isNew).toBe(false);
        expect(result.contact.id).toBe(existingContact.id);
        expect(result.contact.name).toBe('Existing Company'); // Uses existing, not input
      });
    });

    describe('when VAT ID is provided and VIES validation succeeds', () => {
      it('creates contact from VIES data with source=vies', async () => {
        // ARRANGE:
        // Use unique VAT ID to avoid collision with previous test runs
        const uniqueId = Date.now().toString().slice(-9);
        const vatId = `DE${uniqueId}`;

        // Set up VIES to return valid response for this specific VAT
        server.use(
          http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
            const url = new URL(request.url);
            if (url.searchParams.get('vat_number') === vatId) {
              return HttpResponse.json({
                country_code: 'DE',
                vat_number: uniqueId,
                format_valid: true,
                checksum_valid: true,
                registration_info: {
                  is_registered: true,
                  name: 'ACME Corp GmbH',
                  address: 'Hauptstraße 123\n10115 Berlin',
                  checked_at: new Date().toISOString(),
                },
              });
            }
            return HttpResponse.json({ error: 'VAT not found' }, { status: 404 });
          })
        );

        const input = buildTestOcrContactInput({
          name: 'OCR Name',
          vatId,
          email: 'vies@example.com',
        });

        // ACT:
        const result = await resolveContactFromOcr(input, testOptions);

        // ASSERT:
        expect(result.isNew).toBe(true);
        expect(result.contact.source).toBe('vies');
        expect(result.contact.name).toBe('ACME Corp GmbH'); // From VIES, not OCR
        expect(result.contact.vatId).toBe(vatId);
        expect(result.contact.countryCode).toBe('DE');
        expect(result.contact.email).toBe('vies@example.com'); // From OCR input
      });

      it('stores VIES address as addressLine', async () => {
        // ARRANGE:
        // Use unique VAT ID to avoid collision with previous test runs
        const uniqueId = Date.now().toString().slice(-9);
        const vatId = `DE${uniqueId}`;

        // Set up VIES to return valid response for this specific VAT
        server.use(
          http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
            const url = new URL(request.url);
            if (url.searchParams.get('vat_number') === vatId) {
              return HttpResponse.json({
                country_code: 'DE',
                vat_number: uniqueId,
                format_valid: true,
                checksum_valid: true,
                registration_info: {
                  is_registered: true,
                  name: 'Address VIES Test',
                  address: 'Hauptstraße 123\n10115 Berlin',
                  checked_at: new Date().toISOString(),
                },
              });
            }
            return HttpResponse.json({ error: 'VAT not found' }, { status: 404 });
          })
        );

        const input = buildTestOcrContactInput({
          name: 'Address VIES Test',
          vatId,
        });

        // ACT:
        const result = await resolveContactFromOcr(input, testOptions);

        // ASSERT:
        expect(result.contact.billingAddress).toEqual({
          countryCode: 'DE',
          addressLine: 'Hauptstraße 123\n10115 Berlin',
        });
      });
    });

    describe('when VAT ID is provided but VIES validation fails', () => {
      it('falls back to OCR data when VAT format is invalid', async () => {
        // ARRANGE:
        // Use unique VAT ID to avoid collision with previous test runs
        const uniqueId = Date.now().toString().slice(-6);
        const vatId = `INV${uniqueId}`;

        // Set up VIES to return invalid format for this specific VAT
        server.use(
          http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
            const url = new URL(request.url);
            if (url.searchParams.get('vat_number') === vatId) {
              return HttpResponse.json({
                country_code: '',
                vat_number: vatId,
                format_valid: false,
                checksum_valid: false,
                registration_info: {
                  is_registered: false,
                  name: '',
                  address: '',
                  checked_at: new Date().toISOString(),
                },
              });
            }
            return HttpResponse.json({ error: 'VAT not found' }, { status: 404 });
          })
        );

        const input = buildTestOcrContactInput({
          name: 'Fallback Company',
          vatId,
          email: 'fallback@example.com',
        });

        // ACT:
        const result = await resolveContactFromOcr(input, testOptions);

        // ASSERT:
        expect(result.isNew).toBe(true);
        expect(result.contact.source).toBe('ocr');
        expect(result.contact.name).toBe('Fallback Company'); // Uses OCR name
        // API contract: vatId is preserved from OCR input even when VIES validation fails
        expect(result.contact.vatId).toBe(vatId);
      });

      it('falls back to OCR data when VAT is not registered', async () => {
        // ARRANGE:
        // Use unique VAT ID to avoid collision with previous test runs
        const uniqueId = Date.now().toString().slice(-9);
        const vatId = `DE${uniqueId}`;

        // Set up VIES to return unregistered for this specific VAT
        server.use(
          http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
            const url = new URL(request.url);
            if (url.searchParams.get('vat_number') === vatId) {
              return HttpResponse.json({
                country_code: 'DE',
                vat_number: uniqueId,
                format_valid: true,
                checksum_valid: true,
                registration_info: {
                  is_registered: false,
                  name: '',
                  address: '',
                  checked_at: new Date().toISOString(),
                },
              });
            }
            return HttpResponse.json({ error: 'VAT not found' }, { status: 404 });
          })
        );

        const input = buildTestOcrContactInput({
          name: 'Unregistered VAT Company',
          vatId,
        });

        // ACT:
        const result = await resolveContactFromOcr(input, testOptions);

        // ASSERT:
        expect(result.isNew).toBe(true);
        expect(result.contact.source).toBe('ocr');
        expect(result.contact.name).toBe('Unregistered VAT Company');
        // API contract: vatId is preserved from OCR input even when VAT is not registered
        expect(result.contact.vatId).toBe(vatId);
      });

      it('falls back to OCR data when VIES API is rate limited', async () => {
        // ARRANGE:
        // Use unique VAT ID to avoid collision with previous test runs
        const uniqueId = Date.now().toString().slice(-9);
        const vatId = `RL${uniqueId}`;

        // Set up VIES to return rate limit for this specific VAT
        server.use(
          http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
            const url = new URL(request.url);
            if (url.searchParams.get('vat_number') === vatId) {
              return HttpResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
            }
            return HttpResponse.json({ error: 'VAT not found' }, { status: 404 });
          })
        );

        const input = buildTestOcrContactInput({
          name: 'Rate Limited Company',
          vatId,
        });

        // ACT:
        const result = await resolveContactFromOcr(input, testOptions);

        // ASSERT:
        expect(result.isNew).toBe(true);
        expect(result.contact.source).toBe('ocr');
        // API contract: vatId is preserved from OCR input even on HTTP errors
        expect(result.contact.vatId).toBe(vatId);
      });

      it('falls back to OCR data when VIES API returns error', async () => {
        // ARRANGE:
        // Use unique VAT ID to avoid collision with previous test runs
        const uniqueId = Date.now().toString().slice(-9);
        const vatId = `DE${uniqueId}`;

        server.use(
          http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
            const url = new URL(request.url);
            if (url.searchParams.get('vat_number') === vatId) {
              return HttpResponse.json({ error: 'Server error' }, { status: 500 });
            }
            return HttpResponse.json({ error: 'VAT not found' }, { status: 404 });
          })
        );

        const input = buildTestOcrContactInput({
          name: 'Server Error Company',
          vatId,
        });

        // ACT:
        const result = await resolveContactFromOcr(input, testOptions);

        // ASSERT:
        expect(result.isNew).toBe(true);
        expect(result.contact.source).toBe('ocr');
        // API contract: vatId is preserved from OCR input even on server errors
        expect(result.contact.vatId).toBe(vatId);
      });
    });

    describe('idempotency', () => {
      it('returns same contact for same VAT ID on subsequent calls', async () => {
        // ARRANGE:
        // Use a short unique VAT ID (max 20 chars for DB column)
        const shortId = Date.now().toString().slice(-8);
        const vatId = `DE${shortId}`;

        // Set up VIES to return valid data for this VAT
        server.use(
          http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
            const url = new URL(request.url);
            const requestVat = url.searchParams.get('vat_number');
            if (requestVat === vatId) {
              return HttpResponse.json({
                country_code: 'DE',
                vat_number: vatId.substring(2),
                format_valid: true,
                checksum_valid: true,
                registration_info: {
                  is_registered: true,
                  name: 'Idempotent Company',
                  address: 'Test Address',
                  checked_at: new Date().toISOString(),
                },
              });
            }
            // Return a default response for other VAT numbers
            return HttpResponse.json({
              country_code: requestVat?.substring(0, 2) || 'XX',
              vat_number: requestVat?.substring(2) || '',
              format_valid: true,
              checksum_valid: true,
              registration_info: {
                is_registered: true,
                name: 'Default Company',
                address: 'Default Address',
                checked_at: new Date().toISOString(),
              },
            });
          })
        );

        const input = buildTestOcrContactInput({
          name: 'First Call Name',
          vatId,
        });

        // ACT: First call creates contact
        const firstResult = await resolveContactFromOcr(input, testOptions);
        expect(firstResult.isNew).toBe(true);

        // ACT: Second call returns existing contact
        const secondInput = buildTestOcrContactInput({
          name: 'Second Call Name',
          vatId,
        });
        const secondResult = await resolveContactFromOcr(secondInput, testOptions);

        // ASSERT:
        expect(secondResult.isNew).toBe(false);
        expect(secondResult.contact.id).toBe(firstResult.contact.id);
      });
    });

    describe('entity type handling', () => {
      it('defaults to legal_entity when not specified', async () => {
        // ARRANGE:
        const baseInput = buildTestOcrContactInput({
          name: 'Default Entity Type',
          vatId: null,
        });

        // ACT:
        const result = await resolveContactFromOcr(baseInput, testOptions);

        // ASSERT:
        expect(result.contact.entityType).toBe('legal_entity');
      });

      it('respects explicit individual entity type', async () => {
        // ARRANGE:
        const baseInput = buildTestOcrContactInput({
          name: 'John Doe',
          vatId: null,
        });
        const input = { ...baseInput, entityType: 'individual' as const };

        // ACT:
        const result = await resolveContactFromOcr(input, testOptions);

        // ASSERT:
        expect(result.contact.entityType).toBe('individual');
      });
    });

    describe('rawViesResponse storage', () => {
      it('stores rawViesResponse when VIES validation succeeds', async () => {
        // ARRANGE:
        const uniqueId = Date.now().toString().slice(-9);
        const vatId = `DE${uniqueId}`;

        const viesResponse = {
          country_code: 'DE',
          vat_number: uniqueId,
          format_valid: true,
          checksum_valid: true,
          registration_info: {
            is_registered: true,
            name: 'VIES Success Company',
            address: 'Test Address 123',
            checked_at: new Date().toISOString(),
          },
        };

        server.use(
          http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
            const url = new URL(request.url);
            if (url.searchParams.get('vat_number') === vatId) {
              return HttpResponse.json(viesResponse);
            }
            return HttpResponse.json({ error: 'VAT not found' }, { status: 404 });
          })
        );

        const input = buildTestOcrContactInput({
          name: 'VIES Success Company',
          vatId,
        });

        // ACT:
        const result = await resolveContactFromOcr(input, testOptions);

        // ASSERT: fetch contact from DB to check rawViesResponse
        const dbContact = await findContactById(result.contact.id, db);
        expect(dbContact).not.toBeNull();
        // rawViesResponse is wrapped with metadata (url, status, timing, etc.)
        // The actual API response is in the 'body' property
        const storedResponse = dbContact?.rawViesResponse as { body: unknown; status: number };
        expect(storedResponse?.body).toEqual(viesResponse);
        expect(storedResponse?.status).toBe(200);
      });

      it('stores rawViesResponse when VAT format is invalid', async () => {
        // ARRANGE:
        const uniqueId = Date.now().toString().slice(-6);
        const vatId = `INV${uniqueId}`;

        const viesResponse = {
          country_code: '',
          vat_number: vatId,
          format_valid: false,
          checksum_valid: false,
          registration_info: {
            is_registered: false,
            name: '',
            address: '',
            checked_at: new Date().toISOString(),
          },
        };

        server.use(
          http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
            const url = new URL(request.url);
            if (url.searchParams.get('vat_number') === vatId) {
              return HttpResponse.json(viesResponse);
            }
            return HttpResponse.json({ error: 'VAT not found' }, { status: 404 });
          })
        );

        const input = buildTestOcrContactInput({
          name: 'Invalid Format Company',
          vatId,
        });

        // ACT:
        const result = await resolveContactFromOcr(input, testOptions);

        // ASSERT: contact created with source='ocr' but rawViesResponse stored
        expect(result.contact.source).toBe('ocr');
        const dbContact = await findContactById(result.contact.id, db);
        expect(dbContact).not.toBeNull();
        // rawViesResponse is wrapped with metadata (url, status, timing, etc.)
        // The actual API response is in the 'body' property
        const storedResponse = dbContact?.rawViesResponse as { body: unknown; status: number };
        expect(storedResponse?.body).toEqual(viesResponse);
        expect(storedResponse?.status).toBe(200);
      });

      it('stores rawViesResponse when VAT is not registered', async () => {
        // ARRANGE:
        const uniqueId = Date.now().toString().slice(-9);
        const vatId = `DE${uniqueId}`;

        const viesResponse = {
          country_code: 'DE',
          vat_number: uniqueId,
          format_valid: true,
          checksum_valid: true,
          registration_info: {
            is_registered: false,
            name: '',
            address: '',
            checked_at: new Date().toISOString(),
          },
        };

        server.use(
          http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
            const url = new URL(request.url);
            if (url.searchParams.get('vat_number') === vatId) {
              return HttpResponse.json(viesResponse);
            }
            return HttpResponse.json({ error: 'VAT not found' }, { status: 404 });
          })
        );

        const input = buildTestOcrContactInput({
          name: 'Unregistered VAT Company',
          vatId,
        });

        // ACT:
        const result = await resolveContactFromOcr(input, testOptions);

        // ASSERT: contact created with source='ocr' but rawViesResponse stored
        expect(result.contact.source).toBe('ocr');
        const dbContact = await findContactById(result.contact.id, db);
        expect(dbContact).not.toBeNull();
        // rawViesResponse is wrapped with metadata (url, status, timing, etc.)
        // The actual API response is in the 'body' property
        const storedResponse = dbContact?.rawViesResponse as { body: unknown; status: number };
        expect(storedResponse?.body).toEqual(viesResponse);
        expect(storedResponse?.status).toBe(200);
      });

      it('does not store rawViesResponse when no VAT ID provided (no VIES call)', async () => {
        // ARRANGE:
        const input = buildTestOcrContactInput({
          name: 'No VAT Company',
          vatId: null,
        });

        // ACT:
        const result = await resolveContactFromOcr(input, testOptions);

        // ASSERT: no VIES call made, so rawViesResponse should be null/undefined
        const dbContact = await findContactById(result.contact.id, db);
        expect(dbContact).not.toBeNull();
        expect(dbContact?.rawViesResponse).toBeNull();
      });

      it('stores rawViesResponse when VIES API returns HTTP error (for audit purposes)', async () => {
        // ARRANGE:
        const uniqueId = Date.now().toString().slice(-9);
        const vatId = `DE${uniqueId}`;
        const errorResponse = { error: 'Server error' };

        server.use(
          http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
            const url = new URL(request.url);
            if (url.searchParams.get('vat_number') === vatId) {
              return HttpResponse.json(errorResponse, { status: 500 });
            }
            return HttpResponse.json({ error: 'VAT not found' }, { status: 404 });
          })
        );

        const input = buildTestOcrContactInput({
          name: 'Server Error Company',
          vatId,
        });

        // ACT:
        const result = await resolveContactFromOcr(input, testOptions);

        // ASSERT: HTTP error response body is stored for audit purposes
        expect(result.contact.source).toBe('ocr');
        const dbContact = await findContactById(result.contact.id, db);
        expect(dbContact).not.toBeNull();
        // rawViesResponse is wrapped with metadata (url, status, timing, etc.)
        // The actual API response is in the 'body' property
        const storedResponse = dbContact?.rawViesResponse as { body: unknown; status: number };
        expect(storedResponse?.body).toEqual(errorResponse);
        expect(storedResponse?.status).toBe(500);
      });
    });

    describe('race condition handling', () => {
      it('returns existing contact when unique constraint violation occurs (VIES success path)', async () => {
        // ARRANGE:
        const uniqueId = Date.now().toString().slice(-9);
        const vatId = `DE${uniqueId}`;

        // Pre-create a contact with this VAT ID (simulating what another request did)
        const existingContact = await createTestGlobalContact({
          name: 'Existing Contact',
          source: 'vies',
          vatId,
        });

        // Mock findContactByVatId to return null on first call (simulating race condition)
        // then return the existing contact on second call (after unique violation)
        const findContactByVatIdSpy = vi.spyOn(contactsRepository, 'findContactByVatId');
        findContactByVatIdSpy.mockResolvedValueOnce(null); // First call returns null

        // Set up VIES to return valid data
        server.use(
          http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
            const url = new URL(request.url);
            if (url.searchParams.get('vat_number') === vatId) {
              return HttpResponse.json({
                country_code: 'DE',
                vat_number: uniqueId,
                format_valid: true,
                checksum_valid: true,
                registration_info: {
                  is_registered: true,
                  name: 'VIES Company',
                  address: 'Test Address',
                  checked_at: new Date().toISOString(),
                },
              });
            }
            return HttpResponse.json({ error: 'VAT not found' }, { status: 404 });
          })
        );

        const input = buildTestOcrContactInput({
          name: 'New Company',
          vatId,
        });

        // ACT:
        const result = await resolveContactFromOcr(input, testOptions);

        // ASSERT: should return existing contact after catching unique violation
        expect(result.isNew).toBe(false);
        expect(result.contact.id).toBe(existingContact.id);
        expect(result.contact.name).toBe('Existing Contact');

        findContactByVatIdSpy.mockRestore();
      });

      it('returns existing contact when unique constraint violation occurs (OCR fallback path)', async () => {
        // ARRANGE:
        const uniqueId = Date.now().toString().slice(-6);
        const vatId = `INV${uniqueId}`;

        // Pre-create a contact with this VAT ID (simulating what another request did)
        const existingContact = await createTestGlobalContact({
          name: 'Existing OCR Contact',
          source: 'ocr',
          vatId,
        });

        // Mock findContactByVatId to return null on first call (simulating race condition)
        const findContactByVatIdSpy = vi.spyOn(contactsRepository, 'findContactByVatId');
        findContactByVatIdSpy.mockResolvedValueOnce(null); // First call returns null

        // Set up VIES to return invalid (triggers OCR fallback path)
        server.use(
          http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
            const url = new URL(request.url);
            if (url.searchParams.get('vat_number') === vatId) {
              return HttpResponse.json({
                country_code: '',
                vat_number: vatId,
                format_valid: false,
                checksum_valid: false,
                registration_info: {
                  is_registered: false,
                  name: '',
                  address: '',
                  checked_at: new Date().toISOString(),
                },
              });
            }
            return HttpResponse.json({ error: 'VAT not found' }, { status: 404 });
          })
        );

        const input = buildTestOcrContactInput({
          name: 'New OCR Company',
          vatId,
        });

        // ACT:
        const result = await resolveContactFromOcr(input, testOptions);

        // ASSERT: should return existing contact after catching unique violation
        expect(result.isNew).toBe(false);
        expect(result.contact.id).toBe(existingContact.id);
        expect(result.contact.name).toBe('Existing OCR Contact');

        findContactByVatIdSpy.mockRestore();
      });
    });

    describe('VAT validation tracking', () => {
      it('sets isValidVatId=true and vatIdValidatedAt when VIES validation succeeds', async () => {
        // ARRANGE:
        const uniqueId = Date.now().toString().slice(-9);
        const vatId = `DE${uniqueId}`;
        const beforeCreate = new Date();

        server.use(
          http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
            const url = new URL(request.url);
            if (url.searchParams.get('vat_number') === vatId) {
              return HttpResponse.json({
                country_code: 'DE',
                vat_number: uniqueId,
                format_valid: true,
                checksum_valid: true,
                registration_info: {
                  is_registered: true,
                  name: 'VIES Validated Company',
                  address: 'Test Address 123',
                  checked_at: new Date().toISOString(),
                },
              });
            }
            return HttpResponse.json({ error: 'VAT not found' }, { status: 404 });
          })
        );

        const input = buildTestOcrContactInput({
          name: 'VIES Validated Company',
          vatId,
        });

        // ACT:
        const result = await resolveContactFromOcr(input, testOptions);

        // ASSERT:
        expect(result.contact.source).toBe('vies');
        const dbContact = await findContactById(result.contact.id, db);
        expect(dbContact).not.toBeNull();
        expect(dbContact?.isValidVatId).toBe(true);
        expect(dbContact?.vatIdValidatedAt).not.toBeNull();
        expect(dbContact?.vatIdValidatedAt).toBeInstanceOf(Date);
        expect(dbContact?.vatIdValidatedAt?.getTime()).toBeGreaterThanOrEqual(
          beforeCreate.getTime()
        );
      });

      it('sets isValidVatId=false and vatIdValidatedAt=null when VIES validation fails', async () => {
        // ARRANGE:
        const uniqueId = Date.now().toString().slice(-9);
        const vatId = `DE${uniqueId}`;

        server.use(
          http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
            const url = new URL(request.url);
            if (url.searchParams.get('vat_number') === vatId) {
              return HttpResponse.json({
                country_code: 'DE',
                vat_number: uniqueId,
                format_valid: true,
                checksum_valid: true,
                registration_info: {
                  is_registered: false,
                  name: '',
                  address: '',
                  checked_at: new Date().toISOString(),
                },
              });
            }
            return HttpResponse.json({ error: 'VAT not found' }, { status: 404 });
          })
        );

        const input = buildTestOcrContactInput({
          name: 'OCR Fallback Company',
          vatId,
        });

        // ACT:
        const result = await resolveContactFromOcr(input, testOptions);

        // ASSERT:
        expect(result.contact.source).toBe('ocr');
        // API contract: vatId is preserved from OCR input even when VIES validation fails
        expect(result.contact.vatId).toBe(vatId);
        const dbContact = await findContactById(result.contact.id, db);
        expect(dbContact).not.toBeNull();
        expect(dbContact?.isValidVatId).toBe(false);
        expect(dbContact?.vatIdValidatedAt).toBeNull();
        // VAT ID from OCR is still stored even when VIES validation fails
        expect(dbContact?.vatId).toBe(vatId);
      });

      it('stores OCR VAT ID when VIES API returns HTTP error', async () => {
        // ARRANGE:
        const uniqueId = Date.now().toString().slice(-9);
        const vatId = `DE${uniqueId}`;

        server.use(
          http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
            const url = new URL(request.url);
            if (url.searchParams.get('vat_number') === vatId) {
              return HttpResponse.json({ error: 'Server error' }, { status: 500 });
            }
            return HttpResponse.json({ error: 'VAT not found' }, { status: 404 });
          })
        );

        const input = buildTestOcrContactInput({
          name: 'API Error Company',
          vatId,
        });

        // ACT:
        const result = await resolveContactFromOcr(input, testOptions);

        // ASSERT:
        expect(result.contact.source).toBe('ocr');
        // API contract: vatId is preserved from OCR input even when VIES API fails
        expect(result.contact.vatId).toBe(vatId);
        const dbContact = await findContactById(result.contact.id, db);
        expect(dbContact).not.toBeNull();
        expect(dbContact?.isValidVatId).toBe(false);
        expect(dbContact?.vatIdValidatedAt).toBeNull();
        // VAT ID from OCR is still stored even when VIES API fails
        expect(dbContact?.vatId).toBe(vatId);
      });

      it('sets isValidVatId=false when no VAT ID is provided', async () => {
        // ARRANGE:
        const input = buildTestOcrContactInput({
          name: 'No VAT Company',
          vatId: null,
        });

        // ACT:
        const result = await resolveContactFromOcr(input, testOptions);

        // ASSERT:
        expect(result.contact.source).toBe('ocr');
        const dbContact = await findContactById(result.contact.id, db);
        expect(dbContact).not.toBeNull();
        expect(dbContact?.isValidVatId).toBe(false);
        expect(dbContact?.vatIdValidatedAt).toBeNull();
        expect(dbContact?.vatId).toBeNull();
      });
    });

    describe('company linking', () => {
      it('creates relationship when new contact created with companyId and role', async () => {
        // ARRANGE:
        const timestamp = Date.now();
        const company = await createTestCompany();
        const input = buildTestOcrContactInput({
          name: `Company Linked Contact ${timestamp}`,
          vatId: null,
        });

        // ACT:
        const result = await resolveContactFromOcr(input, {
          ...testOptions,
          companyLinking: { companyId: company.id, role: 'supplier' },
        });

        // ASSERT:
        expect(result.isNew).toBe(true);
        expect(result.relationship).toBeDefined();
        expect(result.relationship?.companyId).toBe(company.id);
        expect(result.relationship?.role).toBe('supplier');

        // Verify relationship exists in database
        const relationships = await findRelationshipsByContactId(result.contact.id, db);
        expect(relationships).toHaveLength(1);
        expect(relationships[0]?.companyId).toBe(company.id);
        expect(relationships[0]?.role).toBe('supplier');
      });

      it('creates relationship with customer role', async () => {
        // ARRANGE:
        const timestamp = Date.now();
        const company = await createTestCompany();
        const input = buildTestOcrContactInput({
          name: `Customer Contact ${timestamp}`,
          vatId: null,
        });

        // ACT:
        const result = await resolveContactFromOcr(input, {
          ...testOptions,
          companyLinking: { companyId: company.id, role: 'customer' },
        });

        // ASSERT:
        expect(result.relationship?.role).toBe('customer');
      });

      it('creates relationship when existing contact found by VAT ID with companyLinking', async () => {
        // ARRANGE:
        const timestamp = Date.now();
        const vatId = `DE${timestamp}`;
        const existingContact = await createTestGlobalContact({
          name: 'Existing Contact',
          source: 'vies',
          vatId,
        });
        const company = await createTestCompany();
        const input = buildTestOcrContactInput({
          name: 'New Name',
          vatId,
        });

        // ACT:
        const result = await resolveContactFromOcr(input, {
          ...testOptions,
          companyLinking: { companyId: company.id, role: 'supplier' },
        });

        // ASSERT:
        expect(result.isNew).toBe(false);
        expect(result.contact.id).toBe(existingContact.id);
        expect(result.relationship).toBeDefined();
        expect(result.relationship?.companyId).toBe(company.id);
        expect(result.relationship?.role).toBe('supplier');

        // Verify relationship was created
        const relationships = await findRelationshipsByContactId(existingContact.id, db);
        expect(relationships).toHaveLength(1);
        expect(relationships[0]?.companyId).toBe(company.id);
        expect(relationships[0]?.role).toBe('supplier');
      });

      it('throws CompanyNotFoundError when companyId does not exist', async () => {
        // ARRANGE:
        const nonExistentCompanyId = '00000000-0000-0000-0000-000000000000';
        const input = buildTestOcrContactInput({
          name: 'Test Company',
          vatId: null,
        });

        // ACT & ASSERT:
        await expect(
          resolveContactFromOcr(input, {
            ...testOptions,
            companyLinking: { companyId: nonExistentCompanyId, role: 'supplier' },
          })
        ).rejects.toThrow(CompanyNotFoundError);

        await expect(
          resolveContactFromOcr(input, {
            ...testOptions,
            companyLinking: { companyId: nonExistentCompanyId, role: 'supplier' },
          })
        ).rejects.toThrow(`Company not found: ${nonExistentCompanyId}`);
      });

      it('does not create relationship when companyLinking is not provided', async () => {
        // ARRANGE:
        const timestamp = Date.now();
        const input = buildTestOcrContactInput({
          name: `No Linking Contact ${timestamp}`,
          vatId: null,
        });

        // ACT:
        const result = await resolveContactFromOcr(input, testOptions);

        // ASSERT:
        expect(result.isNew).toBe(true);
        expect(result.relationship).toBeUndefined();

        // Verify no relationship exists
        const relationships = await findRelationshipsByContactId(result.contact.id, db);
        expect(relationships).toHaveLength(0);
      });

      it('creates relationship when VIES validation succeeds', async () => {
        // ARRANGE:
        const timestamp = Date.now();
        const uniqueId = timestamp.toString().slice(-9);
        const vatId = `DE${uniqueId}`;
        const company = await createTestCompany();

        server.use(
          http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
            const url = new URL(request.url);
            if (url.searchParams.get('vat_number') === vatId) {
              return HttpResponse.json({
                country_code: 'DE',
                vat_number: uniqueId,
                format_valid: true,
                checksum_valid: true,
                registration_info: {
                  is_registered: true,
                  name: 'VIES Linked Company',
                  address: 'Test Address',
                  checked_at: new Date().toISOString(),
                },
              });
            }
            return HttpResponse.json({ error: 'VAT not found' }, { status: 404 });
          })
        );

        const input = buildTestOcrContactInput({
          name: 'OCR Name',
          vatId,
        });

        // ACT:
        const result = await resolveContactFromOcr(input, {
          ...testOptions,
          companyLinking: { companyId: company.id, role: 'supplier' },
        });

        // ASSERT:
        expect(result.isNew).toBe(true);
        expect(result.contact.source).toBe('vies');
        expect(result.relationship).toBeDefined();
        expect(result.relationship?.companyId).toBe(company.id);
      });

      it('creates relationship when VIES validation fails (OCR fallback)', async () => {
        // ARRANGE:
        const timestamp = Date.now();
        const uniqueId = timestamp.toString().slice(-9);
        const vatId = `DE${uniqueId}`;
        const company = await createTestCompany();

        server.use(
          http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
            const url = new URL(request.url);
            if (url.searchParams.get('vat_number') === vatId) {
              return HttpResponse.json({ error: 'Server error' }, { status: 500 });
            }
            return HttpResponse.json({ error: 'VAT not found' }, { status: 404 });
          })
        );

        const input = buildTestOcrContactInput({
          name: 'OCR Fallback Linked',
          vatId,
        });

        // ACT:
        const result = await resolveContactFromOcr(input, {
          ...testOptions,
          companyLinking: { companyId: company.id, role: 'customer' },
        });

        // ASSERT:
        expect(result.isNew).toBe(true);
        expect(result.contact.source).toBe('ocr');
        expect(result.relationship).toBeDefined();
        expect(result.relationship?.companyId).toBe(company.id);
        expect(result.relationship?.role).toBe('customer');
      });

      it('creates relationships for multiple companies encountering same VAT ID', async () => {
        // ARRANGE: Set up two companies
        const timestamp = Date.now();
        const uniqueId = timestamp.toString().slice(-9);
        const vatId = `DE${uniqueId}`;
        const companyA = await createTestCompany();
        const companyB = await createTestCompany();

        // Set up VIES to return valid response
        server.use(
          http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
            const url = new URL(request.url);
            if (url.searchParams.get('vat_number') === vatId) {
              return HttpResponse.json({
                country_code: 'DE',
                vat_number: uniqueId,
                format_valid: true,
                checksum_valid: true,
                registration_info: {
                  is_registered: true,
                  name: 'Multi-Company Contact',
                  address: 'Test Address',
                  checked_at: new Date().toISOString(),
                },
              });
            }
            return HttpResponse.json({ error: 'VAT not found' }, { status: 404 });
          })
        );

        // ACT: Company A creates the contact first
        const inputA = buildTestOcrContactInput({ name: 'Company A Input', vatId });
        const resultA = await resolveContactFromOcr(inputA, {
          ...testOptions,
          companyLinking: { companyId: companyA.id, role: 'supplier' },
        });

        // ACT: Company B encounters the same VAT ID later
        const inputB = buildTestOcrContactInput({ name: 'Company B Input', vatId });
        const resultB = await resolveContactFromOcr(inputB, {
          ...testOptions,
          companyLinking: { companyId: companyB.id, role: 'customer' },
        });

        // ASSERT: First call creates new contact with relationship
        expect(resultA.isNew).toBe(true);
        expect(resultA.relationship).toBeDefined();
        expect(resultA.relationship?.companyId).toBe(companyA.id);
        expect(resultA.relationship?.role).toBe('supplier');

        // ASSERT: Second call returns existing contact AND creates relationship
        expect(resultB.isNew).toBe(false);
        expect(resultB.contact.id).toBe(resultA.contact.id);
        expect(resultB.relationship).toBeDefined();
        expect(resultB.relationship?.companyId).toBe(companyB.id);
        expect(resultB.relationship?.role).toBe('customer');

        // ASSERT: Both relationships exist in database
        const relationships = await findRelationshipsByContactId(resultA.contact.id, db);
        expect(relationships).toHaveLength(2);
        const companyIds = relationships.map((r) => r.companyId);
        expect(companyIds).toContain(companyA.id);
        expect(companyIds).toContain(companyB.id);
      });

      it('returns undefined relationship when existing contact found without companyLinking', async () => {
        // ARRANGE: Create existing contact
        const timestamp = Date.now();
        const vatId = `DE${timestamp}`;
        const existingContact = await createTestGlobalContact({
          name: 'Existing Contact',
          source: 'vies',
          vatId,
        });
        const input = buildTestOcrContactInput({ name: 'New Name', vatId });

        // ACT: Resolve without companyLinking
        const result = await resolveContactFromOcr(input, testOptions);

        // ASSERT: Returns existing contact without relationship
        expect(result.isNew).toBe(false);
        expect(result.contact.id).toBe(existingContact.id);
        expect(result.relationship).toBeUndefined();

        // Verify no relationship was created
        const relationships = await findRelationshipsByContactId(existingContact.id, db);
        expect(relationships).toHaveLength(0);
      });

      it('is idempotent - calling twice with same company returns same relationship', async () => {
        // ARRANGE:
        const timestamp = Date.now();
        const vatId = `DE${timestamp}`;
        const existingContact = await createTestGlobalContact({
          name: 'Existing Contact',
          source: 'vies',
          vatId,
        });
        const company = await createTestCompany();
        const input = buildTestOcrContactInput({ name: 'Input Name', vatId });

        // ACT: Call twice with same company
        const result1 = await resolveContactFromOcr(input, {
          ...testOptions,
          companyLinking: { companyId: company.id, role: 'supplier' },
        });

        const result2 = await resolveContactFromOcr(input, {
          ...testOptions,
          companyLinking: { companyId: company.id, role: 'supplier' },
        });

        // ASSERT: Both return the same contact
        expect(result1.contact.id).toBe(existingContact.id);
        expect(result2.contact.id).toBe(existingContact.id);

        // ASSERT: Only one relationship exists (idempotent)
        const relationships = await findRelationshipsByContactId(existingContact.id, db);
        expect(relationships).toHaveLength(1);
        expect(relationships[0]?.companyId).toBe(company.id);
      });
    });

    describe('name validation', () => {
      it('throws error when both VIES and OCR names are empty', async () => {
        // ARRANGE:
        const uniqueId = Date.now().toString().slice(-9);
        const vatId = `DE${uniqueId}`;

        // Set up VIES to return valid but with empty name
        server.use(
          http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
            const url = new URL(request.url);
            if (url.searchParams.get('vat_number') === vatId) {
              return HttpResponse.json({
                country_code: 'DE',
                vat_number: uniqueId,
                format_valid: true,
                checksum_valid: true,
                registration_info: {
                  is_registered: true,
                  name: '', // Empty VIES name
                  address: 'Test Address',
                  checked_at: new Date().toISOString(),
                },
              });
            }
            return HttpResponse.json({ error: 'VAT not found' }, { status: 404 });
          })
        );

        const input = buildTestOcrContactInput({
          name: '', // Empty OCR name
          vatId,
        });

        // ACT & ASSERT:
        await expect(resolveContactFromOcr(input, testOptions)).rejects.toThrow(
          'Contact name is required but was empty'
        );
      });

      it('throws error when VIES name is empty and OCR name is whitespace only', async () => {
        // ARRANGE:
        const uniqueId = Date.now().toString().slice(-9);
        const vatId = `DE${uniqueId}`;

        // Set up VIES to return valid but with empty name
        server.use(
          http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
            const url = new URL(request.url);
            if (url.searchParams.get('vat_number') === vatId) {
              return HttpResponse.json({
                country_code: 'DE',
                vat_number: uniqueId,
                format_valid: true,
                checksum_valid: true,
                registration_info: {
                  is_registered: true,
                  name: '', // Empty VIES name
                  address: 'Test Address',
                  checked_at: new Date().toISOString(),
                },
              });
            }
            return HttpResponse.json({ error: 'VAT not found' }, { status: 404 });
          })
        );

        const input = buildTestOcrContactInput({
          name: '   ', // Whitespace-only OCR name
          vatId,
        });

        // ACT & ASSERT:
        await expect(resolveContactFromOcr(input, testOptions)).rejects.toThrow(
          'Contact name is required but was empty'
        );
      });

      it('falls back to OCR name when VIES name is empty', async () => {
        // ARRANGE:
        const uniqueId = Date.now().toString().slice(-9);
        const vatId = `DE${uniqueId}`;

        // Set up VIES to return valid but with empty name
        server.use(
          http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
            const url = new URL(request.url);
            if (url.searchParams.get('vat_number') === vatId) {
              return HttpResponse.json({
                country_code: 'DE',
                vat_number: uniqueId,
                format_valid: true,
                checksum_valid: true,
                registration_info: {
                  is_registered: true,
                  name: '', // Empty VIES name
                  address: 'Test Address',
                  checked_at: new Date().toISOString(),
                },
              });
            }
            return HttpResponse.json({ error: 'VAT not found' }, { status: 404 });
          })
        );

        const input = buildTestOcrContactInput({
          name: 'OCR Fallback Name', // Valid OCR name
          vatId,
        });

        // ACT:
        const result = await resolveContactFromOcr(input, testOptions);

        // ASSERT: Should use OCR name as fallback
        expect(result.contact.name).toBe('OCR Fallback Name');
        expect(result.contact.source).toBe('vies'); // Still from VIES path
      });

      it('throws error when OCR-only name is empty (no VAT ID)', async () => {
        // ARRANGE:
        const input = buildTestOcrContactInput({
          name: '', // Empty OCR name
          vatId: null, // No VAT ID - OCR-only path
        });

        // ACT & ASSERT:
        await expect(resolveContactFromOcr(input, testOptions)).rejects.toThrow(
          'Contact name is required but was empty'
        );
      });

      it('throws error when OCR-only name is whitespace (no VAT ID)', async () => {
        // ARRANGE:
        const input = buildTestOcrContactInput({
          name: '   ', // Whitespace-only OCR name
          vatId: null, // No VAT ID - OCR-only path
        });

        // ACT & ASSERT:
        await expect(resolveContactFromOcr(input, testOptions)).rejects.toThrow(
          'Contact name is required but was empty'
        );
      });

      it('throws error when VIES-fallback OCR name is empty', async () => {
        // ARRANGE:
        const uniqueId = Date.now().toString().slice(-9);
        const vatId = `DE${uniqueId}`;

        // Set up VIES to return not registered (fallback to OCR)
        server.use(
          http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
            const url = new URL(request.url);
            if (url.searchParams.get('vat_number') === vatId) {
              return HttpResponse.json({
                country_code: 'DE',
                vat_number: uniqueId,
                format_valid: true,
                checksum_valid: true,
                registration_info: {
                  is_registered: false, // Not registered - triggers OCR fallback
                  name: '',
                  address: '',
                  checked_at: new Date().toISOString(),
                },
              });
            }
            return HttpResponse.json({ error: 'VAT not found' }, { status: 404 });
          })
        );

        const input = buildTestOcrContactInput({
          name: '', // Empty OCR name
          vatId,
        });

        // ACT & ASSERT: Should fail because OCR fallback has empty name
        await expect(resolveContactFromOcr(input, testOptions)).rejects.toThrow(
          'Contact name is required but was empty'
        );
      });

      it('throws error when VIES-fallback OCR name is whitespace', async () => {
        // ARRANGE:
        const uniqueId = Date.now().toString().slice(-9);
        const vatId = `DE${uniqueId}`;

        // Set up VIES to return API error (fallback to OCR)
        server.use(
          http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
            const url = new URL(request.url);
            if (url.searchParams.get('vat_number') === vatId) {
              return HttpResponse.json({ error: 'Server error' }, { status: 500 });
            }
            return HttpResponse.json({ error: 'VAT not found' }, { status: 404 });
          })
        );

        const input = buildTestOcrContactInput({
          name: '   ', // Whitespace-only OCR name
          vatId,
        });

        // ACT & ASSERT: Should fail because OCR fallback has whitespace-only name
        await expect(resolveContactFromOcr(input, testOptions)).rejects.toThrow(
          'Contact name is required but was empty'
        );
      });
    });
  });
});
