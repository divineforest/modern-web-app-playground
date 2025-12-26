import type { Database } from '../../../db/connection.js';
import { db } from '../../../db/connection.js';
import {
  transformDatabaseError,
  ValidationError,
  type ValidationErrorDetails,
} from '../../../lib/error-transformers.js';
import { logger } from '../../../lib/logger.js';
import type { Job, JobWithDetails, UpdateJob } from '../domain/job.entity.js';
import type { CreateJobInput, ListJobsQuery, UpdateJobInput } from '../domain/job.types.js';
import { createJobSchema, updateJobSchema } from '../domain/job.types.js';
import {
  createJob,
  deleteJob,
  findAllJobsWithDetails,
  findJobById,
  updateJob,
} from '../repositories/jobs.repository.js';

/**
 * Custom error for job not found
 */
export class JobNotFoundError extends Error {
  constructor(id: string) {
    super(`Job with ID ${id} not found`);
    this.name = 'JobNotFoundError';
  }
}

/**
 * Custom error for validation failures
 */
export class JobValidationError extends ValidationError {
  constructor(message: string, details?: ValidationErrorDetails) {
    super(message, details);
    this.name = 'JobValidationError';
  }
}

/**
 * Validate period dates
 * @throws JobValidationError if periodStart > periodEnd
 */
function validatePeriodDates(
  periodStart: string | null | undefined,
  periodEnd: string | null | undefined
): void {
  if (periodStart && periodEnd) {
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    if (startDate > endDate) {
      throw new JobValidationError('Period start date must be before or equal to period end date');
    }
  }
}

/**
 * Create a new job with validation
 * @param input Job input data
 * @param database Database instance (for dependency injection)
 * @returns Created job
 * @throws JobValidationError if validation fails
 */
export async function createJobService(
  input: CreateJobInput,
  database: Database = db
): Promise<Job> {
  try {
    // Validate input
    const validatedData: CreateJobInput = createJobSchema.parse(input);

    // Validate period dates
    validatePeriodDates(validatedData.periodStart, validatedData.periodEnd);

    // Create the job - CreateJobInput is compatible with NewJob
    const job = await createJob(validatedData, database);

    logger.info({ jobId: job.id }, 'Job created successfully');

    return job;
  } catch (error) {
    // Re-throw existing validation errors
    if (error instanceof JobValidationError) {
      throw error;
    }

    // Handle Zod validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      logger.warn({ error, input }, 'Job validation failed');
      throw new JobValidationError('Validation failed', { zodError: error.message });
    }

    // Transform database errors to validation errors
    const dbError = transformDatabaseError(error);
    if (dbError) {
      logger.warn({ error, input }, 'Database constraint violation');
      throw new JobValidationError(dbError.message, dbError.details);
    }

    // Log and re-throw unexpected errors
    logger.error({ error, input }, 'Failed to create job');
    throw error;
  }
}

/**
 * Get a job by ID
 * @param id Job ID
 * @param database Database instance (for dependency injection)
 * @returns Job
 * @throws JobNotFoundError if not found
 */
export async function getJobByIdService(id: string, database: Database = db): Promise<Job> {
  const job = await findJobById(id, database);

  if (!job) {
    logger.warn({ jobId: id }, 'Job not found');
    throw new JobNotFoundError(id);
  }

  return job;
}

/**
 * List all jobs with optional filtering
 * @param query Query parameters for filtering
 * @param database Database instance (for dependency injection)
 * @returns Array of jobs
 */
export async function listJobsService(
  query: ListJobsQuery = {},
  database: Database = db
): Promise<JobWithDetails[]> {
  const filters: {
    companyId?: string;
    status?: string;
    assigneeId?: string;
    dueBefore?: Date;
    dueAfter?: Date;
  } = {};

  if (query.companyId) filters.companyId = query.companyId;
  if (query.status) filters.status = query.status;
  if (query.assigneeId) filters.assigneeId = query.assigneeId;
  if (query.dueBefore) filters.dueBefore = query.dueBefore;
  if (query.dueAfter) filters.dueAfter = query.dueAfter;

  const jobs = await findAllJobsWithDetails(filters, database);

  logger.info({ count: jobs.length, filters }, 'Listed jobs');

  return jobs;
}

