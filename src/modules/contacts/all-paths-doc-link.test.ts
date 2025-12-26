/**
 * Comprehensive test to verify document links are created in ALL code paths
 * for the /from-ocr endpoint.
 */
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestCompany, createTestGlobalContact } from '../../../tests/factories/index.js';
import { buildTestApp } from '../../app.js';
import { db } from '../../db/index.js';
import { server } from '../../mocks/server.js';
import { RegistrationTypes } from './domain/raw-extraction.types.js';
import { findDocumentLinksByContactId } from './repositories/global-contacts-documents.repository.js';

function buildRawExtraction(options: {
  supplier?: { name?: string; vatId?: string };
  customer?: { name?: string; vatId?: string };
}) {
  const extraction: Record<string, unknown> = {};
  if (options.supplier) {
    if (options.supplier.name) extraction['supplierName'] = { value: options.supplier.name };
    if (options.supplier.vatId) {
      extraction['supplierCompanyRegistrations'] = [
        { type: RegistrationTypes.VAT_NUMBER, value: options.supplier.vatId },
      ];
    }
  }
  if (options.customer) {
    if (options.customer.name) extraction['customerName'] = { value: options.customer.name };
    if (options.customer.vatId) {
      extraction['customerCompanyRegistrations'] = [
        { type: RegistrationTypes.VAT_NUMBER, value: options.customer.vatId },
      ];
    }
  }
  return extraction;
}

