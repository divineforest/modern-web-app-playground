import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestCompany,
  createTestGlobalContact,
  createTestGlobalContactCompany,
} from '../../../../tests/factories/index.js';
import { buildTestApp } from '../../../app.js';
import { server } from '../../../mocks/server.js';
import type { RawExtractionData } from '../domain/raw-extraction.types.js';
import { RegistrationTypes } from '../domain/raw-extraction.types.js';

/**
 * Helper to build raw extraction data for tests
 */
function buildRawExtraction(options: {
  supplier?: { name?: string; vatId?: string; address?: string; email?: string; phone?: string };
  customer?: { name?: string; vatId?: string; address?: string };
}): RawExtractionData {
  const extraction: RawExtractionData = {};

  if (options.supplier) {
    if (options.supplier.name) {
      extraction.supplierName = { value: options.supplier.name };
    }
    if (options.supplier.address) {
      extraction.supplierAddress = { value: options.supplier.address };
    }
    if (options.supplier.email) {
      extraction.supplierEmail = { value: options.supplier.email };
    }
    if (options.supplier.phone) {
      extraction.supplierPhoneNumber = { value: options.supplier.phone };
    }
    if (options.supplier.vatId) {
      extraction.supplierCompanyRegistrations = [
        { type: RegistrationTypes.VAT_NUMBER, value: options.supplier.vatId },
      ];
    }
  }

  if (options.customer) {
    if (options.customer.name) {
      extraction.customerName = { value: options.customer.name };
    }
    if (options.customer.address) {
      extraction.customerAddress = { value: options.customer.address };
    }
    if (options.customer.vatId) {
      extraction.customerCompanyRegistrations = [
        { type: RegistrationTypes.VAT_NUMBER, value: options.customer.vatId },
      ];
    }
  }

  return extraction;
}

