import type { Database } from '../../../db/connection.js';
import { db } from '../../../db/connection.js';
import {
  transformDatabaseError,
  type ValidationErrorDetails,
} from '../../../lib/error-transformers.js';
import { logger } from '../../../lib/logger.js';
import type { JobTemplate, UpdateJobTemplate } from '../domain/job-template.entity.js';
import type {
  CreateJobTemplateInput,
  ListJobTemplatesQuery,
  UpdateJobTemplateInput,
} from '../domain/job-template.types.js';
import { createJobTemplateSchema, updateJobTemplateSchema } from '../domain/job-template.types.js';
import {
  createJobTemplate,
  deleteJobTemplate,
  findAllJobTemplates,
  findJobTemplateById,
  updateJobTemplate,
} from '../repositories/job-templates.repository.js';

/**
 * Custom error for job template not found
 */
export class JobTemplateNotFoundError extends Error {
  constructor(id: string) {
    super(`Job template with ID ${id} not found`);
    this.name = 'JobTemplateNotFoundError';
  }
}

/**
 * Custom error for validation failures
 */
export class JobTemplateValidationError extends Error {
  constructor(
    message: string,
    public details?: ValidationErrorDetails
  ) {
    super(message);
    this.name = 'JobTemplateValidationError';
  }
}

/**
 * Create a new job template with validation
 * @param input Job template input data
 * @param database Database instance (for dependency injection)
 * @returns Created job template
 * @throws JobTemplateValidationError if validation fails
 */
export async function createJobTemplateService(
  input: CreateJobTemplateInput,
  database: Database = db
): Promise<JobTemplate> {
  try {
    // Validate input
    const validatedData: CreateJobTemplateInput = createJobTemplateSchema.parse(input);

    // Create the job template - CreateJobTemplateInput is compatible with NewJobTemplate
    const jobTemplate = await createJobTemplate(validatedData, database);

    logger.info({ jobTemplateId: jobTemplate.id }, 'Job template created successfully');

    return jobTemplate;
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      logger.warn({ error, input }, 'Job template validation failed');
      throw new JobTemplateValidationError('Validation failed', { zodError: error.message });
    }

    // Transform database errors to validation errors
    const dbError = transformDatabaseError(error);
    if (dbError) {
      logger.warn({ error, input }, 'Database constraint violation');
      throw new JobTemplateValidationError(dbError.message, dbError.details);
    }

    logger.error({ error, input }, 'Failed to create job template');
    throw error;
  }
}

/**
 * Get a job template by ID
 * @param id Job template ID
 * @param database Database instance (for dependency injection)
 * @returns Job template
 * @throws JobTemplateNotFoundError if not found
 */
export async function getJobTemplateByIdService(
  id: string,
  database: Database = db
): Promise<JobTemplate> {
  const jobTemplate = await findJobTemplateById(id, database);

  if (!jobTemplate) {
    logger.warn({ jobTemplateId: id }, 'Job template not found');
    throw new JobTemplateNotFoundError(id);
  }

  return jobTemplate;
}

/**
 * List all job templates with optional filtering
 * @param query Query parameters for filtering
 * @param database Database instance (for dependency injection)
 * @returns Array of job templates
 */
export async function listJobTemplatesService(
  query: ListJobTemplatesQuery = {},
  database: Database = db
): Promise<JobTemplate[]> {
  const filters = query.isActive ? { isActive: query.isActive } : undefined;
  const jobTemplates = await findAllJobTemplates(filters, database);

  logger.info({ count: jobTemplates.length, filters }, 'Listed job templates');

  return jobTemplates;
}

/**
 * Update a job template by ID
 * @param id Job template ID
 * @param input Partial job template data to update
 * @param database Database instance (for dependency injection)
 * @returns Updated job template
 * @throws JobTemplateNotFoundError if not found
 * @throws JobTemplateValidationError if validation fails
 */
export async function updateJobTemplateService(
  id: string,
  input: UpdateJobTemplateInput,
  database: Database = db
): Promise<JobTemplate> {
  try {
    // Validate input
    const validatedData: UpdateJobTemplateInput = updateJobTemplateSchema.parse(input);

    // Update the job template
    // Type assertion needed for exactOptionalPropertyTypes compatibility
    const jobTemplate = await updateJobTemplate(id, validatedData as UpdateJobTemplate, database);

    if (!jobTemplate) {
      logger.warn({ jobTemplateId: id }, 'Job template not found for update');
      throw new JobTemplateNotFoundError(id);
    }

    logger.info({ jobTemplateId: id }, 'Job template updated successfully');

    return jobTemplate;
  } catch (error) {
    // Re-throw existing domain errors
    if (error instanceof JobTemplateNotFoundError || error instanceof JobTemplateValidationError) {
      throw error;
    }

    // Handle Zod validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      logger.warn({ error, id, input }, 'Job template update validation failed');
      throw new JobTemplateValidationError('Validation failed', { zodError: error.message });
    }

    // Transform database errors to validation errors
    const dbError = transformDatabaseError(error);
    if (dbError) {
      logger.warn({ error, id, input }, 'Database constraint violation');
      throw new JobTemplateValidationError(dbError.message, dbError.details);
    }

    logger.error({ error, id, input }, 'Failed to update job template');
    throw error;
  }
}

/**
 * Delete a job template by ID
 * @param id Job template ID
 * @param database Database instance (for dependency injection)
 * @returns Deleted job template ID
 * @throws JobTemplateNotFoundError if not found
 */
export async function deleteJobTemplateService(
  id: string,
  database: Database = db
): Promise<string> {
  const deleted = await deleteJobTemplate(id, database);

  if (!deleted) {
    logger.warn({ jobTemplateId: id }, 'Job template not found for deletion');
    throw new JobTemplateNotFoundError(id);
  }

  logger.info({ jobTemplateId: id }, 'Job template deleted successfully');

  return id;
}

/**
 * Job Templates service factory function for dependency injection
 * Returns an object with all job template operations bound to a specific database
 */
function createJobTemplatesService(database: Database = db) {
  return {
    create: (input: CreateJobTemplateInput) => createJobTemplateService(input, database),
    getById: (id: string) => getJobTemplateByIdService(id, database),
    list: (query?: ListJobTemplatesQuery) => listJobTemplatesService(query, database),
    update: (id: string, input: UpdateJobTemplateInput) =>
      updateJobTemplateService(id, input, database),
    delete: (id: string) => deleteJobTemplateService(id, database),
  };
}

// Export a default service instance using the default database
export const jobTemplatesService = createJobTemplatesService();