/**
 * Update a job by ID
 * @param id Job ID
 * @param input Partial job data to update
 * @param database Database instance (for dependency injection)
 * @returns Updated job
 * @throws JobNotFoundError if not found
 * @throws JobValidationError if validation fails
 */
export async function updateJobService(
  id: string,
  input: UpdateJobInput,
  database: Database = db
): Promise<Job> {
  try {
    // Validate input
    const validatedData: UpdateJobInput = updateJobSchema.parse(input);

    // Get the current job to check status changes
    const currentJob = await findJobById(id, database);
    if (!currentJob) {
      logger.warn({ jobId: id }, 'Job not found for update');
      throw new JobNotFoundError(id);
    }

    // Validate period dates (combine current and updated values)
    const periodStart =
      validatedData.periodStart !== undefined ? validatedData.periodStart : currentJob.periodStart;
    const periodEnd =
      validatedData.periodEnd !== undefined ? validatedData.periodEnd : currentJob.periodEnd;
    validatePeriodDates(periodStart, periodEnd);

    // Automatically set completedAt when status changes to 'completed'
    const updateData: Record<string, unknown> = { ...validatedData };
    if (validatedData.status === 'completed' && currentJob.status !== 'completed') {
      // Only auto-set completedAt if user didn't provide one
      if (validatedData.completedAt === undefined) {
        updateData['completedAt'] = new Date();
        logger.info({ jobId: id }, 'Auto-setting completedAt timestamp');
      } else {
        logger.info({ jobId: id }, 'Using user-provided completedAt timestamp');
      }
    }

    if (
      validatedData.status &&
      validatedData.status !== 'completed' &&
      currentJob.status === 'completed'
    ) {
      // If status is changed from completed to something else, clear completedAt
      if (validatedData.completedAt === undefined) {
        updateData['completedAt'] = null;
        logger.info({ jobId: id }, 'Clearing completedAt timestamp');
      }
    }

    // Update the job
    const job = await updateJob(id, updateData as UpdateJob, database);

    if (!job) {
      logger.warn({ jobId: id }, 'Job not found for update');
      throw new JobNotFoundError(id);
    }

    logger.info({ jobId: id }, 'Job updated successfully');

    return job;
  } catch (error) {
    // Re-throw existing domain errors
    if (error instanceof JobNotFoundError || error instanceof JobValidationError) {
      throw error;
    }

    // Handle Zod validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      logger.warn({ error, id, input }, 'Job update validation failed');
      throw new JobValidationError('Validation failed', { zodError: error.message });
    }

    // Transform database errors to validation errors
    const dbError = transformDatabaseError(error);
    if (dbError) {
      logger.warn({ error, id, input }, 'Database constraint violation');
      throw new JobValidationError(dbError.message, dbError.details);
    }

    // Log and re-throw unexpected errors
    logger.error({ error, id, input }, 'Failed to update job');
    throw error;
  }
}

/**
 * Delete a job by ID
 * @param id Job ID
 * @param database Database instance (for dependency injection)
 * @returns Deleted job ID
 * @throws JobNotFoundError if not found
 */
export async function deleteJobService(id: string, database: Database = db): Promise<string> {
  const deleted = await deleteJob(id, database);

  if (!deleted) {
    logger.warn({ jobId: id }, 'Job not found for deletion');
    throw new JobNotFoundError(id);
  }

  logger.info({ jobId: id }, 'Job deleted successfully');

  return id;
}

/**
 * Jobs service factory function for dependency injection
 * Returns an object with all job operations bound to a specific database
 */
function createJobsService(database: Database = db) {
  return {
    create: (input: CreateJobInput) => createJobService(input, database),
    getById: (id: string) => getJobByIdService(id, database),
    list: (query?: ListJobsQuery) => listJobsService(query, database),
    update: (id: string, input: UpdateJobInput) => updateJobService(id, input, database),
    delete: (id: string) => deleteJobService(id, database),
  };
}

// Export a default service instance using the default database
export const jobsService = createJobsService();
