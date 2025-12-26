import { and, desc, eq, gte, lte, type SQL } from 'drizzle-orm';
import type { Database } from '../../../db/connection.js';
import { db } from '../../../db/connection.js';
import { companies, users } from '../../../db/schema-core.js';
import { jobs } from '../../../db/schema-local.js';
import type { Job, JobWithDetails, NewJob, UpdateJob } from '../domain/job.entity.js';

/**
 * Filter options for listing jobs
 */
export interface JobFilters {
  companyId?: string;
  status?: string;
  assigneeId?: string;
  dueBefore?: Date;
  dueAfter?: Date;
}

/**
 * Create a new job
 * @param data Job data to insert
 * @param database Database instance (for dependency injection)
 * @returns Created job
 */
export async function createJob(data: NewJob, database: Database = db): Promise<Job> {
  const results = await database.insert(jobs).values(data).returning();

  if (!results[0]) {
    throw new Error('Failed to create job');
  }

  // Type assertion needed: Drizzle returns status as string, but we use JobStatus enum
  return results[0] as Job;
}

/**
 * Find a job by ID
 * @param id Job ID
 * @param database Database instance (for dependency injection)
 * @returns Job or null if not found
 */
export async function findJobById(id: string, database: Database = db): Promise<Job | null> {
  const results = await database.select().from(jobs).where(eq(jobs.id, id));

  // Type assertion needed: Drizzle returns status as string, but we use JobStatus enum
  return (results[0] as Job | undefined) || null;
}

/**
 * Find all jobs with optional filtering
 * @param filters Optional filters (companyId, status, assigneeId, dueBefore, dueAfter)
 * @param database Database instance (for dependency injection)
 * @returns Array of jobs
 */
/**
 * Builds SQL filter conditions from job filters
 * @param filters Optional job filters to apply
 * @returns Array of SQL conditions
 */
function buildJobFilterConditions(filters?: JobFilters): SQL[] {
  const conditions: SQL[] = [];

  // Apply filters if provided
  if (filters?.companyId) {
    conditions.push(eq(jobs.companyId, filters.companyId));
  }
  if (filters?.status) {
    conditions.push(eq(jobs.status, filters.status));
  }
  if (filters?.assigneeId) {
    conditions.push(eq(jobs.assigneeId, filters.assigneeId));
  }
  if (filters?.dueBefore) {
    conditions.push(lte(jobs.dueAt, filters.dueBefore));
  }
  if (filters?.dueAfter) {
    conditions.push(gte(jobs.dueAt, filters.dueAfter));
  }

  return conditions;
}

export async function findAllJobs(filters?: JobFilters, database: Database = db): Promise<Job[]> {
  const conditions = buildJobFilterConditions(filters);

  // Build query with conditions
  const baseQuery = database.select().from(jobs);
  const query = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

  // Order by creation date (newest first)
  const results = await query.orderBy(desc(jobs.createdAt));

  // Type assertion needed: Drizzle returns status as string, but we use JobStatus enum
  return results as Job[];
}

/**
 * Find all jobs with related company and assignee data
 * @param filters Optional filters (companyId, status, assigneeId, dueBefore, dueAfter)
 * @param database Database instance (for dependency injection)
 * @returns Array of jobs with company name and assignee details
 */
export async function findAllJobsWithDetails(
  filters?: JobFilters,
  database: Database = db
): Promise<JobWithDetails[]> {
  const conditions = buildJobFilterConditions(filters);

  // Build query with conditions and joins
  const baseQuery = database
    .select({
      job: jobs,
      companyName: companies.name,
      assigneeFirstName: users.firstName,
      assigneeLastName: users.lastName,
      assigneeEmail: users.email,
    })
    .from(jobs)
    .leftJoin(companies, eq(jobs.companyId, companies.id))
    .leftJoin(users, eq(jobs.assigneeId, users.id));

  const query = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

  // Order by creation date (newest first)
  const results = await query.orderBy(desc(jobs.createdAt));

  // Map results to include both job data and related data
  return results.map(({ job, companyName, assigneeFirstName, assigneeLastName, assigneeEmail }) => {
    const assigneeName =
      assigneeFirstName || assigneeLastName
        ? `${assigneeFirstName || ''} ${assigneeLastName || ''}`.trim()
        : null;

    return {
      ...(job as Job),
      companyName,
      assigneeName,
      assigneeEmail,
    };
  });
}

/**
 * Update a job by ID
 * @param id Job ID
 * @param data Partial job data to update
 * @param database Database instance (for dependency injection)
 * @returns Updated job or null if not found
 */
export async function updateJob(
  id: string,
  data: UpdateJob,
  database: Database = db
): Promise<Job | null> {
  // Update the updatedAt timestamp
  const updateData = {
    ...data,
    updatedAt: new Date(),
  };

  const results = await database.update(jobs).set(updateData).where(eq(jobs.id, id)).returning();

  // Type assertion needed: Drizzle returns status as string, but we use JobStatus enum
  return (results[0] as Job | undefined) || null;
}

/**
 * Delete a job by ID (hard delete)
 * @param id Job ID
 * @param database Database instance (for dependency injection)
 * @returns true if deleted, false if not found
 */
export async function deleteJob(id: string, database: Database = db): Promise<boolean> {
  const result = await database.delete(jobs).where(eq(jobs.id, id)).returning();

  return result.length > 0;
}
