import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestCompany } from '../../../../tests/factories/companies.js';
import { createTestInvoice } from '../../../../tests/factories/invoices.js';
import { buildTestApp } from '../../../app.js';
import { db } from '../../../db/index.js';

// Type definitions for API responses
type InvoiceResponse = {
  id: string;
  companyId: string;
  contactId: string | null;
  type: string;
  status: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  paidAt: string | null;
  currency: string;
  totalAmount: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

type InvoiceListResponse = {
  invoices: InvoiceResponse[];
};

type DeleteResponse = {
  success: boolean;
  id: string;
};

type ErrorResponse = {
  error?: string;
  message?: string;
  details?: unknown;
};

describe('Invoices Routes - Integration Tests', () => {
  let fastify: FastifyInstance;

  // Test authentication token matching the configuration
  const authHeaders = {
    authorization: 'Bearer test_token_12345',
  };

  beforeEach(async () => {
    fastify = await buildTestApp();
  });

  afterEach(async () => {
    if (fastify) {
      await fastify.close();
    }
  });

  describe('POST /api/internal/invoices', () => {
    it('should create an invoice with valid data', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const requestBody = {
        companyId: company.id,
        type: 'sales',
        invoiceNumber: `INV-${Date.now()}`,
        issueDate: '2024-01-15',
        dueDate: '2024-02-15',
        currency: 'EUR',
        totalAmount: 1500.0,
        description: 'Services for January 2024',
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/invoices',
        headers: authHeaders,
        payload: requestBody,
      });

      // ASSERT
      expect(response.statusCode).toBe(201);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as InvoiceResponse;
      expect(body.id).toBeDefined();
      expect(body.companyId).toBe(requestBody.companyId);
      expect(body.type).toBe(requestBody.type);
      expect(body.status).toBe('draft');
      expect(body.invoiceNumber).toBe(requestBody.invoiceNumber);
      expect(body.currency).toBe(requestBody.currency);
      expect(body.createdAt).toBeDefined();
      expect(body.updatedAt).toBeDefined();
    });

    it('should return 400 for missing required fields', async () => {
      // ARRANGE
      const requestBody = {
        companyId: '00000000-0000-0000-0000-000000000001',
        // Missing type, invoiceNumber, issueDate, currency, totalAmount
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/invoices',
        headers: authHeaders,
        payload: requestBody,
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid company reference', async () => {
      // ARRANGE
      const requestBody = {
        companyId: '00000000-0000-0000-0000-999999999999',
        type: 'sales',
        invoiceNumber: `INV-${Date.now()}`,
        issueDate: '2024-01-15',
        currency: 'EUR',
        totalAmount: 1500.0,
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/invoices',
        headers: authHeaders,
        payload: requestBody,
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
    });

    it('should return 409 for duplicate invoice number in same company', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const invoiceNumber = `INV-DUPLICATE-${Date.now()}`;
      await createTestInvoice({ companyId: company.id, invoiceNumber }, db);

      const requestBody = {
        companyId: company.id,
        type: 'sales',
        invoiceNumber, // Same number
        issueDate: '2024-01-15',
        currency: 'EUR',
        totalAmount: 1500.0,
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/invoices',
        headers: authHeaders,
        payload: requestBody,
      });

      // ASSERT
      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.payload) as ErrorResponse;
      expect(body.error).toContain('Duplicate');
    });

    describe('ACL', () => {
      it('should return 401 without authentication', async () => {
        // ARRANGE
        const company = await createTestCompany();
        const requestBody = {
          companyId: company.id,
          type: 'sales',
          invoiceNumber: `INV-${Date.now()}`,
          issueDate: '2024-01-15',
          currency: 'EUR',
          totalAmount: 1500.0,
        };

        // ACT
        const response = await fastify.inject({
          method: 'POST',
          url: '/api/internal/invoices',
          payload: requestBody,
        });

        // ASSERT
        expect(response.statusCode).toBe(401);
      });

      it('should return 401 with invalid token', async () => {
        // ARRANGE
        const company = await createTestCompany();
        const requestBody = {
          companyId: company.id,
          type: 'sales',
          invoiceNumber: `INV-${Date.now()}`,
          issueDate: '2024-01-15',
          currency: 'EUR',
          totalAmount: 1500.0,
        };

        // ACT
        const response = await fastify.inject({
          method: 'POST',
          url: '/api/internal/invoices',
          headers: {
            authorization: 'Bearer invalid_token',
          },
          payload: requestBody,
        });

        // ASSERT
        expect(response.statusCode).toBe(401);
        const body = JSON.parse(response.payload) as ErrorResponse;
        expect(body.message).toBe('Invalid authentication token');
      });
    });
  });

  describe('GET /api/internal/invoices/:id', () => {
    it('should get an invoice by ID', async () => {
      // ARRANGE
      const created = await createTestInvoice({}, db);

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/invoices/${created.id}`,
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as InvoiceResponse;
      expect(body.id).toBe(created.id);
      expect(body.invoiceNumber).toBe(created.invoiceNumber);
      expect(body.companyId).toBe(created.companyId);
    });

    it('should return 404 for non-existent ID', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/invoices/${nonExistentId}`,
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.payload) as ErrorResponse;
      expect(body.error).toBeDefined();
    });

    it('should return 400 for invalid UUID format', async () => {
      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/internal/invoices/invalid-uuid',
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
    });

    describe('ACL', () => {
      it('should return 401 without authentication', async () => {
        // ARRANGE
        const created = await createTestInvoice({}, db);

        // ACT
        const response = await fastify.inject({
          method: 'GET',
          url: `/api/internal/invoices/${created.id}`,
        });

        // ASSERT
        expect(response.statusCode).toBe(401);
      });
    });
  });

  describe('GET /api/internal/invoices', () => {
    it('should list all invoices', async () => {
      // ARRANGE
      const company = await createTestCompany();
      await createTestInvoice({ companyId: company.id }, db);
      await createTestInvoice({ companyId: company.id }, db);

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/internal/invoices',
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as InvoiceListResponse;
      expect(body.invoices).toBeDefined();
      expect(Array.isArray(body.invoices)).toBe(true);
      expect(body.invoices.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by companyId', async () => {
      // ARRANGE
      const company1 = await createTestCompany();
      const company2 = await createTestCompany();
      const invoice1 = await createTestInvoice({ companyId: company1.id }, db);
      const invoice2 = await createTestInvoice({ companyId: company2.id }, db);

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/invoices?companyId=${company1.id}`,
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload) as InvoiceListResponse;
      expect(body.invoices.some((i) => i.id === invoice1.id)).toBe(true);
      expect(body.invoices.some((i) => i.id === invoice2.id)).toBe(false);
    });

    it('should filter by type', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const salesInvoice = await createTestInvoice({ companyId: company.id, type: 'sales' }, db);
      const purchaseInvoice = await createTestInvoice(
        { companyId: company.id, type: 'purchase' },
        db
      );

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/invoices?companyId=${company.id}&type=sales`,
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload) as InvoiceListResponse;
      expect(body.invoices.some((i) => i.id === salesInvoice.id)).toBe(true);
      expect(body.invoices.some((i) => i.id === purchaseInvoice.id)).toBe(false);
    });

    it('should filter by status', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const draftInvoice = await createTestInvoice({ companyId: company.id, status: 'draft' }, db);
      const paidInvoice = await createTestInvoice({ companyId: company.id, status: 'paid' }, db);

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/invoices?companyId=${company.id}&status=draft`,
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload) as InvoiceListResponse;
      expect(body.invoices.some((i) => i.id === draftInvoice.id)).toBe(true);
      expect(body.invoices.some((i) => i.id === paidInvoice.id)).toBe(false);
    });

    it('should order by issue date (newest first)', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const oldInvoice = await createTestInvoice(
        { companyId: company.id, issueDate: '2024-01-01' },
        db
      );
      const newInvoice = await createTestInvoice(
        { companyId: company.id, issueDate: '2024-02-01' },
        db
      );

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/invoices?companyId=${company.id}`,
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload) as InvoiceListResponse;
      const invoiceIds = body.invoices.map((i) => i.id);
      const newIndex = invoiceIds.indexOf(newInvoice.id);
      const oldIndex = invoiceIds.indexOf(oldInvoice.id);
      expect(newIndex).toBeLessThan(oldIndex);
    });

    describe('ACL', () => {
      it('should return 401 without authentication', async () => {
        // ACT
        const response = await fastify.inject({
          method: 'GET',
          url: '/api/internal/invoices',
        });

        // ASSERT
        expect(response.statusCode).toBe(401);
      });
    });
  });

  describe('PATCH /api/internal/invoices/:id', () => {
    it('should update an invoice', async () => {
      // ARRANGE
      const created = await createTestInvoice({ status: 'draft', description: 'Original' }, db);

      // ACT
      const response = await fastify.inject({
        method: 'PATCH',
        url: `/api/internal/invoices/${created.id}`,
        headers: authHeaders,
        payload: {
          status: 'sent',
          description: 'Updated description',
        },
      });

      // ASSERT
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as InvoiceResponse;
      expect(body.id).toBe(created.id);
      expect(body.status).toBe('sent');
      expect(body.description).toBe('Updated description');
    });

    it('should automatically set paidAt when status changes to paid', async () => {
      // ARRANGE
      const created = await createTestInvoice({ status: 'sent' }, db);

      // ACT
      const response = await fastify.inject({
        method: 'PATCH',
        url: `/api/internal/invoices/${created.id}`,
        headers: authHeaders,
        payload: {
          status: 'paid',
        },
      });

      // ASSERT
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload) as InvoiceResponse;
      expect(body.status).toBe('paid');
      expect(body.paidAt).not.toBeNull();
      expect(body.paidAt).toBeDefined();
    });

    it('should return 404 for non-existent ID', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT
      const response = await fastify.inject({
        method: 'PATCH',
        url: `/api/internal/invoices/${nonExistentId}`,
        headers: authHeaders,
        payload: {
          status: 'sent',
        },
      });

      // ASSERT
      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.payload) as ErrorResponse;
      expect(body.error).toBeDefined();
    });

    it('should return 400 for invalid status value', async () => {
      // ARRANGE
      const created = await createTestInvoice({}, db);

      // ACT
      const response = await fastify.inject({
        method: 'PATCH',
        url: `/api/internal/invoices/${created.id}`,
        headers: authHeaders,
        payload: {
          status: 'invalid_status',
        },
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
    });

    describe('ACL', () => {
      it('should return 401 without authentication', async () => {
        // ARRANGE
        const created = await createTestInvoice({ status: 'draft' }, db);

        // ACT
        const response = await fastify.inject({
          method: 'PATCH',
          url: `/api/internal/invoices/${created.id}`,
          payload: {
            status: 'sent',
          },
        });

        // ASSERT
        expect(response.statusCode).toBe(401);
      });
    });
  });

  describe('DELETE /api/internal/invoices/:id', () => {
    it('should delete an invoice', async () => {
      // ARRANGE
      const created = await createTestInvoice({}, db);

      // ACT
      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/internal/invoices/${created.id}`,
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as DeleteResponse;
      expect(body.success).toBe(true);
      expect(body.id).toBe(created.id);

      // Verify it's deleted
      const getResponse = await fastify.inject({
        method: 'GET',
        url: `/api/internal/invoices/${created.id}`,
        headers: authHeaders,
      });

      expect(getResponse.statusCode).toBe(404);
    });

    it('should return 404 for non-existent ID', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT
      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/internal/invoices/${nonExistentId}`,
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.payload) as ErrorResponse;
      expect(body.error).toBeDefined();
    });

    it('should return 400 for invalid UUID format', async () => {
      // ACT
      const response = await fastify.inject({
        method: 'DELETE',
        url: '/api/internal/invoices/invalid-uuid',
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
    });

    describe('ACL', () => {
      it('should return 401 without authentication', async () => {
        // ARRANGE
        const created = await createTestInvoice({}, db);

        // ACT
        const response = await fastify.inject({
          method: 'DELETE',
          url: `/api/internal/invoices/${created.id}`,
        });

        // ASSERT
        expect(response.statusCode).toBe(401);
      });
    });
  });
});
