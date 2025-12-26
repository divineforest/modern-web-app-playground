import { describe, expect, it } from 'vitest';
import { createTestCompany } from '../../../../tests/factories/companies.js';
import { createTestInvoice } from '../../../../tests/factories/invoices.js';
import { db } from '../../../db/index.js';
import {
  createInvoiceService,
  deleteInvoiceService,
  getInvoiceByIdService,
  InvoiceNotFoundError,
  InvoiceValidationError,
  listInvoicesService,
  updateInvoiceService,
} from './invoices.service.js';

describe('Invoices Service', () => {
  describe('createInvoiceService', () => {
    it('should create an invoice with valid data', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const input = {
        companyId: company.id,
        type: 'sales' as const,
        status: 'draft' as const,
        invoiceNumber: `INV-${Date.now()}`,
        issueDate: '2024-01-15',
        currency: 'EUR',
        totalAmount: 1500,
      };

      // ACT
      const result = await createInvoiceService(input, db);

      // ASSERT
      expect(result).toBeDefined();
      expect(result.companyId).toBe(company.id);
      expect(result.type).toBe('sales');
      expect(result.status).toBe('draft');
      expect(result.totalAmount).toBe('1500.00');
    });

    it('should throw InvoiceValidationError for invalid company reference', async () => {
      // ARRANGE
      const input = {
        companyId: '00000000-0000-0000-0000-999999999999',
        type: 'sales' as const,
        status: 'draft' as const,
        invoiceNumber: `INV-${Date.now()}`,
        issueDate: '2024-01-15',
        currency: 'EUR',
        totalAmount: 1500,
      };

      // ACT & ASSERT
      await expect(createInvoiceService(input, db)).rejects.toThrow(InvoiceValidationError);
    });

    it('should throw InvoiceValidationError for duplicate invoice number in same company', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const invoiceNumber = `INV-DUPLICATE-${Date.now()}`;
      await createTestInvoice({ companyId: company.id, invoiceNumber }, db);

      const input = {
        companyId: company.id,
        type: 'sales' as const,
        status: 'draft' as const,
        invoiceNumber, // Same number
        issueDate: '2024-01-15',
        currency: 'EUR',
        totalAmount: 1500,
      };

      // ACT & ASSERT
      await expect(createInvoiceService(input, db)).rejects.toThrow(InvoiceValidationError);
    });
  });

  describe('getInvoiceByIdService', () => {
    it('should return an invoice by ID', async () => {
      // ARRANGE
      const invoice = await createTestInvoice({}, db);

      // ACT
      const result = await getInvoiceByIdService(invoice.id, db);

      // ASSERT
      expect(result.id).toBe(invoice.id);
    });

    it('should throw InvoiceNotFoundError for non-existent ID', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT & ASSERT
      await expect(getInvoiceByIdService(nonExistentId, db)).rejects.toThrow(InvoiceNotFoundError);
    });
  });

  describe('listInvoicesService', () => {
    it('should list invoices with filters', async () => {
      // ARRANGE
      const company = await createTestCompany();
      await createTestInvoice({ companyId: company.id, type: 'sales' }, db);
      await createTestInvoice({ companyId: company.id, type: 'purchase' }, db);

      // ACT
      const results = await listInvoicesService({ companyId: company.id, type: 'sales' }, db);

      // ASSERT
      expect(results.every((inv) => inv.type === 'sales')).toBe(true);
    });

    it('should return empty array when no invoices match', async () => {
      // ARRANGE
      const company = await createTestCompany();

      // ACT
      const results = await listInvoicesService({ companyId: company.id, status: 'cancelled' }, db);

      // ASSERT
      expect(results).toEqual([]);
    });
  });

  describe('updateInvoiceService', () => {
    it('should update invoice fields', async () => {
      // ARRANGE
      const invoice = await createTestInvoice({ status: 'draft' }, db);

      // ACT
      const result = await updateInvoiceService(
        invoice.id,
        { status: 'sent', description: 'Updated' },
        db
      );

      // ASSERT
      expect(result.status).toBe('sent');
      expect(result.description).toBe('Updated');
    });

    it('should auto-set paidAt when status changes to paid', async () => {
      // ARRANGE
      const invoice = await createTestInvoice({ status: 'sent' }, db);
      expect(invoice.paidAt).toBeNull();

      // ACT
      const result = await updateInvoiceService(invoice.id, { status: 'paid' }, db);

      // ASSERT
      expect(result.status).toBe('paid');
      expect(result.paidAt).not.toBeNull();
      expect(result.paidAt).toBeInstanceOf(Date);
    });

    it('should clear paidAt when status changes from paid to something else', async () => {
      // ARRANGE
      const invoice = await createTestInvoice({ status: 'draft' }, db);
      // First set to paid
      const paidInvoice = await updateInvoiceService(invoice.id, { status: 'paid' }, db);
      expect(paidInvoice.paidAt).not.toBeNull();

      // ACT - Change back to draft
      const result = await updateInvoiceService(invoice.id, { status: 'draft' }, db);

      // ASSERT
      expect(result.status).toBe('draft');
      expect(result.paidAt).toBeNull();
    });

    it('should throw InvoiceNotFoundError for non-existent ID', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT & ASSERT
      await expect(updateInvoiceService(nonExistentId, { status: 'sent' }, db)).rejects.toThrow(
        InvoiceNotFoundError
      );
    });

    it('should throw InvoiceValidationError for invalid status', async () => {
      // ARRANGE
      const invoice = await createTestInvoice({}, db);

      // ACT & ASSERT
      await expect(
        updateInvoiceService(invoice.id, { status: 'invalid' as never }, db)
      ).rejects.toThrow(InvoiceValidationError);
    });
  });

  describe('deleteInvoiceService', () => {
    it('should delete an invoice and return ID', async () => {
      // ARRANGE
      const invoice = await createTestInvoice({}, db);

      // ACT
      const deletedId = await deleteInvoiceService(invoice.id, db);

      // ASSERT
      expect(deletedId).toBe(invoice.id);

      // Verify deletion
      await expect(getInvoiceByIdService(invoice.id, db)).rejects.toThrow(InvoiceNotFoundError);
    });

    it('should throw InvoiceNotFoundError for non-existent ID', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT & ASSERT
      await expect(deleteInvoiceService(nonExistentId, db)).rejects.toThrow(InvoiceNotFoundError);
    });
  });
});
