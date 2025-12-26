import { describe, expect, it } from 'vitest';
import { createTestCompany } from '../../../../tests/factories/companies.js';
import { createTestInvoice } from '../../../../tests/factories/invoices.js';
import { db } from '../../../db/index.js';
import {
  createInvoice,
  deleteInvoice,
  findAllInvoices,
  findInvoiceById,
  updateInvoice,
} from './invoices.repository.js';

describe('Invoices Repository', () => {
  describe('createInvoice', () => {
    it('should create an invoice with valid data', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const invoiceData = {
        companyId: company.id,
        type: 'sales' as const,
        status: 'draft' as const,
        invoiceNumber: `INV-${Date.now()}`,
        issueDate: '2024-01-15',
        currency: 'EUR',
        totalAmount: '1500.00',
      };

      // ACT
      const result = await createInvoice(invoiceData, db);

      // ASSERT
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.companyId).toBe(company.id);
      expect(result.type).toBe('sales');
      expect(result.status).toBe('draft');
      expect(result.invoiceNumber).toBe(invoiceData.invoiceNumber);
      expect(result.currency).toBe('EUR');
      expect(result.totalAmount).toBe('1500.00');
    });

    it('should set default status to draft when not provided', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const invoiceData = {
        companyId: company.id,
        type: 'purchase' as const,
        invoiceNumber: `INV-${Date.now()}`,
        issueDate: '2024-01-15',
        currency: 'USD',
        totalAmount: '2500.00',
      };

      // ACT
      const result = await createInvoice(invoiceData, db);

      // ASSERT
      expect(result.status).toBe('draft');
    });
  });

  describe('findInvoiceById', () => {
    it('should find an existing invoice', async () => {
      // ARRANGE
      const invoice = await createTestInvoice({}, db);

      // ACT
      const result = await findInvoiceById(invoice.id, db);

      // ASSERT
      expect(result).toBeDefined();
      expect(result?.id).toBe(invoice.id);
      expect(result?.invoiceNumber).toBe(invoice.invoiceNumber);
    });

    it('should return null for non-existent invoice', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT
      const result = await findInvoiceById(nonExistentId, db);

      // ASSERT
      expect(result).toBeNull();
    });
  });

  describe('findAllInvoices', () => {
    it('should return all invoices ordered by issue date (newest first)', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const invoice1 = await createTestInvoice(
        { companyId: company.id, issueDate: '2024-01-01' },
        db
      );
      const invoice2 = await createTestInvoice(
        { companyId: company.id, issueDate: '2024-02-01' },
        db
      );

      // ACT
      const results = await findAllInvoices({ companyId: company.id }, db);

      // ASSERT
      expect(results.length).toBe(2);
      // Newest first
      expect(results[0]?.id).toBe(invoice2.id);
      expect(results[1]?.id).toBe(invoice1.id);
    });

    it('should filter by companyId', async () => {
      // ARRANGE
      const company1 = await createTestCompany();
      const company2 = await createTestCompany();
      await createTestInvoice({ companyId: company1.id }, db);
      await createTestInvoice({ companyId: company2.id }, db);

      // ACT
      const results = await findAllInvoices({ companyId: company1.id }, db);

      // ASSERT
      expect(results.every((inv) => inv.companyId === company1.id)).toBe(true);
    });

    it('should filter by type', async () => {
      // ARRANGE
      const company = await createTestCompany();
      await createTestInvoice({ companyId: company.id, type: 'sales' }, db);
      await createTestInvoice({ companyId: company.id, type: 'purchase' }, db);

      // ACT
      const results = await findAllInvoices({ companyId: company.id, type: 'sales' }, db);

      // ASSERT
      expect(results.every((inv) => inv.type === 'sales')).toBe(true);
    });

    it('should filter by status', async () => {
      // ARRANGE
      const company = await createTestCompany();
      await createTestInvoice({ companyId: company.id, status: 'draft' }, db);
      await createTestInvoice({ companyId: company.id, status: 'paid' }, db);

      // ACT
      const results = await findAllInvoices({ companyId: company.id, status: 'paid' }, db);

      // ASSERT
      expect(results.every((inv) => inv.status === 'paid')).toBe(true);
    });
  });

  describe('updateInvoice', () => {
    it('should update invoice fields', async () => {
      // ARRANGE
      const invoice = await createTestInvoice({ status: 'draft' }, db);

      // ACT
      const result = await updateInvoice(
        invoice.id,
        { status: 'sent', description: 'Updated description' },
        db
      );

      // ASSERT
      expect(result).toBeDefined();
      expect(result?.status).toBe('sent');
      expect(result?.description).toBe('Updated description');
    });

    it('should return null for non-existent invoice', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT
      const result = await updateInvoice(nonExistentId, { status: 'sent' }, db);

      // ASSERT
      expect(result).toBeNull();
    });

    it('should update updatedAt timestamp', async () => {
      // ARRANGE
      const invoice = await createTestInvoice({}, db);
      const originalUpdatedAt = invoice.updatedAt;

      // Wait a moment to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      // ACT
      const result = await updateInvoice(invoice.id, { description: 'New description' }, db);

      // ASSERT
      expect(result?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('deleteInvoice', () => {
    it('should delete an existing invoice', async () => {
      // ARRANGE
      const invoice = await createTestInvoice({}, db);

      // ACT
      const deleted = await deleteInvoice(invoice.id, db);

      // ASSERT
      expect(deleted).toBe(true);

      const result = await findInvoiceById(invoice.id, db);
      expect(result).toBeNull();
    });

    it('should return false for non-existent invoice', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT
      const deleted = await deleteInvoice(nonExistentId, db);

      // ASSERT
      expect(deleted).toBe(false);
    });
  });
});
