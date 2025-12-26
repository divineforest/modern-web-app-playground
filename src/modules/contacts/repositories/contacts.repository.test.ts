import { describe, expect, it } from 'vitest';
import {
  buildTestGlobalContactData,
  createTestCompany,
  createTestGlobalContact,
  createTestGlobalContactCompany,
} from '../../../../tests/factories/index.js';
import { db } from '../../../db/index.js';
import { CursorSortMismatchError, InvalidCursorError } from '../domain/contact.errors.js';
import type { ContactListFilters, ContactPaginationOptions } from '../domain/contact.types.js';
import {
  createContact,
  decodeCursor,
  encodeCursor,
  findContactById,
  findContactByIdWithCompanies,
  findContactByVatId,
  listContacts,
  updateContact,
} from './contacts.repository.js';

describe('contacts.repository', () => {
  describe('createContact', () => {
    it('creates a contact with all required fields', async () => {
      // ARRANGE:
      const contactData = buildTestGlobalContactData({
        name: 'Test Company',
        source: 'ocr',
        email: 'test@example.com',
      });

      // ACT:
      const result = await createContact(contactData, db);

      // ASSERT:
      expect(result.id).toBeDefined();
      expect(result.name).toBe('Test Company');
      expect(result.source).toBe('ocr');
      expect(result.email).toBe('test@example.com');
      expect(result.entityType).toBe('legal_entity');
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('creates a contact with VIES source and VAT ID', async () => {
      // ARRANGE:
      const vatId = `DE${Date.now()}`;
      const contactData = buildTestGlobalContactData({
        name: 'VIES Company',
        source: 'vies',
        vatId,
        countryCode: 'DE',
      });

      // ACT:
      const result = await createContact(contactData, db);

      // ASSERT:
      expect(result.source).toBe('vies');
      expect(result.vatId).toBe(vatId);
      expect(result.countryCode).toBe('DE');
    });

    it('creates a contact with billing address as JSON', async () => {
      // ARRANGE:
      const billingAddress = {
        countryCode: 'DE',
        city: 'Berlin',
        postalCode: '10115',
        addressLine: 'Hauptstraße 123',
      };
      const contactData = buildTestGlobalContactData({
        name: 'Address Test Company',
        source: 'ocr',
        billingAddress,
      });

      // ACT:
      const result = await createContact(contactData, db);

      // ASSERT:
      expect(result.billingAddress).toEqual(billingAddress);
    });

    it('creates a contact with entity type individual', async () => {
      // ARRANGE:
      const contactData = buildTestGlobalContactData({
        name: 'John Doe',
        source: 'ocr',
        entityType: 'individual',
      });

      // ACT:
      const result = await createContact(contactData, db);

      // ASSERT:
      expect(result.entityType).toBe('individual');
    });
  });

  describe('findContactByVatId', () => {
    it('returns contact when VAT ID exists', async () => {
      // ARRANGE:
      const vatId = `DE${Date.now()}`;
      const contact = await createTestGlobalContact({
        name: 'Find By VAT Test',
        source: 'vies',
        vatId,
      });

      // ACT:
      const result = await findContactByVatId(vatId, db);

      // ASSERT:
      expect(result).not.toBeNull();
      expect(result?.id).toBe(contact.id);
      expect(result?.vatId).toBe(vatId);
    });

    it('returns null when VAT ID does not exist', async () => {
      // ARRANGE:
      const nonExistentVatId = 'DE000000000';

      // ACT:
      const result = await findContactByVatId(nonExistentVatId, db);

      // ASSERT:
      expect(result).toBeNull();
    });

    it('returns null when VAT ID is null', async () => {
      // ACT:
      const result = await findContactByVatId(null, db);

      // ASSERT:
      expect(result).toBeNull();
    });

    it('returns null when VAT ID is undefined', async () => {
      // ACT:
      const result = await findContactByVatId(undefined, db);

      // ASSERT:
      expect(result).toBeNull();
    });
  });

  describe('findContactById', () => {
    it('returns contact when ID exists', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({
        name: 'Find By ID Test',
        source: 'ocr',
      });

      // ACT:
      const result = await findContactById(contact.id, db);

      // ASSERT:
      expect(result).not.toBeNull();
      expect(result?.id).toBe(contact.id);
      expect(result?.name).toBe('Find By ID Test');
    });

    it('returns null when ID does not exist', async () => {
      // ARRANGE:
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT:
      const result = await findContactById(nonExistentId, db);

      // ASSERT:
      expect(result).toBeNull();
    });
  });

  describe('updateContact', () => {
    it('updates contact name', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({
        name: 'Original Name',
        source: 'ocr',
      });

      // ACT:
      const result = await updateContact(contact.id, { name: 'Updated Name' }, db);

      // ASSERT:
      expect(result).not.toBeNull();
      expect(result?.name).toBe('Updated Name');
      expect(result?.updatedAt.getTime()).toBeGreaterThanOrEqual(contact.updatedAt.getTime());
    });

    it('updates contact email', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({
        name: 'Email Update Test',
        source: 'ocr',
        email: 'old@example.com',
      });

      // ACT:
      const result = await updateContact(contact.id, { email: 'new@example.com' }, db);

      // ASSERT:
      expect(result?.email).toBe('new@example.com');
    });

    it('returns null when ID does not exist', async () => {
      // ARRANGE:
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT:
      const result = await updateContact(nonExistentId, { name: 'New Name' }, db);

      // ASSERT:
      expect(result).toBeNull();
    });
  });

  describe('encodeCursor', () => {
    it('encodes cursor data to base64 string', () => {
      // ARRANGE:
      const cursorData = {
        sortField: 'updated_at' as const,
        sortDirection: 'desc' as const,
        sortValue: new Date('2024-01-15T10:30:00.000Z'),
        id: '123e4567-e89b-12d3-a456-426614174000',
      };

      // ACT:
      const result = encodeCursor(cursorData);

      // ASSERT:
      expect(typeof result).toBe('string');
      // Should be valid base64
      expect(() => Buffer.from(result, 'base64')).not.toThrow();
    });

    it('encodes name sort field with string value', () => {
      // ARRANGE:
      const cursorData = {
        sortField: 'name' as const,
        sortDirection: 'asc' as const,
        sortValue: 'Test Company',
        id: '123e4567-e89b-12d3-a456-426614174000',
      };

      // ACT:
      const result = encodeCursor(cursorData);

      // ASSERT:
      expect(typeof result).toBe('string');
    });
  });

  describe('decodeCursor', () => {
    it('decodes valid cursor to cursor data', () => {
      // ARRANGE:
      const originalData = {
        sortField: 'updated_at' as const,
        sortDirection: 'desc' as const,
        sortValue: new Date('2024-01-15T10:30:00.000Z'),
        id: '123e4567-e89b-12d3-a456-426614174000',
      };
      const cursor = encodeCursor(originalData);

      // ACT:
      const result = decodeCursor(cursor);

      // ASSERT:
      expect(result).not.toBeNull();
      expect(result?.sortField).toBe('updated_at');
      expect(result?.sortDirection).toBe('desc');
      expect(result?.sortValue).toEqual(new Date('2024-01-15T10:30:00.000Z'));
      expect(result?.id).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('decodes name cursor with string sort value', () => {
      // ARRANGE:
      const originalData = {
        sortField: 'name' as const,
        sortDirection: 'asc' as const,
        sortValue: 'Test Company',
        id: '123e4567-e89b-12d3-a456-426614174000',
      };
      const cursor = encodeCursor(originalData);

      // ACT:
      const result = decodeCursor(cursor);

      // ASSERT:
      expect(result).not.toBeNull();
      expect(result?.sortField).toBe('name');
      expect(result?.sortValue).toBe('Test Company');
    });

    it('returns null for invalid base64', () => {
      // ARRANGE:
      const invalidCursor = 'not-valid-base64!!!';

      // ACT:
      const result = decodeCursor(invalidCursor);

      // ASSERT:
      expect(result).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      // ARRANGE:
      const invalidCursor = Buffer.from('not valid json').toString('base64');

      // ACT:
      const result = decodeCursor(invalidCursor);

      // ASSERT:
      expect(result).toBeNull();
    });

    it('returns null for missing required fields', () => {
      // ARRANGE:
      const incompleteCursor = Buffer.from(JSON.stringify({ sf: 'updated_at' })).toString('base64');

      // ACT:
      const result = decodeCursor(incompleteCursor);

      // ASSERT:
      expect(result).toBeNull();
    });

    it('returns null for invalid sort field', () => {
      // ARRANGE:
      const invalidCursor = Buffer.from(
        JSON.stringify({
          sf: 'invalid_field',
          sd: 'desc',
          sv: '2024-01-15T10:30:00.000Z',
          id: '123',
        })
      ).toString('base64');

      // ACT:
      const result = decodeCursor(invalidCursor);

      // ASSERT:
      expect(result).toBeNull();
    });

    it('returns null for invalid sort direction', () => {
      // ARRANGE:
      const invalidCursor = Buffer.from(
        JSON.stringify({
          sf: 'updated_at',
          sd: 'invalid',
          sv: '2024-01-15T10:30:00.000Z',
          id: '123',
        })
      ).toString('base64');

      // ACT:
      const result = decodeCursor(invalidCursor);

      // ASSERT:
      expect(result).toBeNull();
    });
  });

  describe('listContacts', () => {
    describe('basic listing', () => {
      it('returns contacts sorted by updated_at desc by default', async () => {
        // ARRANGE:
        const timestamp = Date.now();
        const contact1 = await createTestGlobalContact({
          name: `List Test 1 ${timestamp}`,
          source: 'ocr',
        });
        // Small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 10));
        const contact2 = await createTestGlobalContact({
          name: `List Test 2 ${timestamp}`,
          source: 'ocr',
        });

        const pagination: ContactPaginationOptions = {
          sort: { field: 'updated_at', direction: 'desc' },
          limit: 100,
        };

        // ACT:
        const result = await listContacts({}, pagination, db);

        // ASSERT:
        expect(result.contacts.length).toBeGreaterThanOrEqual(2);
        // Find our test contacts in results
        const ourContacts = result.contacts.filter(
          (c) => c.id === contact1.id || c.id === contact2.id
        );
        expect(ourContacts.length).toBe(2);
        // contact2 should come before contact1 (more recent)
        const idx1 = result.contacts.findIndex((c) => c.id === contact1.id);
        const idx2 = result.contacts.findIndex((c) => c.id === contact2.id);
        expect(idx2).toBeLessThan(idx1);
      });

      it('returns contacts sorted by name asc', async () => {
        // ARRANGE:
        const timestamp = Date.now();
        const company = await createTestCompany();

        const contactZ = await createTestGlobalContact({
          name: `ZZZ Company ${timestamp}`,
          source: 'ocr',
        });
        await createTestGlobalContactCompany({
          globalContactId: contactZ.id,
          companyId: company.id,
          role: 'supplier',
        });

        const contactA = await createTestGlobalContact({
          name: `AAA Company ${timestamp}`,
          source: 'ocr',
        });
        await createTestGlobalContactCompany({
          globalContactId: contactA.id,
          companyId: company.id,
          role: 'supplier',
        });

        const filters: ContactListFilters = { companyId: company.id };
        const pagination: ContactPaginationOptions = {
          sort: { field: 'name', direction: 'asc' },
          limit: 100,
        };

        // ACT:
        const result = await listContacts(filters, pagination, db);

        // ASSERT:
        expect(result.contacts.length).toBe(2);
        expect(result.contacts[0]?.id).toBe(contactA.id);
        expect(result.contacts[1]?.id).toBe(contactZ.id);
      });

      it('returns contacts sorted by created_at asc', async () => {
        // ARRANGE:
        const timestamp = Date.now();
        const company = await createTestCompany();

        const contact1 = await createTestGlobalContact({
          name: `Created First ${timestamp}`,
          source: 'ocr',
        });
        await createTestGlobalContactCompany({
          globalContactId: contact1.id,
          companyId: company.id,
          role: 'supplier',
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
        const contact2 = await createTestGlobalContact({
          name: `Created Second ${timestamp}`,
          source: 'ocr',
        });
        await createTestGlobalContactCompany({
          globalContactId: contact2.id,
          companyId: company.id,
          role: 'supplier',
        });

        const filters: ContactListFilters = { companyId: company.id };
        const pagination: ContactPaginationOptions = {
          sort: { field: 'created_at', direction: 'asc' },
          limit: 100,
        };

        // ACT:
        const result = await listContacts(filters, pagination, db);

        // ASSERT:
        expect(result.contacts.length).toBe(2);
        expect(result.contacts[0]?.id).toBe(contact1.id);
        expect(result.contacts[1]?.id).toBe(contact2.id);
      });

      it('returns empty array when no contacts match', async () => {
        // ARRANGE:
        const filters: ContactListFilters = {
          countryCode: 'XX', // Non-existent country code
        };
        const pagination: ContactPaginationOptions = {
          sort: { field: 'updated_at', direction: 'desc' },
          limit: 10,
        };

        // ACT:
        const result = await listContacts(filters, pagination, db);

        // ASSERT:
        expect(result.contacts).toHaveLength(0);
        expect(result.pagination.hasMore).toBe(false);
        expect(result.pagination.nextCursor).toBeNull();
      });
    });

    describe('filtering', () => {
      it('filters by source', async () => {
        // ARRANGE:
        const timestamp = Date.now();
        const ocrContact = await createTestGlobalContact({
          name: `OCR Contact ${timestamp}`,
          source: 'ocr',
        });
        const viesContact = await createTestGlobalContact({
          name: `VIES Contact ${timestamp}`,
          source: 'vies',
          vatId: `DE${timestamp}`,
        });

        const filters: ContactListFilters = { source: 'ocr' };
        const pagination: ContactPaginationOptions = {
          sort: { field: 'updated_at', direction: 'desc' },
          limit: 100,
        };

        // ACT:
        const result = await listContacts(filters, pagination, db);

        // ASSERT:
        const hasOcr = result.contacts.some((c) => c.id === ocrContact.id);
        const hasVies = result.contacts.some((c) => c.id === viesContact.id);
        expect(hasOcr).toBe(true);
        expect(hasVies).toBe(false);
        // All returned contacts should have source 'ocr'
        expect(result.contacts.every((c) => c.source === 'ocr')).toBe(true);
      });

      it('filters by isValidVatId', async () => {
        // ARRANGE:
        const timestamp = Date.now();
        const uniqueCountry = 'VV'; // VAT Validation test
        const validVatContact = await createTestGlobalContact({
          name: `Valid VAT ${timestamp}`,
          source: 'vies',
          vatId: `DE${timestamp}1`,
          isValidVatId: true,
          countryCode: uniqueCountry,
        });
        const invalidVatContact = await createTestGlobalContact({
          name: `Invalid VAT ${timestamp}`,
          source: 'vies',
          vatId: `DE${timestamp}2`,
          isValidVatId: false,
          countryCode: uniqueCountry,
        });

        const filters: ContactListFilters = { isValidVatId: true, countryCode: uniqueCountry };
        const pagination: ContactPaginationOptions = {
          sort: { field: 'updated_at', direction: 'desc' },
          limit: 100,
        };

        // ACT:
        const result = await listContacts(filters, pagination, db);

        // ASSERT:
        expect(result.contacts.length).toBeGreaterThanOrEqual(1);
        const hasValid = result.contacts.some((c) => c.id === validVatContact.id);
        const hasInvalid = result.contacts.some((c) => c.id === invalidVatContact.id);
        expect(hasValid).toBe(true);
        expect(hasInvalid).toBe(false);
      });

      it('filters by countryCode', async () => {
        // ARRANGE:
        const timestamp = Date.now();
        const deContact = await createTestGlobalContact({
          name: `DE Contact ${timestamp}`,
          source: 'ocr',
          countryCode: 'DE',
        });
        const frContact = await createTestGlobalContact({
          name: `FR Contact ${timestamp}`,
          source: 'ocr',
          countryCode: 'FR',
        });

        const filters: ContactListFilters = { countryCode: 'DE' };
        const pagination: ContactPaginationOptions = {
          sort: { field: 'updated_at', direction: 'desc' },
          limit: 100,
        };

        // ACT:
        const result = await listContacts(filters, pagination, db);

        // ASSERT:
        const hasDe = result.contacts.some((c) => c.id === deContact.id);
        const hasFr = result.contacts.some((c) => c.id === frContact.id);
        expect(hasDe).toBe(true);
        expect(hasFr).toBe(false);
      });

      it('filters by entityType', async () => {
        // ARRANGE:
        const timestamp = Date.now();
        const legalEntity = await createTestGlobalContact({
          name: `Legal Entity ${timestamp}`,
          source: 'ocr',
          entityType: 'legal_entity',
        });
        const individual = await createTestGlobalContact({
          name: `Individual ${timestamp}`,
          source: 'ocr',
          entityType: 'individual',
        });

        const filters: ContactListFilters = { entityType: 'individual' };
        const pagination: ContactPaginationOptions = {
          sort: { field: 'updated_at', direction: 'desc' },
          limit: 100,
        };

        // ACT:
        const result = await listContacts(filters, pagination, db);

        // ASSERT:
        const hasLegal = result.contacts.some((c) => c.id === legalEntity.id);
        const hasIndividual = result.contacts.some((c) => c.id === individual.id);
        expect(hasLegal).toBe(false);
        expect(hasIndividual).toBe(true);
      });

      it('filters by updatedAtGt', async () => {
        // ARRANGE:
        const timestamp = Date.now();
        const oldContact = await createTestGlobalContact({
          name: `Old Contact ${timestamp}`,
          source: 'ocr',
        });

        // Wait a bit then create a newer contact
        await new Promise((resolve) => setTimeout(resolve, 50));
        const cutoffDate = new Date();
        await new Promise((resolve) => setTimeout(resolve, 50));

        const newContact = await createTestGlobalContact({
          name: `New Contact ${timestamp}`,
          source: 'ocr',
        });

        const filters: ContactListFilters = { updatedAtGt: cutoffDate };
        const pagination: ContactPaginationOptions = {
          sort: { field: 'updated_at', direction: 'desc' },
          limit: 100,
        };

        // ACT:
        const result = await listContacts(filters, pagination, db);

        // ASSERT:
        const hasOld = result.contacts.some((c) => c.id === oldContact.id);
        const hasNew = result.contacts.some((c) => c.id === newContact.id);
        expect(hasOld).toBe(false);
        expect(hasNew).toBe(true);
      });

      it('excludes records when updatedAtGt matches millisecond-truncated timestamp (precision bug fix)', async () => {
        // ARRANGE:
        // This test verifies that when a client uses a millisecond-precision timestamp
        // (e.g., from JavaScript's Date.toISOString()) to paginate, records at that
        // same millisecond are excluded even if the database stores microsecond precision.
        //
        // Example scenario:
        // - DB stores: 2025-12-10T23:41:44.440406Z (microseconds)
        // - API returns: 2025-12-10T23:41:44.440Z (milliseconds via toISOString)
        // - Client queries: updated_at_gt=2025-12-10T23:41:44.440Z
        // - Expected: Record should be EXCLUDED (already fetched)
        const timestamp = Date.now();
        const contact = await createTestGlobalContact({
          name: `Microsecond Precision Test ${timestamp}`,
          source: 'ocr',
        });

        // Use the contact's updatedAt truncated to milliseconds (simulating what API returns)
        const msTimestamp = new Date(contact.updatedAt.getTime());

        const filters: ContactListFilters = { updatedAtGt: msTimestamp };
        const pagination: ContactPaginationOptions = {
          sort: { field: 'updated_at', direction: 'desc' },
          limit: 100,
        };

        // ACT:
        const result = await listContacts(filters, pagination, db);

        // ASSERT:
        // The contact should NOT be returned because its timestamp (truncated to ms)
        // is not greater than the filter value (also truncated to ms)
        const hasContact = result.contacts.some((c) => c.id === contact.id);
        expect(hasContact).toBe(false);
      });

      it('filters by companyId', async () => {
        // ARRANGE:
        const timestamp = Date.now();
        const company = await createTestCompany();
        const linkedContact = await createTestGlobalContact({
          name: `Linked Contact ${timestamp}`,
          source: 'ocr',
        });
        const unlinkedContact = await createTestGlobalContact({
          name: `Unlinked Contact ${timestamp}`,
          source: 'ocr',
        });

        await createTestGlobalContactCompany({
          globalContactId: linkedContact.id,
          companyId: company.id,
          role: 'supplier',
        });

        const filters: ContactListFilters = { companyId: company.id };
        const pagination: ContactPaginationOptions = {
          sort: { field: 'updated_at', direction: 'desc' },
          limit: 100,
        };

        // ACT:
        const result = await listContacts(filters, pagination, db);

        // ASSERT:
        const hasLinked = result.contacts.some((c) => c.id === linkedContact.id);
        const hasUnlinked = result.contacts.some((c) => c.id === unlinkedContact.id);
        expect(hasLinked).toBe(true);
        expect(hasUnlinked).toBe(false);
      });

      it('filters by companyId and role', async () => {
        // ARRANGE:
        const timestamp = Date.now();
        const company = await createTestCompany();
        const supplierContact = await createTestGlobalContact({
          name: `Supplier Contact ${timestamp}`,
          source: 'ocr',
        });
        const customerContact = await createTestGlobalContact({
          name: `Customer Contact ${timestamp}`,
          source: 'ocr',
        });

        await createTestGlobalContactCompany({
          globalContactId: supplierContact.id,
          companyId: company.id,
          role: 'supplier',
        });
        await createTestGlobalContactCompany({
          globalContactId: customerContact.id,
          companyId: company.id,
          role: 'customer',
        });

        const filters: ContactListFilters = { companyId: company.id, role: 'supplier' };
        const pagination: ContactPaginationOptions = {
          sort: { field: 'updated_at', direction: 'desc' },
          limit: 100,
        };

        // ACT:
        const result = await listContacts(filters, pagination, db);

        // ASSERT:
        const hasSupplier = result.contacts.some((c) => c.id === supplierContact.id);
        const hasCustomer = result.contacts.some((c) => c.id === customerContact.id);
        expect(hasSupplier).toBe(true);
        expect(hasCustomer).toBe(false);
      });

      it('filters by bobReferenceId', async () => {
        // ARRANGE:
        const timestamp = Date.now();
        const bobRefId = `bob-ref-${timestamp}`;
        const company = await createTestCompany({ bobReferenceId: bobRefId });
        const contact = await createTestGlobalContact({
          name: `Bob Ref Contact ${timestamp}`,
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
          name: `Other Contact ${timestamp}`,
          source: 'ocr',
        });
        await createTestGlobalContactCompany({
          globalContactId: otherContact.id,
          companyId: otherCompany.id,
          role: 'supplier',
        });

        const filters: ContactListFilters = { bobReferenceId: bobRefId };
        const pagination: ContactPaginationOptions = {
          sort: { field: 'updated_at', direction: 'desc' },
          limit: 100,
        };

        // ACT:
        const result = await listContacts(filters, pagination, db);

        // ASSERT:
        const hasBobContact = result.contacts.some((c) => c.id === contact.id);
        const hasOtherContact = result.contacts.some((c) => c.id === otherContact.id);
        expect(hasBobContact).toBe(true);
        expect(hasOtherContact).toBe(false);
      });

      it('filters by bobReferenceId and role', async () => {
        // ARRANGE:
        const timestamp = Date.now();
        const bobRefId = `bob-role-${timestamp}`;
        const company = await createTestCompany({ bobReferenceId: bobRefId });
        const supplierContact = await createTestGlobalContact({
          name: `Supplier Bob ${timestamp}`,
          source: 'ocr',
        });
        const customerContact = await createTestGlobalContact({
          name: `Customer Bob ${timestamp}`,
          source: 'ocr',
        });

        await createTestGlobalContactCompany({
          globalContactId: supplierContact.id,
          companyId: company.id,
          role: 'supplier',
        });
        await createTestGlobalContactCompany({
          globalContactId: customerContact.id,
          companyId: company.id,
          role: 'customer',
        });

        const filters: ContactListFilters = { bobReferenceId: bobRefId, role: 'supplier' };
        const pagination: ContactPaginationOptions = {
          sort: { field: 'updated_at', direction: 'desc' },
          limit: 100,
        };

        // ACT:
        const result = await listContacts(filters, pagination, db);

        // ASSERT:
        const hasSupplier = result.contacts.some((c) => c.id === supplierContact.id);
        const hasCustomer = result.contacts.some((c) => c.id === customerContact.id);
        expect(hasSupplier).toBe(true);
        expect(hasCustomer).toBe(false);
      });

      it('returns empty array when bobReferenceId not found', async () => {
        // ARRANGE:
        const filters: ContactListFilters = { bobReferenceId: 'non-existent-bob-ref' };
        const pagination: ContactPaginationOptions = {
          sort: { field: 'updated_at', direction: 'desc' },
          limit: 100,
        };

        // ACT:
        const result = await listContacts(filters, pagination, db);

        // ASSERT:
        expect(result.contacts).toHaveLength(0);
        expect(result.pagination.hasMore).toBe(false);
      });

      it('combines multiple filters', async () => {
        // ARRANGE:
        const timestamp = Date.now();
        const matchingContact = await createTestGlobalContact({
          name: `Matching Contact ${timestamp}`,
          source: 'vies',
          countryCode: 'DE',
          vatId: `DE${timestamp}`,
        });
        const nonMatchingSource = await createTestGlobalContact({
          name: `Non-matching Source ${timestamp}`,
          source: 'ocr',
          countryCode: 'DE',
        });
        const nonMatchingCountry = await createTestGlobalContact({
          name: `Non-matching Country ${timestamp}`,
          source: 'vies',
          countryCode: 'FR',
          vatId: `FR${timestamp}`,
        });

        const filters: ContactListFilters = { source: 'vies', countryCode: 'DE' };
        const pagination: ContactPaginationOptions = {
          sort: { field: 'updated_at', direction: 'desc' },
          limit: 100,
        };

        // ACT:
        const result = await listContacts(filters, pagination, db);

        // ASSERT:
        const hasMatching = result.contacts.some((c) => c.id === matchingContact.id);
        const hasNonMatchingSource = result.contacts.some((c) => c.id === nonMatchingSource.id);
        const hasNonMatchingCountry = result.contacts.some((c) => c.id === nonMatchingCountry.id);
        expect(hasMatching).toBe(true);
        expect(hasNonMatchingSource).toBe(false);
        expect(hasNonMatchingCountry).toBe(false);
      });
    });

    describe('pagination', () => {
      it('returns limited results with hasMore true when more exist', async () => {
        // ARRANGE:
        const timestamp = Date.now();
        // Create 3 contacts
        await createTestGlobalContact({ name: `Pagination 1 ${timestamp}`, source: 'ocr' });
        await createTestGlobalContact({ name: `Pagination 2 ${timestamp}`, source: 'ocr' });
        await createTestGlobalContact({ name: `Pagination 3 ${timestamp}`, source: 'ocr' });

        const pagination: ContactPaginationOptions = {
          sort: { field: 'updated_at', direction: 'desc' },
          limit: 2,
        };

        // ACT:
        const result = await listContacts({}, pagination, db);

        // ASSERT:
        expect(result.contacts.length).toBe(2);
        expect(result.pagination.hasMore).toBe(true);
        expect(result.pagination.nextCursor).not.toBeNull();
      });

      it('returns hasMore false when at end of results', async () => {
        // ARRANGE:
        const timestamp = Date.now();
        const company = await createTestCompany();
        const contact = await createTestGlobalContact({
          name: `Single Contact ${timestamp}`,
          source: 'ocr',
        });
        await createTestGlobalContactCompany({
          globalContactId: contact.id,
          companyId: company.id,
          role: 'customer',
        });

        const filters: ContactListFilters = { companyId: company.id, role: 'customer' };
        const pagination: ContactPaginationOptions = {
          sort: { field: 'updated_at', direction: 'desc' },
          limit: 10,
        };

        // ACT:
        const result = await listContacts(filters, pagination, db);

        // ASSERT:
        expect(result.contacts.length).toBe(1);
        expect(result.contacts[0]?.id).toBe(contact.id);
        expect(result.pagination.hasMore).toBe(false);
        expect(result.pagination.nextCursor).toBeNull();
      });

      it('paginates through results using cursor', async () => {
        // ARRANGE:
        const timestamp = Date.now();
        // Use a company filter for isolation
        const company = await createTestCompany();
        const contact1 = await createTestGlobalContact({
          name: `Page Contact A ${timestamp}`,
          source: 'ocr',
        });
        await createTestGlobalContactCompany({
          globalContactId: contact1.id,
          companyId: company.id,
          role: 'supplier',
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
        const contact2 = await createTestGlobalContact({
          name: `Page Contact B ${timestamp}`,
          source: 'ocr',
        });
        await createTestGlobalContactCompany({
          globalContactId: contact2.id,
          companyId: company.id,
          role: 'supplier',
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
        const contact3 = await createTestGlobalContact({
          name: `Page Contact C ${timestamp}`,
          source: 'ocr',
        });
        await createTestGlobalContactCompany({
          globalContactId: contact3.id,
          companyId: company.id,
          role: 'supplier',
        });

        const filters: ContactListFilters = { companyId: company.id, role: 'supplier' };

        // ACT: Get first page
        const page1 = await listContacts(
          filters,
          { sort: { field: 'updated_at', direction: 'desc' }, limit: 2 },
          db
        );

        // ASSERT page 1
        expect(page1.contacts.length).toBe(2);
        expect(page1.pagination.hasMore).toBe(true);
        expect(page1.pagination.nextCursor).not.toBeNull();
        // Most recent first (desc)
        expect(page1.contacts[0]?.id).toBe(contact3.id);
        expect(page1.contacts[1]?.id).toBe(contact2.id);

        // ACT: Get second page using cursor
        expect(page1.pagination.nextCursor).not.toBeNull();
        const page2 = await listContacts(
          filters,
          {
            sort: { field: 'updated_at', direction: 'desc' },
            limit: 2,
            cursor: page1.pagination.nextCursor ?? undefined,
          },
          db
        );

        // ASSERT page 2
        expect(page2.contacts.length).toBe(1);
        expect(page2.pagination.hasMore).toBe(false);
        expect(page2.pagination.nextCursor).toBeNull();
        expect(page2.contacts[0]?.id).toBe(contact1.id);
      });

      it('throws error for invalid cursor format', async () => {
        // ARRANGE:
        const pagination: ContactPaginationOptions = {
          sort: { field: 'updated_at', direction: 'desc' },
          cursor: 'invalid-cursor',
          limit: 10,
        };

        // ACT & ASSERT:
        await expect(listContacts({}, pagination, db)).rejects.toThrow(InvalidCursorError);
      });

      it('throws error when cursor sort does not match request sort', async () => {
        // ARRANGE:
        const cursor = encodeCursor({
          sortField: 'updated_at',
          sortDirection: 'desc',
          sortValue: new Date(),
          id: '123',
        });

        const pagination: ContactPaginationOptions = {
          sort: { field: 'name', direction: 'asc' }, // Different sort
          cursor,
          limit: 10,
        };

        // ACT & ASSERT:
        await expect(listContacts({}, pagination, db)).rejects.toThrow(CursorSortMismatchError);
      });

      it('returns all contacts when limit is null', async () => {
        // ARRANGE:
        const timestamp = Date.now();
        // Use a company filter for isolation
        const company = await createTestCompany();
        const contact1 = await createTestGlobalContact({
          name: `No Limit 1 ${timestamp}`,
          source: 'ocr',
        });
        await createTestGlobalContactCompany({
          globalContactId: contact1.id,
          companyId: company.id,
          role: 'customer',
        });
        const contact2 = await createTestGlobalContact({
          name: `No Limit 2 ${timestamp}`,
          source: 'ocr',
        });
        await createTestGlobalContactCompany({
          globalContactId: contact2.id,
          companyId: company.id,
          role: 'customer',
        });
        const contact3 = await createTestGlobalContact({
          name: `No Limit 3 ${timestamp}`,
          source: 'ocr',
        });
        await createTestGlobalContactCompany({
          globalContactId: contact3.id,
          companyId: company.id,
          role: 'customer',
        });

        const filters: ContactListFilters = { companyId: company.id, role: 'customer' };
        const pagination: ContactPaginationOptions = {
          sort: { field: 'updated_at', direction: 'desc' },
          limit: null,
        };

        // ACT:
        const result = await listContacts(filters, pagination, db);

        // ASSERT:
        expect(result.contacts.length).toBe(3);
        expect(result.pagination.hasMore).toBe(false);
        expect(result.pagination.nextCursor).toBeNull();
      });
    });
  });

  describe('findContactByIdWithCompanies', () => {
    it('returns contact with company relationships', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({
        name: 'Contact With Companies',
        source: 'ocr',
      });
      const company1 = await createTestCompany();
      const company2 = await createTestCompany();

      await createTestGlobalContactCompany({
        globalContactId: contact.id,
        companyId: company1.id,
        role: 'supplier',
      });
      await createTestGlobalContactCompany({
        globalContactId: contact.id,
        companyId: company2.id,
        role: 'customer',
      });

      // ACT:
      const result = await findContactByIdWithCompanies(contact.id, db);

      // ASSERT:
      expect(result).not.toBeNull();
      expect(result?.contact.id).toBe(contact.id);
      expect(result?.contact.name).toBe('Contact With Companies');
      expect(result?.companies).toHaveLength(2);
      expect(result?.companies.map((c) => c.companyId).sort()).toEqual(
        [company1.id, company2.id].sort()
      );
    });

    it('returns contact with empty companies array when no relationships', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({
        name: 'Contact Without Companies',
        source: 'ocr',
      });

      // ACT:
      const result = await findContactByIdWithCompanies(contact.id, db);

      // ASSERT:
      expect(result).not.toBeNull();
      expect(result?.contact.id).toBe(contact.id);
      expect(result?.companies).toHaveLength(0);
    });

    it('returns null when contact does not exist', async () => {
      // ARRANGE:
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT:
      const result = await findContactByIdWithCompanies(nonExistentId, db);

      // ASSERT:
      expect(result).toBeNull();
    });
  });
});