describe('POST /api/internal/contacts/from-ocr', () => {
  let fastify: FastifyInstance;
  const authHeaders = { authorization: 'Bearer test_token_12345' };

  beforeEach(async () => {
    fastify = await buildTestApp();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('counterparty matching - company matches customer (expense document)', () => {
    it('creates supplier contact with role=supplier when company VAT matches customer (201)', async () => {
      // ARRANGE
      const timestamp = Date.now();
      const companyVatId = `DE${timestamp}`;
      const supplierVatId = `LU${timestamp}`;

      // Create company with VAT ID in companyDetails
      const company = await createTestCompany({
        name: 'My Company GmbH',
        companyDetails: { vatId: companyVatId },
      });

      // Set up VIES mock for supplier VAT validation
      server.use(
        http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('vat_number') === supplierVatId) {
            return HttpResponse.json({
              country_code: 'LU',
              vat_number: supplierVatId.substring(2),
              format_valid: true,
              checksum_valid: true,
              registration_info: {
                is_registered: true,
                name: 'VIES Supplier Name',
                address: 'VIES Address 123',
                checked_at: new Date().toISOString(),
              },
            });
          }
          return undefined;
        })
      );

      const documentId = randomUUID();
      const payload = {
        companyId: company.id,
        documentId,
        rawExtraction: buildRawExtraction({
          supplier: {
            name: 'OCR Supplier Name',
            vatId: supplierVatId,
            address: 'Supplier Street 1, Luxembourg',
            email: 'billing@supplier.lu',
            phone: '+352 123 456',
          },
          customer: {
            name: 'My Company GmbH',
            vatId: companyVatId, // Company matches customer
            address: 'Customer Street 2, Berlin',
          },
        }),
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload,
      });

      // ASSERT
      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.contact).toBeDefined();
      expect(body.contact.source).toBe('vies');
      expect(body.contact.name).toBe('VIES Supplier Name');
      expect(body.contact.vatId).toBe(supplierVatId);
      expect(body.relationship).toBeDefined();
      expect(body.relationship.role).toBe('supplier');
      expect(body.relationship.companyId).toBe(company.id);
      expect(body.documentLink).toBeDefined();
      expect(body.documentLink.documentId).toBe(documentId);
    });

    it('creates supplier contact with email and phone from OCR (201)', async () => {
      // ARRANGE
      const timestamp = Date.now();
      const companyVatId = `DE${timestamp}`;
      const supplierVatId = `LU${timestamp}`;

      const company = await createTestCompany({
        name: 'My Company',
        companyDetails: { vatId: companyVatId },
      });

      // VIES returns valid but use OCR email/phone
      server.use(
        http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('vat_number') === supplierVatId) {
            return HttpResponse.json({
              country_code: 'LU',
              vat_number: supplierVatId.substring(2),
              format_valid: true,
              checksum_valid: true,
              registration_info: {
                is_registered: true,
                name: 'Validated Supplier',
                address: 'Validated Address',
                checked_at: new Date().toISOString(),
              },
            });
          }
          return undefined;
        })
      );

      const payload = {
        companyId: company.id,
        documentId: randomUUID(),
        rawExtraction: buildRawExtraction({
          supplier: {
            name: 'OCR Supplier',
            vatId: supplierVatId,
            email: 'supplier@example.com',
            phone: '+352 999 888',
          },
          customer: {
            name: 'My Company',
            vatId: companyVatId,
          },
        }),
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload,
      });

      // ASSERT
      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.contact.email).toBe('supplier@example.com');
      expect(body.contact.phone).toBe('+352 999 888');
      expect(body.documentLink).toBeDefined();
    });
  });

  describe('counterparty matching - company matches supplier (income document)', () => {
    it('creates customer contact with role=customer when company VAT matches supplier (201)', async () => {
      // ARRANGE
      const timestamp = Date.now();
      const companyVatId = `DE${timestamp}`;
      const customerVatId = `LU${timestamp}`;

      const company = await createTestCompany({
        name: 'My Selling Company',
        companyDetails: { vatId: companyVatId },
      });

      // VIES mock for customer VAT
      server.use(
        http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('vat_number') === customerVatId) {
            return HttpResponse.json({
              country_code: 'LU',
              vat_number: customerVatId.substring(2),
              format_valid: true,
              checksum_valid: true,
              registration_info: {
                is_registered: true,
                name: 'VIES Customer Name',
                address: 'VIES Customer Address',
                checked_at: new Date().toISOString(),
              },
            });
          }
          return undefined;
        })
      );

      const payload = {
        companyId: company.id,
        documentId: randomUUID(),
        rawExtraction: buildRawExtraction({
          supplier: {
            name: 'My Selling Company',
            vatId: companyVatId, // Company matches supplier
            address: 'Supplier Address',
          },
          customer: {
            name: 'OCR Customer Name',
            vatId: customerVatId,
            address: 'Customer Address, Luxembourg',
          },
        }),
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload,
      });

      // ASSERT
      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.contact).toBeDefined();
      expect(body.contact.source).toBe('vies');
      expect(body.contact.name).toBe('VIES Customer Name');
      expect(body.contact.vatId).toBe(customerVatId);
      expect(body.relationship).toBeDefined();
      expect(body.relationship.role).toBe('customer');
      expect(body.relationship.companyId).toBe(company.id);
    });

    it('creates customer contact without email/phone (per spec) (201)', async () => {
      // ARRANGE
      const timestamp = Date.now();
      const companyVatId = `DE${timestamp}`;
      const customerVatId = `LU${timestamp}`;

      const company = await createTestCompany({
        name: 'Seller Co',
        companyDetails: { vatId: companyVatId },
      });

      server.use(
        http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('vat_number') === customerVatId) {
            return HttpResponse.json({
              country_code: 'LU',
              vat_number: customerVatId.substring(2),
              format_valid: true,
              checksum_valid: true,
              registration_info: {
                is_registered: true,
                name: 'Customer Corp',
                address: 'Customer Address',
                checked_at: new Date().toISOString(),
              },
            });
          }
          return undefined;
        })
      );

      const payload = {
        companyId: company.id,
        documentId: randomUUID(),
        rawExtraction: buildRawExtraction({
          supplier: {
            name: 'Seller Co',
            vatId: companyVatId,
          },
          customer: {
            name: 'Customer Corp',
            vatId: customerVatId,
          },
        }),
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload,
      });

      // ASSERT
      expect(response.statusCode).toBe(201);
      const body = response.json();
      // Customer contacts don't have email/phone in Mindee extraction
      expect(body.contact.email).toBeNull();
      expect(body.contact.phone).toBeNull();
    });
  });

  describe('counterparty matching - name matching fallback', () => {
    it('matches company to customer by name when no VAT ID (201)', async () => {
      // ARRANGE
      const timestamp = Date.now();
      const supplierVatId = `LU${timestamp}`;

      // Company without VAT ID in companyDetails
      const company = await createTestCompany({
        name: 'My Company Name',
        companyDetails: {}, // No VAT ID
      });

      server.use(
        http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('vat_number') === supplierVatId) {
            return HttpResponse.json({
              country_code: 'LU',
              vat_number: supplierVatId.substring(2),
              format_valid: true,
              checksum_valid: true,
              registration_info: {
                is_registered: true,
                name: 'Supplier Name',
                address: 'Address',
                checked_at: new Date().toISOString(),
              },
            });
          }
          return undefined;
        })
      );

      const payload = {
        companyId: company.id,
        documentId: randomUUID(),
        rawExtraction: buildRawExtraction({
          supplier: {
            name: 'Supplier Name',
            vatId: supplierVatId,
          },
          customer: {
            name: 'My Company Name', // Name matches company
          },
        }),
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload,
      });

      // ASSERT
      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.relationship.role).toBe('supplier'); // Expense document
    });

    it('matches company to customer by normalized name with different suffix (201)', async () => {
      // ARRANGE
      const company = await createTestCompany({
        name: 'Acme Corp GmbH',
        companyDetails: {},
      });

      const payload = {
        companyId: company.id,
        documentId: randomUUID(),
        rawExtraction: buildRawExtraction({
          supplier: {
            name: 'Supplier LLC',
          },
          customer: {
            name: 'Acme Corp Ltd', // Different suffix but same base name
          },
        }),
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload,
      });

      // ASSERT
      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.relationship.role).toBe('supplier');
    });
  });

  describe('counterparty matching - error cases', () => {
    it('returns 400 when no matching counterparty found', async () => {
      // ARRANGE
      const timestamp = Date.now();

      const company = await createTestCompany({
        name: 'Unrelated Company',
        companyDetails: { vatId: `DE${timestamp}` },
      });

      const payload = {
        companyId: company.id,
        documentId: randomUUID(),
        rawExtraction: buildRawExtraction({
          supplier: {
            name: 'Different Supplier',
            vatId: 'LU111111111',
          },
          customer: {
            name: 'Different Customer',
            vatId: 'LU222222222',
          },
        }),
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload,
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toContain('No matching');
    });

    it('returns 400 when company not found', async () => {
      // ARRANGE
      const nonExistentCompanyId = '00000000-0000-0000-0000-000000000000';

      const payload = {
        companyId: nonExistentCompanyId,
        documentId: randomUUID(),
        rawExtraction: buildRawExtraction({
          supplier: { name: 'Supplier' },
          customer: { name: 'Customer' },
        }),
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload,
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toContain('Company not found');
    });

    it('returns 400 when contact name is missing in extraction', async () => {
      // ARRANGE
      const timestamp = Date.now();
      const companyVatId = `DE${timestamp}`;

      const company = await createTestCompany({
        name: 'My Company',
        companyDetails: { vatId: companyVatId },
      });

      const payload = {
        companyId: company.id,
        documentId: randomUUID(),
        rawExtraction: buildRawExtraction({
          supplier: {
            // name is missing!
            vatId: 'LU123456789',
          },
          customer: {
            name: 'My Company',
            vatId: companyVatId,
          },
        }),
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload,
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toContain('Contact name not found');
    });
  });

  describe('VIES validation - success scenarios', () => {
    it('creates contact with source=vies and isValidVatId=true when VIES succeeds (201)', async () => {
      // ARRANGE
      const timestamp = Date.now();
      const companyVatId = `DE${timestamp}`;
      const supplierVatId = `LU${timestamp}`;

      const company = await createTestCompany({
        name: 'My Company',
        companyDetails: { vatId: companyVatId },
      });

      server.use(
        http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('vat_number') === supplierVatId) {
            return HttpResponse.json({
              country_code: 'LU',
              vat_number: supplierVatId.substring(2),
              format_valid: true,
              checksum_valid: true,
              registration_info: {
                is_registered: true,
                name: 'VIES Validated Company',
                address: 'VIES Address',
                checked_at: new Date().toISOString(),
              },
            });
          }
          return undefined;
        })
      );

      const payload = {
        companyId: company.id,
        documentId: randomUUID(),
        rawExtraction: buildRawExtraction({
          supplier: {
            name: 'OCR Name',
            vatId: supplierVatId,
          },
          customer: {
            name: 'My Company',
            vatId: companyVatId,
          },
        }),
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload,
      });

      // ASSERT
      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.contact.source).toBe('vies');
      expect(body.contact.name).toBe('VIES Validated Company');
    });
  });

  describe('VIES validation - fallback to OCR', () => {
    it('creates contact with source=ocr when VIES API returns 500 (201)', async () => {
      // ARRANGE
      const timestamp = Date.now();
      const companyVatId = `DE${timestamp}`;
      const supplierVatId = `LU${timestamp}`;

      const company = await createTestCompany({
        name: 'My Company',
        companyDetails: { vatId: companyVatId },
      });

      server.use(
        http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('vat_number') === supplierVatId) {
            return HttpResponse.json({ error: 'Server error' }, { status: 500 });
          }
          return undefined;
        })
      );

      const payload = {
        companyId: company.id,
        documentId: randomUUID(),
        rawExtraction: buildRawExtraction({
          supplier: {
            name: 'OCR Supplier Name',
            vatId: supplierVatId,
            address: 'OCR Address',
          },
          customer: {
            name: 'My Company',
            vatId: companyVatId,
          },
        }),
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload,
      });

      // ASSERT
      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.contact.source).toBe('ocr');
      expect(body.contact.name).toBe('OCR Supplier Name');
    });

    it('creates contact with source=ocr when VAT is not registered (201)', async () => {
      // ARRANGE
      const timestamp = Date.now();
      const companyVatId = `DE${timestamp}`;
      const supplierVatId = `LU${timestamp}`;

      const company = await createTestCompany({
        name: 'My Company',
        companyDetails: { vatId: companyVatId },
      });

      server.use(
        http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('vat_number') === supplierVatId) {
            return HttpResponse.json({
              country_code: 'LU',
              vat_number: supplierVatId.substring(2),
              format_valid: true,
              checksum_valid: true,
              registration_info: {
                is_registered: false, // Not registered
                name: '',
                address: '',
                checked_at: new Date().toISOString(),
              },
            });
          }
          return undefined;
        })
      );

      const payload = {
        companyId: company.id,
        documentId: randomUUID(),
        rawExtraction: buildRawExtraction({
          supplier: {
            name: 'Unregistered Company',
            vatId: supplierVatId,
          },
          customer: {
            name: 'My Company',
            vatId: companyVatId,
          },
        }),
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload,
      });

      // ASSERT
      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.contact.source).toBe('ocr');
      expect(body.contact.name).toBe('Unregistered Company');
    });

    it('uses OCR name when VIES returns empty name (201)', async () => {
      // ARRANGE
      const timestamp = Date.now();
      const companyVatId = `DE${timestamp}`;
      const supplierVatId = `LU${timestamp}`;

      const company = await createTestCompany({
        name: 'My Company',
        companyDetails: { vatId: companyVatId },
      });

      server.use(
        http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('vat_number') === supplierVatId) {
            return HttpResponse.json({
              country_code: 'LU',
              vat_number: supplierVatId.substring(2),
              format_valid: true,
              checksum_valid: true,
              registration_info: {
                is_registered: true,
                name: '', // Empty name
                address: 'Some Address',
                checked_at: new Date().toISOString(),
              },
            });
          }
          return undefined;
        })
      );

      const payload = {
        companyId: company.id,
        documentId: randomUUID(),
        rawExtraction: buildRawExtraction({
          supplier: {
            name: 'OCR Fallback Name',
            vatId: supplierVatId,
          },
          customer: {
            name: 'My Company',
            vatId: companyVatId,
          },
        }),
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload,
      });

      // ASSERT
      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.contact.source).toBe('vies');
      expect(body.contact.name).toBe('OCR Fallback Name');
    });
  });

  describe('no VAT ID in extraction', () => {
    it('creates contact with source=ocr without VIES call (201)', async () => {
      // ARRANGE
      const company = await createTestCompany({
        name: 'My Company',
        companyDetails: {},
      });

      const payload = {
        companyId: company.id,
        documentId: randomUUID(),
        rawExtraction: buildRawExtraction({
          supplier: {
            name: 'Supplier Without VAT',
            address: 'Some Address',
            email: 'contact@supplier.com',
            // No VAT ID
          },
          customer: {
            name: 'My Company',
          },
        }),
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload,
      });

      // ASSERT
      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.contact.source).toBe('ocr');
      expect(body.contact.name).toBe('Supplier Without VAT');
      expect(body.contact.vatId).toBeNull();
      expect(body.contact.entityType).toBe('individual');
    });
  });

  describe('existing contact found', () => {
    it('returns existing contact with 200 when VAT ID matches (creates relationship)', async () => {
      // ARRANGE
      const timestamp = Date.now();
      const companyVatId = `DE${timestamp}`;
      const supplierVatId = `LU${timestamp}`;

      const company = await createTestCompany({
        name: 'My Company',
        companyDetails: { vatId: companyVatId },
      });

      // Pre-create the contact
      const existingContact = await createTestGlobalContact({
        name: 'Existing Supplier',
        source: 'vies',
        vatId: supplierVatId,
      });

      const payload = {
        companyId: company.id,
        documentId: randomUUID(),
        rawExtraction: buildRawExtraction({
          supplier: {
            name: 'New Name From OCR',
            vatId: supplierVatId, // Same VAT ID as existing
          },
          customer: {
            name: 'My Company',
            vatId: companyVatId,
          },
        }),
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload,
      });

      // ASSERT
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.contact.id).toBe(existingContact.id);
      expect(body.contact.name).toBe('Existing Supplier'); // Not updated
      // Relationship is now created for existing contacts when companyId is provided
      expect(body.relationship).toBeDefined();
      expect(body.relationship.companyId).toBe(company.id);
      expect(body.relationship.role).toBe('supplier');
      // Document link is created even for existing contacts
      expect(body.documentLink).toBeDefined();
      expect(body.documentLink.documentId).toBeDefined();
    });
  });

  describe('idempotency', () => {
    it('first call returns 201, second call returns 200 for same VAT ID', async () => {
      // ARRANGE
      const timestamp = Date.now();
      const companyVatId = `DE${timestamp}`;
      const supplierVatId = `LU${timestamp}`;

      const company = await createTestCompany({
        name: 'My Company',
        companyDetails: { vatId: companyVatId },
      });

      server.use(
        http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('vat_number') === supplierVatId) {
            return HttpResponse.json({
              country_code: 'LU',
              vat_number: supplierVatId.substring(2),
              format_valid: true,
              checksum_valid: true,
              registration_info: {
                is_registered: true,
                name: 'Idempotent Company',
                address: 'Address',
                checked_at: new Date().toISOString(),
              },
            });
          }
          return undefined;
        })
      );

      const payload = {
        companyId: company.id,
        documentId: randomUUID(),
        rawExtraction: buildRawExtraction({
          supplier: {
            name: 'Supplier',
            vatId: supplierVatId,
          },
          customer: {
            name: 'My Company',
            vatId: companyVatId,
          },
        }),
      };

      // ACT: First call
      const firstResponse = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload,
      });

      expect(firstResponse.statusCode).toBe(201);
      const firstBody = firstResponse.json();
      expect(firstBody.relationship).toBeDefined();
      expect(firstBody.documentLink).toBeDefined();

      // ACT: Second call
      const secondResponse = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload,
      });

      // ASSERT
      expect(secondResponse.statusCode).toBe(200);
      const secondBody = secondResponse.json();
      expect(secondBody.contact.id).toBe(firstBody.contact.id);
      // With upsert behavior, relationship is always returned (updated if exists)
      expect(secondBody.relationship).toBeDefined();
      expect(secondBody.relationship.id).toBe(firstBody.relationship.id); // Same relationship
      expect(secondBody.relationship.companyId).toBe(company.id);
      expect(secondBody.relationship.role).toBe('supplier');
      // Document link is idempotent - same link returned
      expect(secondBody.documentLink).toBeDefined();
      expect(secondBody.documentLink.id).toBe(firstBody.documentLink.id);
    });

    it('same contact can link to different documents', async () => {
      // ARRANGE
      const timestamp = Date.now();
      const companyVatId = `DE${timestamp}`;
      const supplierVatId = `LU${timestamp}`;
      const documentId1 = randomUUID();
      const documentId2 = randomUUID();

      const company = await createTestCompany({
        name: 'My Company',
        companyDetails: { vatId: companyVatId },
      });

      server.use(
        http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('vat_number') === supplierVatId) {
            return HttpResponse.json({
              country_code: 'LU',
              vat_number: supplierVatId.substring(2),
              format_valid: true,
              checksum_valid: true,
              registration_info: {
                is_registered: true,
                name: 'Multi Doc Company',
                address: 'Address',
                checked_at: new Date().toISOString(),
              },
            });
          }
          return undefined;
        })
      );

      const baseRawExtraction = buildRawExtraction({
        supplier: {
          name: 'Supplier',
          vatId: supplierVatId,
        },
        customer: {
          name: 'My Company',
          vatId: companyVatId,
        },
      });

      // ACT: First call with document 1
      const firstResponse = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload: {
          companyId: company.id,
          documentId: documentId1,
          rawExtraction: baseRawExtraction,
        },
      });

      expect(firstResponse.statusCode).toBe(201);
      const firstBody = firstResponse.json();

      // ACT: Second call with different document
      const secondResponse = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload: {
          companyId: company.id,
          documentId: documentId2,
          rawExtraction: baseRawExtraction,
        },
      });

      // ASSERT
      expect(secondResponse.statusCode).toBe(200); // Existing contact
      const secondBody = secondResponse.json();
      expect(secondBody.contact.id).toBe(firstBody.contact.id); // Same contact
      expect(secondBody.documentLink.documentId).toBe(documentId2); // Different document link
      expect(secondBody.documentLink.id).not.toBe(firstBody.documentLink.id); // Different link ID
    });
  });

  describe('entity type handling', () => {
    it('sets entityType to legal_entity when VAT ID is present (201)', async () => {
      // ARRANGE
      const timestamp = Date.now();
      const companyVatId = `DE${timestamp}`;
      const supplierVatId = `LU${timestamp}`;

      const company = await createTestCompany({
        name: 'My Company',
        companyDetails: { vatId: companyVatId },
      });

      server.use(
        http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('vat_number') === supplierVatId) {
            return HttpResponse.json({
              country_code: 'LU',
              vat_number: supplierVatId.substring(2),
              format_valid: true,
              checksum_valid: true,
              registration_info: {
                is_registered: true,
                name: 'Legal Entity',
                address: 'Address',
                checked_at: new Date().toISOString(),
              },
            });
          }
          return undefined;
        })
      );

      const payload = {
        companyId: company.id,
        documentId: randomUUID(),
        rawExtraction: buildRawExtraction({
          supplier: {
            name: 'Legal Entity',
            vatId: supplierVatId,
          },
          customer: {
            name: 'My Company',
            vatId: companyVatId,
          },
        }),
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload,
      });

      // ASSERT
      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.contact.entityType).toBe('legal_entity');
    });

    it('sets entityType to individual when no VAT ID (201)', async () => {
      // ARRANGE
      const company = await createTestCompany({
        name: 'My Company',
        companyDetails: {},
      });

      const payload = {
        companyId: company.id,
        documentId: randomUUID(),
        rawExtraction: buildRawExtraction({
          supplier: {
            name: 'Individual Supplier',
            // No VAT ID
          },
          customer: {
            name: 'My Company',
          },
        }),
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload,
      });

      // ASSERT
      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.contact.entityType).toBe('individual');
    });
  });

  describe('validation errors', () => {
    it('returns 400 when companyId is missing', async () => {
      // ARRANGE
      const payload = {
        documentId: randomUUID(),
        rawExtraction: buildRawExtraction({
          supplier: { name: 'Supplier' },
          customer: { name: 'Customer' },
        }),
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload,
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
    });

    it('returns 400 when documentId is missing', async () => {
      // ARRANGE
      const company = await createTestCompany();

      const payload = {
        companyId: company.id,
        rawExtraction: buildRawExtraction({
          supplier: { name: 'Supplier' },
          customer: { name: 'Customer' },
        }),
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload,
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
    });

    it('returns 400 when rawExtraction is missing', async () => {
      // ARRANGE
      const company = await createTestCompany();

      const payload = {
        companyId: company.id,
        documentId: randomUUID(),
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload,
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
    });

    it('returns 400 when companyId is not a valid UUID', async () => {
      // ARRANGE
      const payload = {
        companyId: 'not-a-uuid',
        documentId: randomUUID(),
        rawExtraction: {},
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload,
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
    });
  });

  describe('ACL', () => {
    it('returns 401 without authentication', async () => {
      // ARRANGE
      const company = await createTestCompany();

      const payload = {
        companyId: company.id,
        documentId: randomUUID(),
        rawExtraction: buildRawExtraction({
          supplier: { name: 'Supplier' },
          customer: { name: 'Customer' },
        }),
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        payload,
        // No auth headers
      });

      // ASSERT
      expect(response.statusCode).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      // ARRANGE
      const company = await createTestCompany();

      const payload = {
        companyId: company.id,
        documentId: randomUUID(),
        rawExtraction: buildRawExtraction({
          supplier: { name: 'Supplier' },
          customer: { name: 'Customer' },
        }),
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: { authorization: 'Bearer invalid_token' },
        payload,
      });

      // ASSERT
      expect(response.statusCode).toBe(401);
    });
  });
});

