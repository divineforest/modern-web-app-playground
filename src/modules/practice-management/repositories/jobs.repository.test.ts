import { describe, expect, it } from 'vitest';
import { createTestCompany } from '../../../../tests/factories/companies.js';
import {
  buildTestJobData,
  createTestJob,
  createTestJobs,
} from '../../../../tests/factories/jobs.js';
import { getFirstServiceType } from '../../../../tests/factories/service-types.js';
import { db } from '../../../db/index.js';
import { createJob, deleteJob, findAllJobs, findJobById, updateJob } from './jobs.repository.js';

describe('Jobs Repository', () => {
  describe('createJob', () => {
    it('should create a job with all fields', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const serviceType = await getFirstServiceType(db);
      const dueDate = new Date('2024-12-31T17:00:00.000Z');

      const data = buildTestJobData(
        { companyId: company.id, serviceTypeId: serviceType.id },
        {
          title: 'Test Job with All Fields',
          status: 'planned',
          dueAt: dueDate,
          assigneeId: '00000000-0000-0000-0000-000000000002',
          periodStart: '2024-01-01',
          periodEnd: '2024-01-31',
        }
      );

      // ACT
      const job = await createJob(data, db);

      // ASSERT
      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.companyId).toBe(company.id);
      expect(job.serviceTypeId).toBe(serviceType.id);
      expect(job.title).toBe('Test Job with All Fields');
      expect(job.status).toBe('planned');
      expect(job.dueAt).toBeInstanceOf(Date);
      expect(job.assigneeId).toBe('00000000-0000-0000-0000-000000000002');
      expect(job.periodStart).toBe('2024-01-01'); // DATE type returns as string
      expect(job.periodEnd).toBe('2024-01-31'); // DATE type returns as string
      expect(job.completedAt).toBeNull();
      expect(job.createdAt).toBeInstanceOf(Date);
      expect(job.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a job with nullable fields', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const serviceType = await getFirstServiceType(db);
      const data = buildTestJobData(
        { companyId: company.id, serviceTypeId: serviceType.id },
        {
          title: 'Test Job with Nullable Fields',
          dueAt: null,
          completedAt: null,
          assigneeId: null,
          periodStart: null,
          periodEnd: null,
        }
      );

      // ACT
      const job = await createJob(data, db);

      // ASSERT
      expect(job).toBeDefined();
      expect(job.dueAt).toBeNull();
      expect(job.completedAt).toBeNull();
      expect(job.assigneeId).toBeNull();
      expect(job.periodStart).toBeNull();
      expect(job.periodEnd).toBeNull();
    });

    it('should use default status "planned" when not provided', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const serviceType = await getFirstServiceType(db);
      const data = buildTestJobData(
        { companyId: company.id, serviceTypeId: serviceType.id },
        {
          title: 'Test Job Default Status',
        }
      );

      // ACT
      const job = await createJob(data, db);

      // ASSERT
      expect(job.status).toBe('planned');
    });

    it('should enforce foreign key constraint on companyId', async () => {
      // ARRANGE
      const serviceType = await getFirstServiceType(db);
      const data = buildTestJobData(
        {
          companyId: '00000000-0000-0000-0000-999999999999', // non-existent company
          serviceTypeId: serviceType.id,
        },
        {
          title: 'Test Job Invalid Company',
        }
      );

      // ACT & ASSERT
      await expect(createJob(data, db)).rejects.toThrow();
    });

    it('should enforce status check constraint', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const serviceType = await getFirstServiceType(db);
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid status value that bypasses TypeScript
      const data: any = buildTestJobData(
        { companyId: company.id, serviceTypeId: serviceType.id },
        {
          title: 'Test Job Invalid Status',
        }
      );
      // Manually override status with invalid value to bypass TypeScript
      data.status = 'invalid_status';

      // ACT & ASSERT
      await expect(createJob(data, db)).rejects.toThrow();
    });
  });

  describe('findJobById', () => {
    it('should find a job by ID', async () => {
      // ARRANGE
      const created = await createTestJob({}, db);

      // ACT
      const found = await findJobById(created.id, db);

      // ASSERT
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.title).toBe(created.title);
      expect(found?.companyId).toBe(created.companyId);
    });

    it('should return null for non-existent ID', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT
      const found = await findJobById(nonExistentId, db);

      // ASSERT
      expect(found).toBeNull();
    });
  });

  describe('findAllJobs', () => {
    it('should find all jobs', async () => {
      // ARRANGE
      const company = await createTestCompany();
      await createTestJobs(3, { companyId: company.id }, db);

      // ACT
      const allJobs = await findAllJobs(undefined, db);

      // ASSERT
      expect(allJobs.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter by companyId', async () => {
      // ARRANGE
      const company1 = await createTestCompany();
      const company2 = await createTestCompany();
      const job1 = await createTestJob({ companyId: company1.id }, db);
      const job2 = await createTestJob({ companyId: company2.id }, db);

      // ACT
      const company1Jobs = await findAllJobs({ companyId: company1.id }, db);
      const company2Jobs = await findAllJobs({ companyId: company2.id }, db);

      // ASSERT
      expect(company1Jobs.some((j) => j.id === job1.id)).toBe(true);
      expect(company1Jobs.some((j) => j.id === job2.id)).toBe(false);

      expect(company2Jobs.some((j) => j.id === job2.id)).toBe(true);
      expect(company2Jobs.some((j) => j.id === job1.id)).toBe(false);
    });

    it('should filter by status', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const plannedJob = await createTestJob({ companyId: company.id, status: 'planned' }, db);
      const completedJob = await createTestJob({ companyId: company.id, status: 'completed' }, db);

      // ACT
      const plannedJobs = await findAllJobs({ status: 'planned' }, db);
      const completedJobs = await findAllJobs({ status: 'completed' }, db);

      // ASSERT
      expect(plannedJobs.some((j) => j.id === plannedJob.id)).toBe(true);
      expect(plannedJobs.some((j) => j.id === completedJob.id)).toBe(false);

      expect(completedJobs.some((j) => j.id === completedJob.id)).toBe(true);
      expect(completedJobs.some((j) => j.id === plannedJob.id)).toBe(false);
    });

    it('should filter by assigneeId', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const assignee1 = '00000000-0000-0000-0000-000000000001';
      const assignee2 = '00000000-0000-0000-0000-000000000002';

      const job1 = await createTestJob({ companyId: company.id, assigneeId: assignee1 }, db);
      const job2 = await createTestJob({ companyId: company.id, assigneeId: assignee2 }, db);
      const job3 = await createTestJob({ companyId: company.id, assigneeId: null }, db);

      // ACT
      const assignee1Jobs = await findAllJobs({ assigneeId: assignee1 }, db);
      const assignee2Jobs = await findAllJobs({ assigneeId: assignee2 }, db);

      // ASSERT
      expect(assignee1Jobs.some((j) => j.id === job1.id)).toBe(true);
      expect(assignee1Jobs.some((j) => j.id === job2.id)).toBe(false);
      expect(assignee1Jobs.some((j) => j.id === job3.id)).toBe(false);

      expect(assignee2Jobs.some((j) => j.id === job2.id)).toBe(true);
      expect(assignee2Jobs.some((j) => j.id === job1.id)).toBe(false);
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
      const jobsAfter = await findAllJobs({ dueAfter: filterDate }, db);

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
      const jobsBefore = await findAllJobs({ dueBefore: filterDate }, db);

      // ASSERT
      expect(jobsBefore.some((j) => j.id === job1.id)).toBe(true);
      expect(jobsBefore.some((j) => j.id === job2.id)).toBe(false);
    });

    it('should filter by multiple criteria', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const dueDate = new Date('2024-06-15');
      const assigneeId = '00000000-0000-0000-0000-000000000001';

      const matchingJob = await createTestJob(
        {
          companyId: company.id,
          status: 'in_progress',
          assigneeId,
          dueAt: dueDate,
        },
        db
      );

      const nonMatchingJob = await createTestJob(
        {
          companyId: company.id,
          status: 'planned',
          assigneeId,
          dueAt: dueDate,
        },
        db
      );

      // ACT
      const filteredJobs = await findAllJobs(
        {
          companyId: company.id,
          status: 'in_progress',
          assigneeId,
        },
        db
      );

      // ASSERT
      expect(filteredJobs.some((j) => j.id === matchingJob.id)).toBe(true);
      expect(filteredJobs.some((j) => j.id === nonMatchingJob.id)).toBe(false);
    });

    it('should order by createdAt descending (newest first)', async () => {
      // ARRANGE
      const company = await createTestCompany();

      const job1 = await createTestJob({ companyId: company.id, title: 'First Job' }, db);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const job2 = await createTestJob({ companyId: company.id, title: 'Second Job' }, db);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const job3 = await createTestJob({ companyId: company.id, title: 'Third Job' }, db);

      // ACT
      const jobs = await findAllJobs({ companyId: company.id }, db);

      // ASSERT
      const relevantJobs = jobs.filter(
        (j) => j.id === job1.id || j.id === job2.id || j.id === job3.id
      );

      expect(relevantJobs[0]?.id).toBe(job3.id);
      expect(relevantJobs[1]?.id).toBe(job2.id);
      expect(relevantJobs[2]?.id).toBe(job1.id);
    });
  });

  describe('updateJob', () => {
    it('should update a job and updatedAt timestamp', async () => {
      // ARRANGE
      const job = await createTestJob({}, db);
      const originalUpdatedAt = job.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      // ACT
      const updated = await updateJob(
        job.id,
        { title: 'Updated Title', status: 'in_progress' },
        db
      );

      // ASSERT
      expect(updated).toBeDefined();
      expect(updated?.title).toBe('Updated Title');
      expect(updated?.status).toBe('in_progress');
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    it('should allow partial updates', async () => {
      // ARRANGE
      const job = await createTestJob({ title: 'Original Title', status: 'planned' }, db);

      // ACT
      const updated = await updateJob(job.id, { status: 'in_progress' }, db);

      // ASSERT
      expect(updated).toBeDefined();
      expect(updated?.title).toBe('Original Title'); // unchanged
      expect(updated?.status).toBe('in_progress'); // updated
    });

    it('should return null for non-existent ID', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT
      const updated = await updateJob(nonExistentId, { title: 'Updated' }, db);

      // ASSERT
      expect(updated).toBeNull();
    });

    it('should enforce status check constraint on update', async () => {
      // ARRANGE
      const job = await createTestJob({}, db);

      // ACT & ASSERT
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid status value
      await expect(updateJob(job.id, { status: 'invalid_status' as any }, db)).rejects.toThrow();
    });
  });

  describe('deleteJob', () => {
    it('should delete a job', async () => {
      // ARRANGE
      const job = await createTestJob({}, db);

      // ACT
      const deleted = await deleteJob(job.id, db);

      // ASSERT
      expect(deleted).toBe(true);

      const found = await findJobById(job.id, db);
      expect(found).toBeNull();
    });

    it('should return false for non-existent ID', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT
      const deleted = await deleteJob(nonExistentId, db);

      // ASSERT
      expect(deleted).toBe(false);
    });
  });

  describe('cascade delete on company deletion', () => {
    it('should delete jobs when company is deleted', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const job = await createTestJob({ companyId: company.id }, db);

      // ACT
      // Delete the company
      const { companies } = await import('../../../db/schema-core.js');
      const { eq } = await import('drizzle-orm');
      await db.delete(companies).where(eq(companies.id, company.id));

      // ASSERT
      // Job should be deleted due to CASCADE
      const found = await findJobById(job.id, db);
      expect(found).toBeNull();
    });
  });
});
