import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  createTestGlobalContact,
  createTestGlobalContactDocument,
} from '../../../../tests/factories/index.js';
import { db, globalContacts } from '../../../db/index.js';
import {
  createContactDocumentLink,
  deleteDocumentLink,
  deleteDocumentLinkById,
  findContactDocumentLink,
  findDocumentLinksByContactId,
  findDocumentLinksByDocumentId,
} from './global-contacts-documents.repository.js';

describe('global-contacts-documents.repository', () => {
  describe('createContactDocumentLink', () => {
    it('creates a document link with valid contact and document IDs', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'Test Contact', source: 'ocr' });
      const documentId = randomUUID();

      // ACT:
      const result = await createContactDocumentLink(
        {
          globalContactId: contact.id,
          documentId,
        },
        db
      );

      // ASSERT:
      expect(result.id).toBeDefined();
      expect(result.globalContactId).toBe(contact.id);
      expect(result.documentId).toBe(documentId);
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('returns existing link when duplicate is created (idempotent)', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'Idempotent Contact', source: 'ocr' });
      const documentId = randomUUID();

      // Create first link
      const firstResult = await createContactDocumentLink(
        {
          globalContactId: contact.id,
          documentId,
        },
        db
      );

      // ACT: Create duplicate link
      const secondResult = await createContactDocumentLink(
        {
          globalContactId: contact.id,
          documentId,
        },
        db
      );

      // ASSERT:
      expect(secondResult.id).toBe(firstResult.id);
      expect(secondResult.globalContactId).toBe(contact.id);
      expect(secondResult.documentId).toBe(documentId);
    });

    it('allows same contact to link to multiple documents', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'Multi Doc Contact', source: 'ocr' });
      const documentId1 = randomUUID();
      const documentId2 = randomUUID();

      // ACT:
      const link1 = await createContactDocumentLink(
        {
          globalContactId: contact.id,
          documentId: documentId1,
        },
        db
      );
      const link2 = await createContactDocumentLink(
        {
          globalContactId: contact.id,
          documentId: documentId2,
        },
        db
      );

      // ASSERT:
      expect(link1.id).not.toBe(link2.id);
      expect(link1.documentId).toBe(documentId1);
      expect(link2.documentId).toBe(documentId2);
    });

    it('allows same document to link to multiple contacts', async () => {
      // ARRANGE:
      const contact1 = await createTestGlobalContact({ name: 'Contact 1', source: 'ocr' });
      const contact2 = await createTestGlobalContact({ name: 'Contact 2', source: 'vies' });
      const documentId = randomUUID();

      // ACT:
      const link1 = await createContactDocumentLink(
        {
          globalContactId: contact1.id,
          documentId,
        },
        db
      );
      const link2 = await createContactDocumentLink(
        {
          globalContactId: contact2.id,
          documentId,
        },
        db
      );

      // ASSERT:
      expect(link1.id).not.toBe(link2.id);
      expect(link1.globalContactId).toBe(contact1.id);
      expect(link2.globalContactId).toBe(contact2.id);
    });
  });

  describe('findContactDocumentLink', () => {
    it('finds existing document link', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'Find Test', source: 'ocr' });
      const documentId = randomUUID();
      const link = await createTestGlobalContactDocument({
        globalContactId: contact.id,
        documentId,
      });

      // ACT:
      const result = await findContactDocumentLink(contact.id, documentId, db);

      // ASSERT:
      expect(result).not.toBeNull();
      expect(result?.id).toBe(link.id);
    });

    it('returns null when link does not exist', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'No Link Test', source: 'ocr' });
      const documentId = randomUUID();

      // ACT:
      const result = await findContactDocumentLink(contact.id, documentId, db);

      // ASSERT:
      expect(result).toBeNull();
    });

    it('returns null when contact ID does not match', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'Contact Mismatch', source: 'ocr' });
      const documentId = randomUUID();
      await createTestGlobalContactDocument({
        globalContactId: contact.id,
        documentId,
      });
      const otherContactId = randomUUID();

      // ACT:
      const result = await findContactDocumentLink(otherContactId, documentId, db);

      // ASSERT:
      expect(result).toBeNull();
    });

    it('returns null when document ID does not match', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'Doc Mismatch', source: 'ocr' });
      const documentId = randomUUID();
      await createTestGlobalContactDocument({
        globalContactId: contact.id,
        documentId,
      });
      const otherDocumentId = randomUUID();

      // ACT:
      const result = await findContactDocumentLink(contact.id, otherDocumentId, db);

      // ASSERT:
      expect(result).toBeNull();
    });
  });

  describe('findDocumentLinksByContactId', () => {
    it('returns all document links for a contact', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'Multi Doc Contact', source: 'ocr' });
      const documentId1 = randomUUID();
      const documentId2 = randomUUID();

      await createTestGlobalContactDocument({
        globalContactId: contact.id,
        documentId: documentId1,
      });
      await createTestGlobalContactDocument({
        globalContactId: contact.id,
        documentId: documentId2,
      });

      // ACT:
      const results = await findDocumentLinksByContactId(contact.id, db);

      // ASSERT:
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.documentId).sort()).toEqual([documentId1, documentId2].sort());
    });

    it('returns empty array when contact has no document links', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'No Links', source: 'ocr' });

      // ACT:
      const results = await findDocumentLinksByContactId(contact.id, db);

      // ASSERT:
      expect(results).toHaveLength(0);
    });
  });

  describe('findDocumentLinksByDocumentId', () => {
    it('returns all document links for a document', async () => {
      // ARRANGE:
      const contact1 = await createTestGlobalContact({ name: 'Contact 1', source: 'ocr' });
      const contact2 = await createTestGlobalContact({ name: 'Contact 2', source: 'vies' });
      const documentId = randomUUID();

      await createTestGlobalContactDocument({
        globalContactId: contact1.id,
        documentId,
      });
      await createTestGlobalContactDocument({
        globalContactId: contact2.id,
        documentId,
      });

      // ACT:
      const results = await findDocumentLinksByDocumentId(documentId, db);

      // ASSERT:
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.globalContactId).sort()).toEqual(
        [contact1.id, contact2.id].sort()
      );
    });

    it('returns empty array when document has no links', async () => {
      // ARRANGE:
      const documentId = randomUUID();

      // ACT:
      const results = await findDocumentLinksByDocumentId(documentId, db);

      // ASSERT:
      expect(results).toHaveLength(0);
    });
  });

  describe('deleteDocumentLinkById', () => {
    it('deletes existing document link', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'Delete Test', source: 'ocr' });
      const documentId = randomUUID();
      const link = await createTestGlobalContactDocument({
        globalContactId: contact.id,
        documentId,
      });

      // ACT:
      const result = await deleteDocumentLinkById(link.id, db);

      // ASSERT:
      expect(result).toBe(true);

      // Verify deletion
      const found = await findContactDocumentLink(contact.id, documentId, db);
      expect(found).toBeNull();
    });

    it('returns false when document link does not exist', async () => {
      // ARRANGE:
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT:
      const result = await deleteDocumentLinkById(nonExistentId, db);

      // ASSERT:
      expect(result).toBe(false);
    });
  });

  describe('deleteDocumentLink', () => {
    it('deletes document link by contact and document', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'Delete By Fields', source: 'ocr' });
      const documentId = randomUUID();
      await createTestGlobalContactDocument({
        globalContactId: contact.id,
        documentId,
      });

      // ACT:
      const result = await deleteDocumentLink(contact.id, documentId, db);

      // ASSERT:
      expect(result).toBe(true);

      // Verify deletion
      const found = await findContactDocumentLink(contact.id, documentId, db);
      expect(found).toBeNull();
    });

    it('returns false when document link does not exist', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'No Delete', source: 'ocr' });
      const documentId = randomUUID();

      // ACT:
      const result = await deleteDocumentLink(contact.id, documentId, db);

      // ASSERT:
      expect(result).toBe(false);
    });
  });

  describe('cascade delete behavior', () => {
    it('deletes document links when contact is deleted', async () => {
      // ARRANGE:
      const contact = await createTestGlobalContact({ name: 'Cascade Contact', source: 'ocr' });
      const documentId = randomUUID();
      await createTestGlobalContactDocument({
        globalContactId: contact.id,
        documentId,
      });

      // ACT: Delete the contact
      await db.delete(globalContacts).where(eq(globalContacts.id, contact.id));

      // ASSERT: Document link should be deleted via cascade
      const found = await findContactDocumentLink(contact.id, documentId, db);
      expect(found).toBeNull();
    });
  });
});
