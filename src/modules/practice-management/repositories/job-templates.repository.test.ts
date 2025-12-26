import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  buildTestJobTemplateData,
  createTestJobTemplate,
  createTestJobTemplates,
} from '../../../../tests/factories/job-templates.js';
import { db } from '../../../db/index.js';
import { jobTemplates } from '../../../db/schema.js';
import {
  createJobTemplate,
  deleteJobTemplate,
  findAllJobTemplates,
  findJobTemplateById,
  updateJobTemplate,
} from './job-templates.repository.js';

describe('Job Templates Repository', () => {
  describe('createJobTemplate', () => {
    it('should create a job template with all fields', async () => {
      // ARRANGE
      const data = buildTestJobTemplateData({
        code: `CREATE_TEST_1_${Date.now()}`,
        name: 'Create Test Template',
        description: 'Test description',
        isActive: 'true',
        titlePattern: 'Test - {company_name}',
      });

      // ACT
      const jobTemplate = await createJobTemplate(data, db);

      // ASSERT
      expect(jobTemplate).toBeDefined();
      expect(jobTemplate.id).toBeDefined();
      expect(jobTemplate.code).toBe(data.code);
      expect(jobTemplate.name).toBe('Create Test Template');
      expect(jobTemplate.description).toBe('Test description');
      expect(jobTemplate.isActive).toBe('true');
      expect(jobTemplate.titlePattern).toBe('Test - {company_name}');
      expect(jobTemplate.createdAt).toBeInstanceOf(Date);
      expect(jobTemplate.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a job template with nullable fields', async () => {
      // ARRANGE
      const data = buildTestJobTemplateData({
        code: `CREATE_TEST_2_${Date.now()}`,
        name: 'Create Test Template 2',
        description: null,
        defaultAssigneeId: null,
        titlePattern: 'Test - {id}',
      });

      // ACT
      const jobTemplate = await createJobTemplate(data, db);

      // ASSERT
      expect(jobTemplate).toBeDefined();
      expect(jobTemplate.description).toBeNull();
      expect(jobTemplate.defaultAssigneeId).toBeNull();
    });

    it('should enforce unique code constraint', async () => {
      // ARRANGE
      const code = `UNIQUE_TEST_${Date.now()}`;
      const data1 = buildTestJobTemplateData({ code });
      const data2 = buildTestJobTemplateData({ code });
      await createJobTemplate(data1, db);

      // ACT & ASSERT
      await expect(createJobTemplate(data2, db)).rejects.toThrow();
    });

    it('should enforce code format constraint', async () => {
      // ARRANGE
      const data = buildTestJobTemplateData({
        code: 'invalid-code-format', // lowercase with hyphens
        name: 'Invalid Code Test',
        titlePattern: 'Test',
      });

      // ACT & ASSERT
      await expect(createJobTemplate(data, db)).rejects.toThrow();
    });

    it('should throw error if insert returns no job template', async () => {
      // ARRANGE
      const data = buildTestJobTemplateData({
        code: `NO_RETURN_TEST_${Date.now()}`,
        name: 'No Return Test',
        titlePattern: 'Test',
      });

      // Create a mock database that returns empty array
      const mockDb = {
        insert: () => ({
          values: () => ({
            returning: async () => [],
          }),
        }),
        // biome-ignore lint/suspicious/noExplicitAny: Mock database for testing error paths
      } as any;

      // ACT & ASSERT
      await expect(createJobTemplate(data, mockDb)).rejects.toThrow(
        'Failed to create job template'
      );
    });
  });

  describe('findJobTemplateById', () => {
    it('should find a job template by ID', async () => {
      // ARRANGE
      const created = await createTestJobTemplate({}, db);

      // ACT
      const found = await findJobTemplateById(created.id, db);

      // ASSERT
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.code).toBe(created.code);
      expect(found?.name).toBe(created.name);
    });

    it('should return null for non-existent ID', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT
      const found = await findJobTemplateById(nonExistentId, db);

      // ASSERT
      expect(found).toBeNull();
    });
  });

  describe('findAllJobTemplates', () => {
    it('should find all job templates', async () => {
      // ARRANGE
      await createTestJobTemplates(3, {}, db);

      // ACT
      const allTemplates = await findAllJobTemplates(undefined, db);

      // ASSERT
      expect(allTemplates.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter by isActive status', async () => {
      // ARRANGE
      const activeTemplate = await createTestJobTemplate({ isActive: 'true' }, db);
      const inactiveTemplate = await createTestJobTemplate({ isActive: 'false' }, db);

      // ACT
      const activeTemplates = await findAllJobTemplates({ isActive: 'true' }, db);
      const inactiveTemplates = await findAllJobTemplates({ isActive: 'false' }, db);

      // ASSERT
      expect(activeTemplates.some((t) => t.id === activeTemplate.id)).toBe(true);
      expect(activeTemplates.some((t) => t.id === inactiveTemplate.id)).toBe(false);

      expect(inactiveTemplates.some((t) => t.id === inactiveTemplate.id)).toBe(true);
      expect(inactiveTemplates.some((t) => t.id === activeTemplate.id)).toBe(false);
    });

    it('should return templates ordered by creation date', async () => {
      // ARRANGE
      const template1 = await createTestJobTemplate({}, db);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const template2 = await createTestJobTemplate({}, db);

      // ACT
      const allTemplates = await findAllJobTemplates(undefined, db);

      // ASSERT
      const idx1 = allTemplates.findIndex((t) => t.id === template1.id);
      const idx2 = allTemplates.findIndex((t) => t.id === template2.id);

      expect(idx1).toBeGreaterThanOrEqual(0);
      expect(idx2).toBeGreaterThanOrEqual(0);
      expect(idx1).toBeLessThan(idx2); // template1 should come before template2
    });
  });

  describe('updateJobTemplate', () => {
    it('should update a job template', async () => {
      // ARRANGE
      const created = await createTestJobTemplate(
        {
          name: 'Original Name',
          description: 'Original Description',
        },
        db
      );

      // ACT
      const updated = await updateJobTemplate(
        created.id,
        {
          name: 'Updated Name',
          description: 'Updated Description',
        },
        db
      );

      // ASSERT
      expect(updated).toBeDefined();
      expect(updated).not.toBeNull();
      if (!updated) throw new Error('Updated job template should not be null');
      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe('Updated Name');
      expect(updated.description).toBe('Updated Description');
      expect(updated.code).toBe(created.code); // Unchanged
      expect((updated.updatedAt as Date).getTime()).toBeGreaterThanOrEqual(
        (created.updatedAt as Date).getTime()
      );
    });

    it('should perform partial updates', async () => {
      // ARRANGE
      const created = await createTestJobTemplate(
        {
          name: 'Original Name',
          description: 'Original Description',
          isActive: 'true',
        },
        db
      );

      // ACT
      const updated = await updateJobTemplate(
        created.id,
        {
          isActive: 'false',
        },
        db
      );

      // ASSERT
      expect(updated?.name).toBe('Original Name'); // Unchanged
      expect(updated?.description).toBe('Original Description'); // Unchanged
      expect(updated?.isActive).toBe('false'); // Updated
    });

    it('should return null for non-existent ID', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT
      const updated = await updateJobTemplate(nonExistentId, { name: 'Updated Name' }, db);

      // ASSERT
      expect(updated).toBeNull();
    });
  });

  describe('deleteJobTemplate', () => {
    it('should delete a job template (hard delete)', async () => {
      // ARRANGE
      const created = await createTestJobTemplate({}, db);

      // ACT
      const deleted = await deleteJobTemplate(created.id, db);

      // ASSERT
      expect(deleted).toBe(true);

      // Verify it's actually deleted from the database
      const found = await db.select().from(jobTemplates).where(eq(jobTemplates.id, created.id));
      expect(found.length).toBe(0);
    });

    it('should return false for non-existent ID', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT
      const deleted = await deleteJobTemplate(nonExistentId, db);

      // ASSERT
      expect(deleted).toBe(false);
    });
  });
});