describe('GET /api/internal/global-contacts', () => {
  let fastify: FastifyInstance;
  const authHeaders = { authorization: 'Bearer test_token_12345' };

  beforeEach(async () => {
    fastify = await buildTestApp();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('basic listing', () => {
    it('returns contacts sorted by updated_at desc by default (200)', async () => {
      // ARRANGE:
      const timestamp = Date.now();
      const company = await createTestCompany();
      const contact1 = await createTestGlobalContact({
        name: `List Test A ${timestamp}`,
        source: 'ocr',
      });
      await createTestGlobalContactCompany({
        globalContactId: contact1.id,
        companyId: company.id,
        role: 'supplier',
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const contact2 = await createTestGlobalContact({
        name: `List Test B ${timestamp}`,
        source: 'ocr',
      });
      await createTestGlobalContactCompany({
        globalContactId: contact2.id,
        companyId: company.id,
        role: 'supplier',
      });

      // ACT:
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/global-contacts?company_id=${company.id}`,
        headers: authHeaders,
      });

      // ASSERT:
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.contacts).toHaveLength(2);
      expect(body.contacts[0].id).toBe(contact2.id); // Most recent first
      expect(body.contacts[1].id).toBe(contact1.id);
      expect(body.pagination.hasMore).toBe(false);
    });

    it('returns empty contacts array when no matches (200)', async () => {
      // ARRANGE: Use a company with no contacts
      const company = await createTestCompany();

      // ACT:
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/global-contacts?company_id=${company.id}`,
        headers: authHeaders,
      });

      // ASSERT:
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.contacts).toHaveLength(0);
      expect(body.pagination.hasMore).toBe(false);
    });
  });

  describe('filtering', () => {
    it('filters by source (200)', async () => {
      // ARRANGE:
      const timestamp = Date.now();
      const company = await createTestCompany();
      const ocrContact = await createTestGlobalContact({
        name: `OCR ${timestamp}`,
        source: 'ocr',
      });
      await createTestGlobalContactCompany({
        globalContactId: ocrContact.id,
        companyId: company.id,
        role: 'supplier',
      });
      const viesContact = await createTestGlobalContact({
        name: `VIES ${timestamp}`,
        source: 'vies',
        vatId: `DE${timestamp}`,
      });
      await createTestGlobalContactCompany({
        globalContactId: viesContact.id,
        companyId: company.id,
        role: 'supplier',
      });

      // ACT:
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/global-contacts?company_id=${company.id}&source=ocr`,
        headers: authHeaders,
      });

      // ASSERT:
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.contacts).toHaveLength(1);
      expect(body.contacts[0].source).toBe('ocr');
    });

    it('filters by role (200)', async () => {
      // ARRANGE:
      const timestamp = Date.now();
      const company = await createTestCompany();
      const supplierContact = await createTestGlobalContact({
        name: `Supplier ${timestamp}`,
        source: 'ocr',
      });
      await createTestGlobalContactCompany({
        globalContactId: supplierContact.id,
        companyId: company.id,
        role: 'supplier',
      });
      const customerContact = await createTestGlobalContact({
        name: `Customer ${timestamp}`,
        source: 'ocr',
      });
      await createTestGlobalContactCompany({
        globalContactId: customerContact.id,
        companyId: company.id,
        role: 'customer',
      });

      // ACT:
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/global-contacts?company_id=${company.id}&role=supplier`,
        headers: authHeaders,
      });

      // ASSERT:
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.contacts).toHaveLength(1);
      expect(body.contacts[0].id).toBe(supplierContact.id);
    });

    it('returns 400 when role is provided without company_id', async () => {
      // ACT:
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/internal/global-contacts?role=supplier',
        headers: authHeaders,
      });

      // ASSERT:
      expect(response.statusCode).toBe(400);
      const body = response.json();
      // Zod refine validation returns error - check for company_id in response body
      const bodyString = JSON.stringify(body);
      expect(bodyString).toContain('company_id');
    });

    it('filters by bob_reference_id (200)', async () => {
      // ARRANGE:
      const timestamp = Date.now();
      const bobRefId = `bob-${timestamp}`;
      const company = await createTestCompany({ bobReferenceId: bobRefId });
      const contact = await createTestGlobalContact({
        name: `Bob Ref Test ${timestamp}`,
        source: 'ocr',
      });
      await createTestGlobalContactCompany({
        globalContactId: contact.id,
        companyId: company.id,
        role: 'supplier',
      });

      // Create another company without bob_reference_id with a contact
      const otherCompany = await createTestCompany();
      const otherContact = await createTestGlobalContact({
        name: `Other Company Contact ${timestamp}`,
        source: 'ocr',
      });
      await createTestGlobalContactCompany({
        globalContactId: otherContact.id,
        companyId: otherCompany.id,
        role: 'supplier',
      });

      // ACT:
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/global-contacts?bob_reference_id=${bobRefId}`,
        headers: authHeaders,
      });

      // ASSERT:
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.contacts).toHaveLength(1);
      expect(body.contacts[0].id).toBe(contact.id);
    });

    it('filters by bob_reference_id with role (200)', async () => {
      // ARRANGE:
      const timestamp = Date.now();
      const bobRefId = `bob-role-${timestamp}`;
      const company = await createTestCompany({ bobReferenceId: bobRefId });

      const supplierContact = await createTestGlobalContact({
        name: `Supplier Bob ${timestamp}`,
        source: 'ocr',
      });
      await createTestGlobalContactCompany({
        globalContactId: supplierContact.id,
        companyId: company.id,
        role: 'supplier',
      });

      const customerContact = await createTestGlobalContact({
        name: `Customer Bob ${timestamp}`,
        source: 'ocr',
      });
      await createTestGlobalContactCompany({
        globalContactId: customerContact.id,
        companyId: company.id,
        role: 'customer',
      });

      // ACT:
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/global-contacts?bob_reference_id=${bobRefId}&role=supplier`,
        headers: authHeaders,
      });

      // ASSERT:
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.contacts).toHaveLength(1);
      expect(body.contacts[0].id).toBe(supplierContact.id);
    });

    it('returns empty array when bob_reference_id not found (200)', async () => {
      // ACT:
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/internal/global-contacts?bob_reference_id=non-existent-bob-ref',
        headers: authHeaders,
      });

      // ASSERT:
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.contacts).toHaveLength(0);
      expect(body.pagination.hasMore).toBe(false);
    });

    it('returns 400 when both company_id and bob_reference_id are provided', async () => {
      // ARRANGE:
      const timestamp = Date.now();
      const bobRefId = `bob-both-${timestamp}`;
      const company = await createTestCompany({ bobReferenceId: bobRefId });

      // ACT:
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/global-contacts?company_id=${company.id}&bob_reference_id=${bobRefId}`,
        headers: authHeaders,
      });

      // ASSERT:
      expect(response.statusCode).toBe(400);
      const body = response.json();
      const bodyString = JSON.stringify(body);
      expect(bodyString).toContain('mutually exclusive');
    });

    it('allows role filter with bob_reference_id (200)', async () => {
      // ARRANGE:
      const timestamp = Date.now();
      const bobRefId = `bob-role-check-${timestamp}`;
      const company = await createTestCompany({ bobReferenceId: bobRefId });
      const contact = await createTestGlobalContact({
        name: `Role Check ${timestamp}`,
        source: 'ocr',
      });
      await createTestGlobalContactCompany({
        globalContactId: contact.id,
        companyId: company.id,
        role: 'customer',
      });

      // ACT:
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/global-contacts?bob_reference_id=${bobRefId}&role=customer`,
        headers: authHeaders,
      });

      // ASSERT:
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.contacts).toHaveLength(1);
    });

    it('filters by updated_at_gt with timezone offset (200)', async () => {
      // ARRANGE:
      const timestamp = Date.now();
      const company = await createTestCompany();
      const contact = await createTestGlobalContact({
        name: `Updated At Test ${timestamp}`,
        source: 'ocr',
      });
      await createTestGlobalContactCompany({
        globalContactId: contact.id,
        companyId: company.id,
        role: 'supplier',
      });

      // Use a date in the past to ensure the contact is included
      const pastDate = new Date(Date.now() - 86400000).toISOString().replace('Z', '+00:00');

      // ACT:
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/global-contacts?company_id=${company.id}&updated_at_gt=${encodeURIComponent(pastDate)}`,
        headers: authHeaders,
      });

      // ASSERT:
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.contacts.length).toBeGreaterThanOrEqual(1);
    });

    it('filters by updated_at_gt with Z suffix (200)', async () => {
      // ARRANGE:
      const timestamp = Date.now();
      const company = await createTestCompany();
      const contact = await createTestGlobalContact({
        name: `Updated At Z Test ${timestamp}`,
        source: 'ocr',
      });
      await createTestGlobalContactCompany({
        globalContactId: contact.id,
        companyId: company.id,
        role: 'supplier',
      });

      // Use a date in the past with Z suffix
      const pastDate = new Date(Date.now() - 86400000).toISOString();

      // ACT:
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/global-contacts?company_id=${company.id}&updated_at_gt=${encodeURIComponent(pastDate)}`,
        headers: authHeaders,
      });

      // ASSERT:
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.contacts.length).toBeGreaterThanOrEqual(1);
    });

    it('filters by updated_at_lt with timezone offset (200)', async () => {
      // ARRANGE:
      const timestamp = Date.now();
      const company = await createTestCompany();
      const contact = await createTestGlobalContact({
        name: `Updated At LT Test ${timestamp}`,
        source: 'ocr',
      });
      await createTestGlobalContactCompany({
        globalContactId: contact.id,
        companyId: company.id,
        role: 'supplier',
      });

      // Use a date in the future to ensure the contact is included
      const futureDate = new Date(Date.now() + 86400000).toISOString().replace('Z', '+00:00');

      // ACT:
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/global-contacts?company_id=${company.id}&updated_at_lt=${encodeURIComponent(futureDate)}`,
        headers: authHeaders,
      });

      // ASSERT:
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.contacts.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 400 for invalid datetime format in updated_at_gt', async () => {
      // ACT:
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/internal/global-contacts?updated_at_gt=invalid-date',
        headers: authHeaders,
      });

      // ASSERT:
      expect(response.statusCode).toBe(400);
    });
  });

  describe('pagination', () => {
    it('paginates with limit and cursor (200)', async () => {
      // ARRANGE:
      const timestamp = Date.now();
      const company = await createTestCompany();

      const contacts = [];
      for (let i = 0; i < 3; i++) {
        const contact = await createTestGlobalContact({
          name: `Pagination ${timestamp} ${i}`,
          source: 'ocr',
        });
        await createTestGlobalContactCompany({
          globalContactId: contact.id,
          companyId: company.id,
          role: 'supplier',
        });
        contacts.push(contact);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // ACT: First page
      const page1Response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/global-contacts?company_id=${company.id}&limit=2`,
        headers: authHeaders,
      });

      // ASSERT page 1
      expect(page1Response.statusCode).toBe(200);
      const page1 = page1Response.json();
      expect(page1.contacts).toHaveLength(2);
      expect(page1.pagination.hasMore).toBe(true);
      expect(page1.pagination.nextCursor).not.toBeNull();

      // ACT: Second page
      const page2Response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/global-contacts?company_id=${company.id}&limit=2&cursor=${page1.pagination.nextCursor}`,
        headers: authHeaders,
      });

      // ASSERT page 2
      expect(page2Response.statusCode).toBe(200);
      const page2 = page2Response.json();
      expect(page2.contacts).toHaveLength(1);
      expect(page2.pagination.hasMore).toBe(false);
    });

    it('returns 400 for invalid cursor format', async () => {
      // ACT:
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/internal/global-contacts?cursor=invalid-cursor',
        headers: authHeaders,
      });

      // ASSERT:
      expect(response.statusCode).toBe(400);
    });
  });

  describe('sorting', () => {
    it('sorts by name ascending (200)', async () => {
      // ARRANGE:
      const timestamp = Date.now();
      const company = await createTestCompany();
      const contactZ = await createTestGlobalContact({
        name: `Z Company ${timestamp}`,
        source: 'ocr',
      });
      await createTestGlobalContactCompany({
        globalContactId: contactZ.id,
        companyId: company.id,
        role: 'supplier',
      });
      const contactA = await createTestGlobalContact({
        name: `A Company ${timestamp}`,
        source: 'ocr',
      });
      await createTestGlobalContactCompany({
        globalContactId: contactA.id,
        companyId: company.id,
        role: 'supplier',
      });

      // ACT:
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/global-contacts?company_id=${company.id}&sort=name:asc`,
        headers: authHeaders,
      });

      // ASSERT:
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.contacts).toHaveLength(2);
      expect(body.contacts[0].id).toBe(contactA.id);
      expect(body.contacts[1].id).toBe(contactZ.id);
    });
  });

  describe('bob_id in response', () => {
    it('returns bob_id as id when company filter and bob_id present (200)', async () => {
      // ARRANGE:
      const timestamp = Date.now();
      const company = await createTestCompany();
      const bobId = `bob_test_${timestamp}`;
      const contact = await createTestGlobalContact({
        name: `Bob ID Contact ${timestamp}`,
        source: 'vies',
        vatId: `DE${timestamp}`,
      });
      await createTestGlobalContactCompany({
        globalContactId: contact.id,
        companyId: company.id,
        role: 'supplier',
        bobId,
      });

      // ACT:
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/global-contacts?company_id=${company.id}`,
        headers: authHeaders,
      });

      // ASSERT:
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.contacts).toHaveLength(1);
      // bob_id should be returned as the id field
      expect(body.contacts[0].id).toBe(bobId);
      // Other fields should still be from the contact
      expect(body.contacts[0].name).toBe(`Bob ID Contact ${timestamp}`);
    });

    it('returns contact id when company filter but bob_id is null (200)', async () => {
      // ARRANGE:
      const timestamp = Date.now();
      const company = await createTestCompany();
      const contact = await createTestGlobalContact({
        name: `No Bob ID Contact ${timestamp}`,
        source: 'ocr',
      });
      await createTestGlobalContactCompany({
        globalContactId: contact.id,
        companyId: company.id,
        role: 'supplier',
        bobId: null, // Explicitly null
      });

      // ACT:
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/global-contacts?company_id=${company.id}`,
        headers: authHeaders,
      });

      // ASSERT:
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.contacts).toHaveLength(1);
      // Should use contact.id since bob_id is null
      expect(body.contacts[0].id).toBe(contact.id);
    });

    it('returns bob_id as id when bob_reference_id filter and bob_id present (200)', async () => {
      // ARRANGE:
      const timestamp = Date.now();
      const bobRefId = `bob-ref-${timestamp}`;
      const bobId = `bob_id_${timestamp}`;
      const company = await createTestCompany({ bobReferenceId: bobRefId });
      const contact = await createTestGlobalContact({
        name: `Bob Ref Test ${timestamp}`,
        source: 'vies',
        vatId: `LU${timestamp}`,
      });
      await createTestGlobalContactCompany({
        globalContactId: contact.id,
        companyId: company.id,
        role: 'customer',
        bobId,
      });

      // ACT:
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/global-contacts?bob_reference_id=${bobRefId}`,
        headers: authHeaders,
      });

      // ASSERT:
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.contacts).toHaveLength(1);
      expect(body.contacts[0].id).toBe(bobId);
    });

    it('returns contact id when no company filter even if bob_id exists (200)', async () => {
      // ARRANGE:
      const timestamp = Date.now();
      const company = await createTestCompany();
      const contact = await createTestGlobalContact({
        name: `No Company Filter ${timestamp}`,
        source: 'ocr',
      });
      await createTestGlobalContactCompany({
        globalContactId: contact.id,
        companyId: company.id,
        role: 'supplier',
        bobId: 'bob_should_not_appear',
      });

      // ACT: List without company filter
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/internal/global-contacts',
        headers: authHeaders,
      });

      // ASSERT:
      expect(response.statusCode).toBe(200);
      const body: { contacts: Array<{ id: string; name: string }> } = response.json();
      // Find the test contact in results
      const found = body.contacts.find((c) => c.name === `No Company Filter ${timestamp}`);
      // Without company filter, bob_id is not available, so id should be contact.id
      expect(found?.id).toBe(contact.id);
    });
  });

  describe('ACL', () => {
    it('returns 401 without authentication', async () => {
      // ACT:
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/internal/global-contacts',
        // No auth headers
      });

      // ASSERT:
      expect(response.statusCode).toBe(401);
    });
  });
});

describe('GET /api/internal/global-contacts/:id', () => {
  let fastify: FastifyInstance;
  const authHeaders = { authorization: 'Bearer test_token_12345' };

  beforeEach(async () => {
    fastify = await buildTestApp();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('happy path', () => {
    it('returns contact with company relationships (200)', async () => {
      // ARRANGE:
      const timestamp = Date.now();
      const contact = await createTestGlobalContact({
        name: `Get By ID Test ${timestamp}`,
        source: 'ocr',
        email: 'test@example.com',
      });
      const company = await createTestCompany();
      await createTestGlobalContactCompany({
        globalContactId: contact.id,
        companyId: company.id,
        role: 'supplier',
      });

      // ACT:
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/global-contacts/${contact.id}`,
        headers: authHeaders,
      });

      // ASSERT:
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.contact.id).toBe(contact.id);
      expect(body.contact.name).toBe(`Get By ID Test ${timestamp}`);
      expect(body.contact.email).toBe('test@example.com');
      expect(body.contact.companies).toHaveLength(1);
      expect(body.contact.companies[0].companyId).toBe(company.id);
      expect(body.contact.companies[0].role).toBe('supplier');
    });

    it('returns contact without companies when no relationships exist (200)', async () => {
      // ARRANGE:
      const timestamp = Date.now();
      const contact = await createTestGlobalContact({
        name: `No Companies Test ${timestamp}`,
        source: 'ocr',
      });

      // ACT:
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/global-contacts/${contact.id}`,
        headers: authHeaders,
      });

      // ASSERT:
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.contact.id).toBe(contact.id);
      expect(body.contact.companies).toHaveLength(0);
    });
  });

  describe('error cases', () => {
    it('returns 404 when contact not found', async () => {
      // ARRANGE:
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT:
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/global-contacts/${nonExistentId}`,
        headers: authHeaders,
      });

      // ASSERT:
      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error).toBe('Contact not found');
    });

    it('returns 400 for invalid UUID format', async () => {
      // ACT:
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/internal/global-contacts/invalid-uuid',
        headers: authHeaders,
      });

      // ASSERT:
      expect(response.statusCode).toBe(400);
    });
  });

  describe('ACL', () => {
    it('returns 401 without authentication', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({
        name: 'ACL Test',
        source: 'ocr',
      });

      // ACT:
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/global-contacts/${contact.id}`,
        // No auth headers
      });

      // ASSERT:
      expect(response.statusCode).toBe(401);
    });
  });
});
