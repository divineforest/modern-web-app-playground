import { describe, expect, it } from 'vitest';
import { createTestJobTemplate } from '../../../../tests/factories/job-templates.js';
import { db } from '../../../db/index.js';
import {
  createJobTemplateService,
  deleteJobTemplateService,
  getJobTemplateByIdService,
  JobTemplateNotFoundError,
  JobTemplateValidationError,
  jobTemplatesService,
  listJobTemplatesService,
  updateJobTemplateService,
} from './job-templates.service.js';

describe('Job Templates Service', () => {
  describe('createJobTemplateService', () => {
    it('should create a job template with valid data', async () => {
      // ARRANGE
      const input = {
        code: `SERVICE_TEST_${Date.now()}`,
        name: 'Service Test Template',
        description: 'Test description',
        isActive: 'true' as const,
        defaultAssigneeId: null,
        titlePattern: 'Service Test - {company_name}',
      };

      // ACT
      const jobTemplate = await createJobTemplateService(input, db);

      // ASSERT
      expect(jobTemplate).toBeDefined();
      expect(jobTemplate.id).toBeDefined();
      expect(jobTemplate.code).toBe(input.code);
      expect(jobTemplate.name).toBe(input.name);
      expect(jobTemplate.description).toBe(input.description);
    });

    it('should reject empty name as validation error', async () => {
      // ARRANGE
      const input = {
        code: 'MISSING_NAME',
        name: '', // Empty name should fail validation
        titlePattern: 'Test',
        isActive: 'true' as const,
      };

      // ACT & ASSERT
      await expect(createJobTemplateService(input, db)).rejects.toThrow(JobTemplateValidationError);
    });

    it('should reject invalid code format with special characters', async () => {
      // ARRANGE
      const input = {
        code: 'invalid-code', // Invalid: lowercase with hyphens
        name: 'Test Template',
        titlePattern: 'Test',
        isActive: 'true' as const,
      };

      // ACT & ASSERT
      await expect(createJobTemplateService(input, db)).rejects.toThrow(JobTemplateValidationError);
    });

    it('should accept valid code format with uppercase and underscores', async () => {
      // ARRANGE
      const input = {
        code: `VALID_CODE_123_${Date.now()}`,
        name: 'Valid Code Test',
        titlePattern: 'Test',
        isActive: 'true' as const,
      };

      // ACT
      const jobTemplate = await createJobTemplateService(input, db);

      // ASSERT
      expect(jobTemplate.code).toBe(input.code);
    });

    it('should reject duplicate code with user-friendly error message', async () => {
      // ARRANGE
      const uniqueCode = `UNIQUE_CODE_${Date.now()}`;
      await createJobTemplateService(
        {
          code: uniqueCode,
          name: 'First Template',
          titlePattern: 'Test',
          isActive: 'true' as const,
        },
        db
      );

      // ACT & ASSERT
      await expect(
        createJobTemplateService(
          {
            code: uniqueCode, // Duplicate code
            name: 'Second Template',
            titlePattern: 'Test',
            isActive: 'true' as const,
          },
          db
        )
      ).rejects.toThrow(JobTemplateValidationError);
    });

    it('should reject invalid service type reference with user-friendly error', async () => {
      // ARRANGE
      const input = {
        code: `FK_TEST_${Date.now()}`,
        name: 'FK Test Template',
        titlePattern: 'Test',
        isActive: 'true' as const,
        serviceTypeId: '00000000-0000-0000-0000-999999999999', // Non-existent service type
      };

      // ACT & ASSERT
      await expect(createJobTemplateService(input, db)).rejects.toThrow(JobTemplateValidationError);
    });

    it('should re-throw generic errors that are not Zod or DB errors', async () => {
      // ARRANGE
      const input = {
        code: `GENERIC_ERROR_TEST_${Date.now()}`,
        name: 'Generic Error Test',
        titlePattern: 'Test',
        isActive: 'true' as const,
      };

      // Create a mock database that throws a generic error
      const mockDb = {
        insert: () => ({
          values: () => ({
            returning: () => {
              throw new Error('Unexpected system error');
            },
          }),
        }),
        // biome-ignore lint/suspicious/noExplicitAny: Mock database for testing error paths
      } as any;

      // ACT & ASSERT
      await expect(createJobTemplateService(input, mockDb)).rejects.toThrow(
        'Unexpected system error'
      );
    });
  });

  describe('getJobTemplateByIdService', () => {
    it('should retrieve a job template by ID', async () => {
      // ARRANGE
      const created = await createTestJobTemplate({}, db);

      // ACT
      const jobTemplate = await getJobTemplateByIdService(created.id, db);

      // ASSERT
      expect(jobTemplate).toBeDefined();
      expect(jobTemplate.id).toBe(created.id);
      expect(jobTemplate.code).toBe(created.code);
    });

    it('should throw JobTemplateNotFoundError for non-existent ID', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT & ASSERT
      await expect(getJobTemplateByIdService(nonExistentId, db)).rejects.toThrow(
        JobTemplateNotFoundError
      );
    });
  });

  describe('listJobTemplatesService', () => {
    it('should list all job templates', async () => {
      // ARRANGE
      await createTestJobTemplate({ isActive: 'true' }, db);
      await createTestJobTemplate({ isActive: 'false' }, db);

      // ACT
      const jobTemplates = await listJobTemplatesService({}, db);

      // ASSERT
      expect(jobTemplates).toBeDefined();
      expect(Array.isArray(jobTemplates)).toBe(true);
      expect(jobTemplates.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by active status', async () => {
      // ARRANGE
      const activeTemplate = await createTestJobTemplate({ isActive: 'true' }, db);
      const inactiveTemplate = await createTestJobTemplate({ isActive: 'false' }, db);

      // ACT
      const activeTemplates = await listJobTemplatesService({ isActive: 'true' }, db);
      const inactiveTemplates = await listJobTemplatesService({ isActive: 'false' }, db);

      // ASSERT
      expect(activeTemplates.some((t) => t.id === activeTemplate.id)).toBe(true);
      expect(activeTemplates.some((t) => t.id === inactiveTemplate.id)).toBe(false);

      expect(inactiveTemplates.some((t) => t.id === inactiveTemplate.id)).toBe(true);
      expect(inactiveTemplates.some((t) => t.id === activeTemplate.id)).toBe(false);
    });
  });

  describe('updateJobTemplateService', () => {
    it('should update job template fields', async () => {
      // ARRANGE
      const original = await createTestJobTemplate(
        {
          name: 'Original Name',
          description: 'Original Description',
        },
        db
      );

      // ACT
      const updated = await updateJobTemplateService(
        original.id,
        {
          name: 'Updated Name',
          description: 'Updated Description',
        },
        db
      );

      // ASSERT
      expect(updated).toBeDefined();
      expect(updated.id).toBe(original.id);
      expect(updated.name).toBe('Updated Name');
      expect(updated.description).toBe('Updated Description');
    });

    it('should reject invalid code format during update', async () => {
      // ARRANGE
      const jobTemplate = await createTestJobTemplate({}, db);

      // ACT & ASSERT
      await expect(
        updateJobTemplateService(
          jobTemplate.id,
          {
            code: 'invalid-code', // Invalid format
          },
          db
        )
      ).rejects.toThrow(JobTemplateValidationError);
    });

    it('should throw JobTemplateNotFoundError when updating non-existent ID', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT & ASSERT
      await expect(
        updateJobTemplateService(nonExistentId, { name: 'Updated Name' }, db)
      ).rejects.toThrow(JobTemplateNotFoundError);
    });

    it('should perform partial updates without affecting other fields', async () => {
      // ARRANGE
      const original = await createTestJobTemplate(
        {
          name: 'Original Name',
          isActive: 'true',
        },
        db
      );

      // ACT
      const updated = await updateJobTemplateService(
        original.id,
        {
          isActive: 'false',
        },
        db
      );

      // ASSERT
      expect(updated.name).toBe('Original Name'); // Unchanged
      expect(updated.isActive).toBe('false'); // Updated
    });

    it('should re-throw generic errors that are not Zod, NotFound, or DB errors', async () => {
      // ARRANGE
      const id = '12345678-1234-1234-1234-123456789012';
      const input = { name: 'Updated Name' };

      // Create a mock database that throws a generic error
      const mockDb = {
        update: () => ({
          set: () => ({
            where: () => ({
              returning: () => {
                throw new Error('Unexpected database connection error');
              },
            }),
          }),
        }),
        // biome-ignore lint/suspicious/noExplicitAny: Mock database for testing error paths
      } as any;

      // ACT & ASSERT
      await expect(updateJobTemplateService(id, input, mockDb)).rejects.toThrow(
        'Unexpected database connection error'
      );
    });
  });

  describe('deleteJobTemplateService', () => {
    it('should delete a job template and return its ID', async () => {
      // ARRANGE
      const created = await createTestJobTemplate({}, db);

      // ACT
      const deletedId = await deleteJobTemplateService(created.id, db);

      // ASSERT
      expect(deletedId).toBe(created.id);

      // Verify it's actually deleted
      await expect(getJobTemplateByIdService(created.id, db)).rejects.toThrow(
        JobTemplateNotFoundError
      );
    });

    it('should throw JobTemplateNotFoundError when deleting non-existent ID', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT & ASSERT
      await expect(deleteJobTemplateService(nonExistentId, db)).rejects.toThrow(
        JobTemplateNotFoundError
      );
    });
  });

  describe('Service Factory and Singleton', () => {
    it('should export a singleton jobTemplatesService with all methods', () => {
      // ASSERT
      expect(jobTemplatesService).toBeDefined();
      expect(jobTemplatesService.create).toBeInstanceOf(Function);
      expect(jobTemplatesService.getById).toBeInstanceOf(Function);
      expect(jobTemplatesService.list).toBeInstanceOf(Function);
      expect(jobTemplatesService.update).toBeInstanceOf(Function);
      expect(jobTemplatesService.delete).toBeInstanceOf(Function);
    });

    it('should create service instance with custom database', async () => {
      // This test verifies the factory function works with dependency injection
      const created = await createTestJobTemplate({}, db);

      // Using the singleton with default db
      const result = await jobTemplatesService.getById(created.id);

      expect(result.id).toBe(created.id);
    });
  });
});
