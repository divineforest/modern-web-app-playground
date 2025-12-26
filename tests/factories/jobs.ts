import { eq } from 'drizzle-orm';
import type { Database } from '../../src/db/index.js';
import { db, jobs, users } from '../../src/db/index.js';
import type { Job, NewJob } from '../../src/modules/practice-management/domain/job.entity.js';
import { createTestCompany } from './companies.js';
import { getFirstServiceType } from './service-types.js';
import { createTestUser } from './users.js';

/**
 * Build test job data with default values that can be overridden
 * Note: companyId and serviceTypeId are required to ensure valid foreign key references
 * Use createTestJob() if you want these IDs to be automatically fetched/created
 */
export function buildTestJobData(
  required: { companyId: string; serviceTypeId: string },
  overrides: Partial<Omit<NewJob, 'companyId' | 'serviceTypeId'>> = {}
): NewJob {
  return {
    companyId: required.companyId,
    serviceTypeId: required.serviceTypeId,
    title: overrides.title || 'Test Job',
    status: overrides.status || 'planned',
    dueAt: overrides.dueAt !== undefined ? overrides.dueAt : null,
    completedAt: overrides.completedAt !== undefined ? overrides.completedAt : null,
    assigneeId: overrides.assigneeId !== undefined ? overrides.assigneeId : null,
    periodStart: overrides.periodStart !== undefined ? overrides.periodStart : null,
    periodEnd: overrides.periodEnd !== undefined ? overrides.periodEnd : null,
    billingPeriodId: overrides.billingPeriodId !== undefined ? overrides.billingPeriodId : null,
  };
}

/**
 * Create a test job record in the database with default values that can be overridden
 * Note: If companyId or serviceTypeId are not provided, they will be fetched/created automatically
 * Note: If assigneeId is provided, a user with that ID will be created if it doesn't exist
 */
export async function createTestJob(
  overrides: Partial<NewJob> = {},
  database: Database = db
): Promise<Job> {
  // If no companyId provided, create a test company
  let companyId = overrides.companyId;
  if (!companyId) {
    const company = await createTestCompany();
    companyId = company.id;
  }

  // If no serviceTypeId provided, get the first available service type
  let serviceTypeId = overrides.serviceTypeId;
  if (!serviceTypeId) {
    const serviceType = await getFirstServiceType(database);
    serviceTypeId = serviceType.id;
  }

  // If assigneeId is provided, ensure the user exists
  if (overrides.assigneeId) {
    const existingUser = await database
      .select()
      .from(users)
      .where(eq(users.id, overrides.assigneeId))
      .limit(1);

    if (existingUser.length === 0) {
      // Create user with the specified ID
      await createTestUser(
        {
          id: overrides.assigneeId,
          firstName: 'Test',
          lastName: 'Assignee',
          email: `assignee.${overrides.assigneeId}@example.com`,
        },
        database
      );
    }
  }

  const jobData = buildTestJobData({ companyId, serviceTypeId }, overrides);
  const results = await database.insert(jobs).values(jobData).returning();

  if (!results[0]) {
    throw new Error('Failed to create test job');
  }

  // Type assertion needed: Drizzle returns status as string, but we use JobStatus enum
  return results[0] as Job;
}

/**
 * Create multiple test job records in the database
 * Note: If companyId or serviceTypeId are not provided, they will be fetched/created automatically
 * Note: If assigneeId is provided, a user with that ID will be created if it doesn't exist
 */
export async function createTestJobs(
  count: number,
  overrides: Partial<NewJob> = {},
  database: Database = db
): Promise<Job[]> {
  // If no companyId provided, create a test company to use for all jobs
  let companyId = overrides.companyId;
  if (!companyId) {
    const company = await createTestCompany();
    companyId = company.id;
  }

  // If no serviceTypeId provided, get the first available service type
  let serviceTypeId = overrides.serviceTypeId;
  if (!serviceTypeId) {
    const serviceType = await getFirstServiceType(database);
    serviceTypeId = serviceType.id;
  }

  // If assigneeId is provided, ensure the user exists
  if (overrides.assigneeId) {
    const existingUser = await database
      .select()
      .from(users)
      .where(eq(users.id, overrides.assigneeId))
      .limit(1);

    if (existingUser.length === 0) {
      // Create user with the specified ID
      await createTestUser(
        {
          id: overrides.assigneeId,
          firstName: 'Test',
          lastName: 'Assignee',
          email: `assignee.${overrides.assigneeId}@example.com`,
        },
        database
      );
    }
  }

  const result: Job[] = [];

  for (let index = 0; index < count; index++) {
    const jobData = buildTestJobData(
      { companyId, serviceTypeId },
      {
        title: `Test Job ${index + 1}`,
        ...overrides,
      }
    );
    const results = await database.insert(jobs).values(jobData).returning();

    if (!results[0]) {
      throw new Error(`Failed to create test job ${index + 1}`);
    }

    // Type assertion needed: Drizzle returns status as string, but we use JobStatus enum
    result.push(results[0] as Job);
  }

  return result;
}
