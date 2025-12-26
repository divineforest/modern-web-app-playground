import { describe, expect, it } from 'vitest';
import { createTestCompany } from '../../../../tests/factories/companies.js';
import { createTestJob } from '../../../../tests/factories/jobs.js';
import { getFirstServiceType } from '../../../../tests/factories/service-types.js';
import { db } from '../../../db/index.js';
import {
  createJobService,
  deleteJobService,
  getJobByIdService,
  JobNotFoundError,
  JobValidationError,
  listJobsService,
  updateJobService,
} from './jobs.service.js';

describe('Jobs Service', () => {
  describe('createJobService', () => {
    it('should create a job with valid data', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const serviceType = await getFirstServiceType(db);
      const input = {
        companyId: company.id,
        serviceTypeId: serviceType.id,
        title: 'Service Test Job',
        status: 'planned' as const,
        dueAt: new Date('2024-12-31'),
        assigneeId: '00000000-0000-0000-0000-000000000002',
        periodStart: '2024-01-01',
        periodEnd: '2024-01-31',
      };

      // ACT
      const job = await createJobService(input, db);

      // ASSERT
      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.companyId).toBe(input.companyId);
      expect(job.title).toBe(input.title);
      expect(job.status).toBe(input.status);
    });

    it('should validate required fields', async () => {
      // ARRANGE
      const input = {
        companyId: '00000000-0000-0000-0000-000000000001',
        serviceTypeId: '00000000-0000-0000-0000-000000000002',
        title: '', // Empty title should fail validation
        status: 'planned' as const,
      };

      // ACT & ASSERT
      await expect(createJobService(input, db)).rejects.toThrow(JobValidationError);
    });

    it('should validate period dates (periodStart <= periodEnd)', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const serviceType = await getFirstServiceType(db);
      const input = {
        companyId: company.id,
        serviceTypeId: serviceType.id,
        title: 'Invalid Period Job',
        status: 'planned' as const,
        periodStart: '2024-02-01',
        periodEnd: '2024-01-01', // End before start - invalid!
      };

      // ACT & ASSERT
      await expect(createJobService(input, db)).rejects.toThrow(JobValidationError);
      await expect(createJobService(input, db)).rejects.toThrow(
        /period start date must be before/i
      );
    });

    it('should accept valid period dates', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const serviceType = await getFirstServiceType(db);
      const input = {
        companyId: company.id,
        serviceTypeId: serviceType.id,
        title: 'Valid Period Job',
        status: 'planned' as const,
        periodStart: '2024-01-01',
        periodEnd: '2024-01-31',
      };

      // ACT
      const job = await createJobService(input, db);

      // ASSERT
      expect(job.periodStart).toBe('2024-01-01'); // DATE type returns as string
      expect(job.periodEnd).toBe('2024-01-31'); // DATE type returns as string
    });

    it('should handle foreign key constraint violation for companyId', async () => {
      // ARRANGE
      const serviceType = await getFirstServiceType(db);
      const input = {
        companyId: '00000000-0000-0000-0000-999999999999', // Non-existent company
        serviceTypeId: serviceType.id,
        title: 'Test Job',
        status: 'planned' as const,
      };

      // ACT & ASSERT
      await expect(createJobService(input, db)).rejects.toThrow();
    });

    it('should use default status "planned" when not provided', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const serviceType = await getFirstServiceType(db);
      const input = {
        companyId: company.id,
        serviceTypeId: serviceType.id,
        title: 'Default Status Job',
      };

      // ACT
      // biome-ignore lint/suspicious/noExplicitAny: Testing default status behavior
      const job = await createJobService(input as any, db);

      // ASSERT
      expect(job.status).toBe('planned');
    });
  });

  describe('getJobByIdService', () => {
    it('should get a job by ID', async () => {
      // ARRANGE
      const created = await createTestJob({}, db);

      // ACT
      const job = await getJobByIdService(created.id, db);

      // ASSERT
      expect(job).toBeDefined();
      expect(job.id).toBe(created.id);
      expect(job.title).toBe(created.title);
    });

    it('should throw JobNotFoundError for non-existent ID', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT & ASSERT
      await expect(getJobByIdService(nonExistentId, db)).rejects.toThrow(JobNotFoundError);
    });
  });

  describe('listJobsService', () => {
    it('should list all jobs', async () => {
      // ARRANGE
      const company = await createTestCompany();
      await createTestJob({ companyId: company.id }, db);
      await createTestJob({ companyId: company.id }, db);

      // ACT
      const jobs = await listJobsService({}, db);

      // ASSERT
      expect(jobs).toBeDefined();
      expect(Array.isArray(jobs)).toBe(true);
      expect(jobs.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by companyId', async () => {
      // ARRANGE
      const company1 = await createTestCompany();
      const company2 = await createTestCompany();
      const job1 = await createTestJob({ companyId: company1.id }, db);
      const job2 = await createTestJob({ companyId: company2.id }, db);

      // ACT
      const company1Jobs = await listJobsService({ companyId: company1.id }, db);

      // ASSERT
      expect(company1Jobs.some((j) => j.id === job1.id)).toBe(true);
      expect(company1Jobs.some((j) => j.id === job2.id)).toBe(false);
    });

    it('should filter by status', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const plannedJob = await createTestJob({ companyId: company.id, status: 'planned' }, db);
      const completedJob = await createTestJob({ companyId: company.id, status: 'completed' }, db);

      // ACT
      const plannedJobs = await listJobsService({ status: 'planned' }, db);

      // ASSERT
      expect(plannedJobs.some((j) => j.id === plannedJob.id)).toBe(true);
      expect(plannedJobs.some((j) => j.id === completedJob.id)).toBe(false);
    });

    it('should filter by assigneeId', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const assignee1 = '00000000-0000-0000-0000-000000000001';
      const assignee2 = '00000000-0000-0000-0000-000000000002';

      const job1 = await createTestJob({ companyId: company.id, assigneeId: assignee1 }, db);
      const job2 = await createTestJob({ companyId: company.id, assigneeId: assignee2 }, db);

      // ACT
      const assignee1Jobs = await listJobsService({ assigneeId: assignee1 }, db);

      // ASSERT
      expect(assignee1Jobs.some((j) => j.id === job1.id)).toBe(true);
      expect(assignee1Jobs.some((j) => j.id === job2.id)).toBe(false);
    });

    it('should filter by dueAfter', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-02-15');
      const filterDate = new Date('2024-01-31');

      const job1 = await createTestJob({ companyId: company.id, dueAt: date1 }, db);
      const job2 = await createTestJob({ companyId: company.id, dueAt: date2 }, db);

      // ACT
      const jobsAfter = await listJobsService({ dueAfter: filterDate }, db);

      // ASSERT
      expect(jobsAfter.some((j) => j.id === job2.id)).toBe(true);
      expect(jobsAfter.some((j) => j.id === job1.id)).toBe(false);
    });

    it('should filter by dueBefore', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-02-15');
      const filterDate = new Date('2024-01-31');

      const job1 = await createTestJob({ companyId: company.id, dueAt: date1 }, db);
      const job2 = await createTestJob({ companyId: company.id, dueAt: date2 }, db);

      // ACT
      const jobsBefore = await listJobsService({ dueBefore: filterDate }, db);

      // ASSERT
      expect(jobsBefore.some((j) => j.id === job1.id)).toBe(true);
      expect(jobsBefore.some((j) => j.id === job2.id)).toBe(false);
    });
  });

  describe('updateJobService', () => {
    it('should update a job', async () => {
      // ARRANGE
      const created = await createTestJob(
        {
          title: 'Original Title',
          status: 'planned',
        },
        db
      );

      // ACT
      const updated = await updateJobService(
        created.id,
        {
          title: 'Updated Title',
          status: 'in_progress',
        },
        db
      );

      // ASSERT
      expect(updated).toBeDefined();
      expect(updated.id).toBe(created.id);
      expect(updated.title).toBe('Updated Title');
      expect(updated.status).toBe('in_progress');
    });

    it('should automatically set completedAt when status changes to completed', async () => {
      // ARRANGE
      const created = await createTestJob({ status: 'planned' }, db);
      expect(created.completedAt).toBeNull();

      // ACT
      const updated = await updateJobService(created.id, { status: 'completed' }, db);

      // ASSERT
      expect(updated.status).toBe('completed');
      expect(updated.completedAt).toBeInstanceOf(Date);
      expect(updated.completedAt).not.toBeNull();
    });

    it('should not change completedAt if already completed', async () => {
      // ARRANGE
      const completedAt = new Date('2024-01-15');
      const created = await createTestJob(
        {
          status: 'completed',
          completedAt,
        },
        db
      );

      // ACT
      const updated = await updateJobService(created.id, { title: 'Updated Title' }, db);

      // ASSERT
      // Should keep the original completedAt
      expect(updated.completedAt).toBeInstanceOf(Date);
    });

    it('should respect user-provided completedAt when transitioning to completed', async () => {
      // ARRANGE
      const created = await createTestJob({ status: 'planned' }, db);
      const userProvidedDate = new Date('2024-01-15T10:30:00.000Z');

      // ACT
      const updated = await updateJobService(
        created.id,
        { status: 'completed', completedAt: userProvidedDate },
        db
      );

      // ASSERT
      expect(updated.status).toBe('completed');
      expect(updated.completedAt).toBeInstanceOf(Date);
      expect(updated.completedAt?.toISOString()).toBe(userProvidedDate.toISOString());
    });

    it('should validate period dates on update', async () => {
      // ARRANGE
      const created = await createTestJob(
        {
          periodStart: '2024-01-01',
          periodEnd: '2024-01-31',
        },
        db
      );

      // ACT & ASSERT
      // Try to update periodEnd to be before periodStart
      await expect(updateJobService(created.id, { periodEnd: '2023-12-01' }, db)).rejects.toThrow(
        JobValidationError
      );
      await expect(updateJobService(created.id, { periodEnd: '2023-12-01' }, db)).rejects.toThrow(
        /period start date must be before/i
      );
    });

    it('should throw JobNotFoundError for non-existent ID', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT & ASSERT
      await expect(updateJobService(nonExistentId, { title: 'Updated' }, db)).rejects.toThrow(
        JobNotFoundError
      );
    });

    it('should validate update data', async () => {
      // ARRANGE
      const created = await createTestJob({}, db);

      // ACT & ASSERT
      await expect(
        // biome-ignore lint/suspicious/noExplicitAny: Testing invalid status value
        updateJobService(created.id, { status: 'invalid_status' as any }, db)
      ).rejects.toThrow();
    });

    it('should not allow updating companyId or serviceTypeId', async () => {
      // ARRANGE
      const company1 = await createTestCompany();
      const company2 = await createTestCompany();
      const serviceType1 = await getFirstServiceType(db);
      const created = await createTestJob({ companyId: company1.id }, db);

      // ACT
      // TypeScript should prevent these, but verify at runtime that they're ignored
      const updated = await updateJobService(
        created.id,
        // biome-ignore lint/suspicious/noExplicitAny: Testing immutable fields
        { companyId: company2.id, serviceTypeId: serviceType1.id } as any,
        db
      );

      // ASSERT
      // Original values should be preserved
      expect(updated.companyId).toBe(company1.id);
      expect(updated.serviceTypeId).toBe(created.serviceTypeId);
    });

    it('should clear completedAt when status changes from completed to another status', async () => {
      // ARRANGE
      const completedAt = new Date('2024-01-15');
      const created = await createTestJob(
        {
          status: 'completed',
          completedAt,
        },
        db
      );
      expect(created.completedAt).toBeInstanceOf(Date);

      // ACT
      const updated = await updateJobService(created.id, { status: 'in_progress' }, db);

      // ASSERT
      expect(updated.status).toBe('in_progress');
      expect(updated.completedAt).toBeNull();
    });

    it('should clear completedAt when status changes from completed to planned', async () => {
      // ARRANGE
      const completedAt = new Date('2024-01-15');
      const created = await createTestJob(
        {
          status: 'completed',
          completedAt,
        },
        db
      );
      expect(created.completedAt).toBeInstanceOf(Date);

      // ACT
      const updated = await updateJobService(created.id, { status: 'planned' }, db);

      // ASSERT
      expect(updated.status).toBe('planned');
      expect(updated.completedAt).toBeNull();
    });

    it('should respect user-provided completedAt when changing from completed to another status', async () => {
      // ARRANGE
      const originalCompletedAt = new Date('2024-01-15');
      const created = await createTestJob(
        {
          status: 'completed',
          completedAt: originalCompletedAt,
        },
        db
      );
      const userProvidedDate = new Date('2024-01-20T10:30:00.000Z');

      // ACT
      const updated = await updateJobService(
        created.id,
        { status: 'in_progress', completedAt: userProvidedDate },
        db
      );

      // ASSERT
      expect(updated.status).toBe('in_progress');
      expect(updated.completedAt).toBeInstanceOf(Date);
      expect(updated.completedAt?.toISOString()).toBe(userProvidedDate.toISOString());
    });

    it('should respect user-provided null completedAt when changing from completed to another status', async () => {
      // ARRANGE
      const originalCompletedAt = new Date('2024-01-15');
      const created = await createTestJob(
        {
          status: 'completed',
          completedAt: originalCompletedAt,
        },
        db
      );

      // ACT
      const updated = await updateJobService(
        created.id,
        { status: 'in_progress', completedAt: null },
        db
      );

      // ASSERT
      expect(updated.status).toBe('in_progress');
      expect(updated.completedAt).toBeNull();
    });
  });

  describe('deleteJobService', () => {
    it('should delete a job', async () => {
      // ARRANGE
      const created = await createTestJob({}, db);

      // ACT
      const deletedId = await deleteJobService(created.id, db);

      // ASSERT
      expect(deletedId).toBe(created.id);

      // Verify it's deleted
      await expect(getJobByIdService(created.id, db)).rejects.toThrow(JobNotFoundError);
    });

    it('should throw JobNotFoundError for non-existent ID', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT & ASSERT
      await expect(deleteJobService(nonExistentId, db)).rejects.toThrow(JobNotFoundError);
    });
  });
});
