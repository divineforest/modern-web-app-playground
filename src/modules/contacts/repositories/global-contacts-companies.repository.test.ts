import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  createTestBobContact,
  createTestCompany,
  createTestGlobalContact,
  createTestGlobalContactCompany,
} from '../../../../tests/factories/index.js';
import { companies, db, globalContacts } from '../../../db/index.js';
import {
  createContactCompanyRelationship,
  deleteRelationship,
  deleteRelationshipById,
  findBobIdByCompanyAndVatId,
  findContactCompanyRelationship,
  findRelationshipsByCompanyId,
  findRelationshipsByContactId,
} from './global-contacts-companies.repository.js';

describe('global-contacts-companies.repository', () => {
  describe('createContactCompanyRelationship', () => {
    it('creates a relationship with valid contact, company, and role', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'Test Contact', source: 'ocr' });
      const company = await createTestCompany();

      // ACT:
      const result = await createContactCompanyRelationship(
        {
          globalContactId: contact.id,
          companyId: company.id,
          role: 'supplier',
        },
        db
      );

      // ASSERT:
      expect(result.id).toBeDefined();
      expect(result.globalContactId).toBe(contact.id);
      expect(result.companyId).toBe(company.id);
      expect(result.role).toBe('supplier');
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('creates a relationship with customer role', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'Customer Contact', source: 'ocr' });
      const company = await createTestCompany();

      // ACT:
      const result = await createContactCompanyRelationship(
        {
          globalContactId: contact.id,
          companyId: company.id,
          role: 'customer',
        },
        db
      );

      // ASSERT:
      expect(result.role).toBe('customer');
    });

    it('updates existing relationship when duplicate is created (upsert)', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'Upsert Test', source: 'ocr' });
      const company = await createTestCompany();
      const initialBobId = 'initial_bob_id';
      const updatedBobId = 'updated_bob_id';

      // Create first relationship with initial bobId
      const firstResult = await createContactCompanyRelationship(
        {
          globalContactId: contact.id,
          companyId: company.id,
          role: 'supplier',
          bobId: initialBobId,
        },
        db
      );

      // ACT: Create duplicate with different bobId - should update
      const secondResult = await createContactCompanyRelationship(
        {
          globalContactId: contact.id,
          companyId: company.id,
          role: 'supplier',
          bobId: updatedBobId,
        },
        db
      );

      // ASSERT:
      expect(secondResult).not.toBeNull();
      expect(secondResult.id).toBe(firstResult.id); // Same row
      expect(secondResult.bobId).toBe(updatedBobId); // Updated bobId
      expect(secondResult.updatedAt.getTime()).toBeGreaterThanOrEqual(
        firstResult.updatedAt.getTime()
      );
    });

    it('returns existing relationship when duplicate with same data (idempotent)', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'Idempotent Test', source: 'ocr' });
      const company = await createTestCompany();
      const bobId = 'same_bob_id';

      // Create first relationship
      const firstResult = await createContactCompanyRelationship(
        {
          globalContactId: contact.id,
          companyId: company.id,
          role: 'supplier',
          bobId,
        },
        db
      );

      // ACT: Create duplicate with same data
      const secondResult = await createContactCompanyRelationship(
        {
          globalContactId: contact.id,
          companyId: company.id,
          role: 'supplier',
          bobId,
        },
        db
      );

      // ASSERT:
      expect(secondResult).not.toBeNull();
      expect(secondResult.id).toBe(firstResult.id); // Same row
      expect(secondResult.bobId).toBe(bobId);
    });

    it('preserves existing bobId when upsert has null bobId', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'Preserve BobId Null', source: 'ocr' });
      const company = await createTestCompany();
      const existingBobId = 'existing_bob_id';

      // Create first relationship with bobId
      const firstResult = await createContactCompanyRelationship(
        {
          globalContactId: contact.id,
          companyId: company.id,
          role: 'supplier',
          bobId: existingBobId,
        },
        db
      );

      // ACT: Upsert with null bobId - should preserve existing
      const secondResult = await createContactCompanyRelationship(
        {
          globalContactId: contact.id,
          companyId: company.id,
          role: 'supplier',
          bobId: null,
        },
        db
      );

      // ASSERT:
      expect(secondResult.id).toBe(firstResult.id);
      expect(secondResult.bobId).toBe(existingBobId); // Preserved existing value
    });

    it('preserves existing bobId when upsert has undefined bobId', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({
        name: 'Preserve BobId Undefined',
        source: 'ocr',
      });
      const company = await createTestCompany();
      const existingBobId = 'existing_bob_id_2';

      // Create first relationship with bobId
      const firstResult = await createContactCompanyRelationship(
        {
          globalContactId: contact.id,
          companyId: company.id,
          role: 'supplier',
          bobId: existingBobId,
        },
        db
      );

      // ACT: Upsert without bobId field (undefined) - should preserve existing
      const secondResult = await createContactCompanyRelationship(
        {
          globalContactId: contact.id,
          companyId: company.id,
          role: 'supplier',
          // bobId not provided (undefined)
        },
        db
      );

      // ASSERT:
      expect(secondResult.id).toBe(firstResult.id);
      expect(secondResult.bobId).toBe(existingBobId); // Preserved existing value
    });

    it('preserves existing bobId when upsert has empty string bobId', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({
        name: 'Preserve BobId Empty',
        source: 'ocr',
      });
      const company = await createTestCompany();
      const existingBobId = 'existing_bob_id_3';

      // Create first relationship with bobId
      const firstResult = await createContactCompanyRelationship(
        {
          globalContactId: contact.id,
          companyId: company.id,
          role: 'supplier',
          bobId: existingBobId,
        },
        db
      );

      // ACT: Upsert with empty string bobId - should preserve existing
      const secondResult = await createContactCompanyRelationship(
        {
          globalContactId: contact.id,
          companyId: company.id,
          role: 'supplier',
          bobId: '',
        },
        db
      );

      // ASSERT:
      expect(secondResult.id).toBe(firstResult.id);
      expect(secondResult.bobId).toBe(existingBobId); // Preserved existing value
    });

    it('allows same contact-company with different roles', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'Multi-role Contact', source: 'ocr' });
      const company = await createTestCompany();

      // Create supplier relationship
      const supplierResult = await createContactCompanyRelationship(
        {
          globalContactId: contact.id,
          companyId: company.id,
          role: 'supplier',
        },
        db
      );

      // ACT: Create customer relationship
      const customerResult = await createContactCompanyRelationship(
        {
          globalContactId: contact.id,
          companyId: company.id,
          role: 'customer',
        },
        db
      );

      // ASSERT:
      expect(supplierResult.id).toBeDefined();
      expect(customerResult.id).toBeDefined();
      expect(supplierResult.id).not.toBe(customerResult.id);
    });
  });

  describe('findContactCompanyRelationship', () => {
    it('finds existing relationship', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'Find Test', source: 'ocr' });
      const company = await createTestCompany();
      const relationship = await createTestGlobalContactCompany({
        globalContactId: contact.id,
        companyId: company.id,
        role: 'supplier',
      });

      // ACT:
      const result = await findContactCompanyRelationship(contact.id, company.id, 'supplier', db);

      // ASSERT:
      expect(result).not.toBeNull();
      expect(result?.id).toBe(relationship.id);
    });

    it('returns null when relationship does not exist', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'No Rel Test', source: 'ocr' });
      const company = await createTestCompany();

      // ACT:
      const result = await findContactCompanyRelationship(contact.id, company.id, 'supplier', db);

      // ASSERT:
      expect(result).toBeNull();
    });

    it('returns null when role does not match', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'Role Mismatch', source: 'ocr' });
      const company = await createTestCompany();
      await createTestGlobalContactCompany({
        globalContactId: contact.id,
        companyId: company.id,
        role: 'supplier',
      });

      // ACT:
      const result = await findContactCompanyRelationship(
        contact.id,
        company.id,
        'customer', // Different role
        db
      );

      // ASSERT:
      expect(result).toBeNull();
    });
  });

  describe('findRelationshipsByContactId', () => {
    it('returns all relationships for a contact', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({
        name: 'Multi Company Contact',
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
      const results = await findRelationshipsByContactId(contact.id, db);

      // ASSERT:
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.companyId).sort()).toEqual([company1.id, company2.id].sort());
    });

    it('returns empty array when contact has no relationships', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'No Relationships', source: 'ocr' });

      // ACT:
      const results = await findRelationshipsByContactId(contact.id, db);

      // ASSERT:
      expect(results).toHaveLength(0);
    });
  });

  describe('findRelationshipsByCompanyId', () => {
    it('returns all relationships for a company', async () => {
      // ARRANGE:
      const company = await createTestCompany();
      const contact1 = await createTestGlobalContact({ name: 'Contact 1', source: 'ocr' });
      const contact2 = await createTestGlobalContact({ name: 'Contact 2', source: 'vies' });

      await createTestGlobalContactCompany({
        globalContactId: contact1.id,
        companyId: company.id,
        role: 'supplier',
      });
      await createTestGlobalContactCompany({
        globalContactId: contact2.id,
        companyId: company.id,
        role: 'supplier',
      });

      // ACT:
      const results = await findRelationshipsByCompanyId(company.id, db);

      // ASSERT:
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.globalContactId).sort()).toEqual(
        [contact1.id, contact2.id].sort()
      );
    });

    it('returns empty array when company has no relationships', async () => {
      // ARRANGE:
      const company = await createTestCompany();

      // ACT:
      const results = await findRelationshipsByCompanyId(company.id, db);

      // ASSERT:
      expect(results).toHaveLength(0);
    });
  });

  describe('deleteRelationshipById', () => {
    it('deletes existing relationship', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'Delete Test', source: 'ocr' });
      const company = await createTestCompany();
      const relationship = await createTestGlobalContactCompany({
        globalContactId: contact.id,
        companyId: company.id,
        role: 'supplier',
      });

      // ACT:
      const result = await deleteRelationshipById(relationship.id, db);

      // ASSERT:
      expect(result).toBe(true);

      // Verify deletion
      const found = await findContactCompanyRelationship(contact.id, company.id, 'supplier', db);
      expect(found).toBeNull();
    });

    it('returns false when relationship does not exist', async () => {
      // ARRANGE:
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT:
      const result = await deleteRelationshipById(nonExistentId, db);

      // ASSERT:
      expect(result).toBe(false);
    });
  });

  describe('deleteRelationship', () => {
    it('deletes relationship by contact, company, and role', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'Delete By Fields', source: 'ocr' });
      const company = await createTestCompany();
      await createTestGlobalContactCompany({
        globalContactId: contact.id,
        companyId: company.id,
        role: 'supplier',
      });

      // ACT:
      const result = await deleteRelationship(contact.id, company.id, 'supplier', db);

      // ASSERT:
      expect(result).toBe(true);

      // Verify deletion
      const found = await findContactCompanyRelationship(contact.id, company.id, 'supplier', db);
      expect(found).toBeNull();
    });

    it('returns false when relationship does not exist', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'No Delete', source: 'ocr' });
      const company = await createTestCompany();

      // ACT:
      const result = await deleteRelationship(contact.id, company.id, 'supplier', db);

      // ASSERT:
      expect(result).toBe(false);
    });
  });

  describe('cascade delete behavior', () => {
    it('deletes relationships when contact is deleted', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'Cascade Contact', source: 'ocr' });
      const company = await createTestCompany();
      await createTestGlobalContactCompany({
        globalContactId: contact.id,
        companyId: company.id,
        role: 'supplier',
      });

      // ACT: Delete the contact
      await db.delete(globalContacts).where(eq(globalContacts.id, contact.id));

      // ASSERT: Relationship should be deleted via cascade
      const found = await findContactCompanyRelationship(contact.id, company.id, 'supplier', db);
      expect(found).toBeNull();
    });

    it('deletes relationships when company is deleted', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'Cascade Company', source: 'ocr' });
      const company = await createTestCompany();
      await createTestGlobalContactCompany({
        globalContactId: contact.id,
        companyId: company.id,
        role: 'supplier',
      });

      // ACT: Delete the company
      await db.delete(companies).where(eq(companies.id, company.id));

      // ASSERT: Relationship should be deleted via cascade
      const found = await findContactCompanyRelationship(contact.id, company.id, 'supplier', db);
      expect(found).toBeNull();
    });
  });

  describe('findBobIdByCompanyAndVatId', () => {
    it('returns bob_id when matching bob_contacts record exists', async () => {
      // ARRANGE:
      const company = await createTestCompany();
      const vatId = `DE${Date.now()}`;
      const expectedBobId = `bob_test_${Date.now()}`;
      await createTestBobContact({
        companyId: company.id,
        vatId,
        bobId: expectedBobId,
      });

      // ACT:
      const result = await findBobIdByCompanyAndVatId(company.id, vatId, db);

      // ASSERT:
      expect(result).toBe(expectedBobId);
    });

    it('returns null when no matching bob_contacts record', async () => {
      // ARRANGE:
      const company = await createTestCompany();
      const vatId = `DE${Date.now()}`;
      // No bob_contacts record created

      // ACT:
      const result = await findBobIdByCompanyAndVatId(company.id, vatId, db);

      // ASSERT:
      expect(result).toBeNull();
    });

    it('returns null when company matches but vat_id does not', async () => {
      // ARRANGE:
      const company = await createTestCompany();
      const vatId1 = `DE${Date.now()}`;
      const vatId2 = `DE${Date.now() + 1}`;
      await createTestBobContact({
        companyId: company.id,
        vatId: vatId1,
        bobId: 'bob_should_not_match',
      });

      // ACT:
      const result = await findBobIdByCompanyAndVatId(company.id, vatId2, db);

      // ASSERT:
      expect(result).toBeNull();
    });

    it('returns null when vat_id matches but company does not', async () => {
      // ARRANGE:
      const company1 = await createTestCompany();
      const company2 = await createTestCompany();
      const vatId = `DE${Date.now()}`;
      await createTestBobContact({
        companyId: company1.id,
        vatId,
        bobId: 'bob_should_not_match',
      });

      // ACT:
      const result = await findBobIdByCompanyAndVatId(company2.id, vatId, db);

      // ASSERT:
      expect(result).toBeNull();
    });

    it('returns null when bob_contacts record has null bob_id', async () => {
      // ARRANGE:
      const company = await createTestCompany();
      const vatId = `DE${Date.now()}`;
      await createTestBobContact({
        companyId: company.id,
        vatId,
        bobId: null,
      });

      // ACT:
      const result = await findBobIdByCompanyAndVatId(company.id, vatId, db);

      // ASSERT:
      expect(result).toBeNull();
    });
  });

  describe('createContactCompanyRelationship with bob_id', () => {
    it('creates a relationship with bob_id', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'Bob ID Contact', source: 'ocr' });
      const company = await createTestCompany();
      const bobId = `bob_test_${Date.now()}`;

      // ACT:
      const result = await createContactCompanyRelationship(
        {
          globalContactId: contact.id,
          companyId: company.id,
          role: 'supplier',
          bobId,
        },
        db
      );

      // ASSERT:
      expect(result.bobId).toBe(bobId);
    });

    it('creates a relationship with null bob_id', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'No Bob ID Contact', source: 'ocr' });
      const company = await createTestCompany();

      // ACT:
      const result = await createContactCompanyRelationship(
        {
          globalContactId: contact.id,
          companyId: company.id,
          role: 'supplier',
          bobId: null,
        },
        db
      );

      // ASSERT:
      expect(result.bobId).toBeNull();
    });
  });
});