describe('/from-ocr document link creation - ALL PATHS', () => {
  let fastify: FastifyInstance;
  const authHeaders = { authorization: 'Bearer test_token_12345' };

  beforeEach(async () => {
    fastify = await buildTestApp();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('Path 1: No VAT ID - creates new contact from OCR', () => {
    it('MUST create document link in database', async () => {
      const company = await createTestCompany({
        name: 'My Company',
        companyDetails: {},
      });
      const documentId = randomUUID();

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload: {
          companyId: company.id,
          documentId,
          rawExtraction: buildRawExtraction({
            supplier: { name: 'Supplier Without VAT' },
            customer: { name: 'My Company' },
          }),
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();

      // Verify response has documentLink
      expect(body.documentLink).toBeDefined();
      expect(body.documentLink.documentId).toBe(documentId);

      // CRITICAL: Verify document link is actually in database
      const dbLinks = await findDocumentLinksByContactId(body.contact.id, db);
      const matchingLink = dbLinks.find((link) => link.documentId === documentId);
      expect(matchingLink).toBeDefined();
      expect(matchingLink?.documentId).toBe(documentId);
    });
  });

  describe('Path 2: Existing contact found by VAT ID', () => {
    it('MUST create document link in database for existing contact', async () => {
      const uniqueId = `${Date.now()}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
      const companyVatId = `DE${uniqueId}`;
      const supplierVatId = `LU${uniqueId}`;
      const documentId = randomUUID();

      const company = await createTestCompany({
        name: 'My Company',
        companyDetails: { vatId: companyVatId },
      });

      // Pre-create existing contact
      const existingContact = await createTestGlobalContact({
        name: 'Existing Supplier',
        source: 'vies',
        vatId: supplierVatId,
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload: {
          companyId: company.id,
          documentId,
          rawExtraction: buildRawExtraction({
            supplier: { name: 'Supplier Name', vatId: supplierVatId },
            customer: { name: 'My Company', vatId: companyVatId },
          }),
        },
      });

      expect(response.statusCode).toBe(200); // Existing contact
      const body = response.json();
      expect(body.contact.id).toBe(existingContact.id);

      // Verify response has documentLink
      expect(body.documentLink).toBeDefined();
      expect(body.documentLink.documentId).toBe(documentId);

      // CRITICAL: Verify document link is actually in database
      const dbLinks = await findDocumentLinksByContactId(existingContact.id, db);
      const matchingLink = dbLinks.find((link) => link.documentId === documentId);
      expect(matchingLink).toBeDefined();
      expect(matchingLink?.documentId).toBe(documentId);
    });
  });

  describe('Path 3: VIES validation success - creates new contact', () => {
    it('MUST create document link in database', async () => {
      const uniqueId = `${Date.now()}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
      const companyVatId = `DE${uniqueId}`;
      const supplierVatId = `LU${uniqueId}`;
      const documentId = randomUUID();

      const company = await createTestCompany({
        name: 'My Company',
        companyDetails: { vatId: companyVatId },
      });

      // Mock VIES success
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

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload: {
          companyId: company.id,
          documentId,
          rawExtraction: buildRawExtraction({
            supplier: { name: 'OCR Name', vatId: supplierVatId },
            customer: { name: 'My Company', vatId: companyVatId },
          }),
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.contact.source).toBe('vies');

      // Verify response has documentLink
      expect(body.documentLink).toBeDefined();
      expect(body.documentLink.documentId).toBe(documentId);

      // CRITICAL: Verify document link is actually in database
      const dbLinks = await findDocumentLinksByContactId(body.contact.id, db);
      const matchingLink = dbLinks.find((link) => link.documentId === documentId);
      expect(matchingLink).toBeDefined();
      expect(matchingLink?.documentId).toBe(documentId);
    });
  });

  describe('Path 4: VIES validation failed - fallback to OCR', () => {
    it('MUST create document link in database', async () => {
      const uniqueId = `${Date.now()}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
      const companyVatId = `DE${uniqueId}`;
      const supplierVatId = `LU${uniqueId}`;
      const documentId = randomUUID();

      const company = await createTestCompany({
        name: 'My Company',
        companyDetails: { vatId: companyVatId },
      });

      // Mock VIES failure - return error for all VIES requests
      server.use(
        http.get('https://api.vatcheckapi.com/v2/check', () => {
          return HttpResponse.json({ error: 'Server error' }, { status: 500 });
        })
      );

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload: {
          companyId: company.id,
          documentId,
          rawExtraction: buildRawExtraction({
            supplier: { name: 'OCR Supplier', vatId: supplierVatId },
            customer: { name: 'My Company', vatId: companyVatId },
          }),
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.contact.source).toBe('ocr');

      // Verify response has documentLink
      expect(body.documentLink).toBeDefined();
      expect(body.documentLink.documentId).toBe(documentId);

      // CRITICAL: Verify document link is actually in database
      const dbLinks = await findDocumentLinksByContactId(body.contact.id, db);
      const matchingLink = dbLinks.find((link) => link.documentId === documentId);
      expect(matchingLink).toBeDefined();
      expect(matchingLink?.documentId).toBe(documentId);
    });
  });

  describe('Idempotency: Same contact, different documents', () => {
    it('MUST create separate document links for each documentId', async () => {
      const uniqueId = `${Date.now()}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
      const companyVatId = `DE${uniqueId}`;
      const supplierVatId = `LU${uniqueId}`;
      const documentId1 = randomUUID();
      const documentId2 = randomUUID();

      const company = await createTestCompany({
        name: 'My Company',
        companyDetails: { vatId: companyVatId },
      });

      // Pre-create existing contact
      const existingContact = await createTestGlobalContact({
        name: 'Existing Supplier',
        source: 'vies',
        vatId: supplierVatId,
      });

      // First request with documentId1
      const response1 = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload: {
          companyId: company.id,
          documentId: documentId1,
          rawExtraction: buildRawExtraction({
            supplier: { name: 'Supplier', vatId: supplierVatId },
            customer: { name: 'My Company', vatId: companyVatId },
          }),
        },
      });

      expect(response1.statusCode).toBe(200);
      const body1 = response1.json();
      expect(body1.documentLink.documentId).toBe(documentId1);

      // Second request with documentId2
      const response2 = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload: {
          companyId: company.id,
          documentId: documentId2,
          rawExtraction: buildRawExtraction({
            supplier: { name: 'Supplier', vatId: supplierVatId },
            customer: { name: 'My Company', vatId: companyVatId },
          }),
        },
      });

      expect(response2.statusCode).toBe(200);
      const body2 = response2.json();
      expect(body2.documentLink.documentId).toBe(documentId2);

      // CRITICAL: Verify BOTH document links exist in database
      const dbLinks = await findDocumentLinksByContactId(existingContact.id, db);
      expect(dbLinks.length).toBe(2);
      expect(dbLinks.some((link) => link.documentId === documentId1)).toBe(true);
      expect(dbLinks.some((link) => link.documentId === documentId2)).toBe(true);
    });
  });

  describe('Idempotency: Same contact, same document', () => {
    it('MUST return existing document link (not create duplicate)', async () => {
      const uniqueId = `${Date.now()}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
      const companyVatId = `DE${uniqueId}`;
      const supplierVatId = `LU${uniqueId}`;
      const documentId = randomUUID();

      const company = await createTestCompany({
        name: 'My Company',
        companyDetails: { vatId: companyVatId },
      });

      // Pre-create existing contact
      const existingContact = await createTestGlobalContact({
        name: 'Existing Supplier',
        source: 'vies',
        vatId: supplierVatId,
      });

      // First request
      const response1 = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload: {
          companyId: company.id,
          documentId,
          rawExtraction: buildRawExtraction({
            supplier: { name: 'Supplier', vatId: supplierVatId },
            customer: { name: 'My Company', vatId: companyVatId },
          }),
        },
      });

      expect(response1.statusCode).toBe(200);
      const body1 = response1.json();

      // Second request with SAME documentId
      const response2 = await fastify.inject({
        method: 'POST',
        url: '/api/internal/contacts/from-ocr',
        headers: authHeaders,
        payload: {
          companyId: company.id,
          documentId, // Same documentId
          rawExtraction: buildRawExtraction({
            supplier: { name: 'Supplier', vatId: supplierVatId },
            customer: { name: 'My Company', vatId: companyVatId },
          }),
        },
      });

      expect(response2.statusCode).toBe(200);
      const body2 = response2.json();

      // Should return the SAME document link
      expect(body2.documentLink.id).toBe(body1.documentLink.id);
      expect(body2.documentLink.documentId).toBe(documentId);

      // CRITICAL: Verify only ONE document link exists in database
      const dbLinks = await findDocumentLinksByContactId(existingContact.id, db);
      const matchingLinks = dbLinks.filter((link) => link.documentId === documentId);
      expect(matchingLinks.length).toBe(1);
    });
  });
});
