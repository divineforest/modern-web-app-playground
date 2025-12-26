import { eq } from 'drizzle-orm';
import type { Database } from '../../../db/connection.js';
import { db } from '../../../db/connection.js';
import { jobTemplates } from '../../../db/schema.js';
import type {
  JobTemplate,
  NewJobTemplate,
  UpdateJobTemplate,
} from '../domain/job-template.entity.js';

/**
 * Create a new job template
 * @param data Job template data to insert
 * @param database Database instance (for dependency injection)
 * @returns Created job template
 */
export async function createJobTemplate(
  data: NewJobTemplate,
  database: Database = db
): Promise<JobTemplate> {
  const [jobTemplate] = await database.insert(jobTemplates).values(data).returning();

  if (!jobTemplate) {
    throw new Error('Failed to create job template');
  }

  return jobTemplate;
}

/**
 * Find a job template by ID
 * @param id Job template ID
 * @param database Database instance (for dependency injection)
 * @returns Job template or null if not found
 */
export async function findJobTemplateById(
  id: string,
  database: Database = db
): Promise<JobTemplate | null> {
  const [jobTemplate] = await database.select().from(jobTemplates).where(eq(jobTemplates.id, id));

  return jobTemplate || null;
}

/**
 * Find all job templates with optional filtering
 * @param filters Optional filters (isActive)
 * @param database Database instance (for dependency injection)
 * @returns Array of job templates
 */
export async function findAllJobTemplates(
  filters?: { isActive?: string },
  database: Database = db
): Promise<JobTemplate[]> {
  const baseQuery = database.select().from(jobTemplates);

  // Apply isActive filter if provided
  const query =
    filters?.isActive !== undefined
      ? baseQuery.where(eq(jobTemplates.isActive, filters.isActive))
      : baseQuery;

  // Order by creation date (newest first)
  const results = await query.orderBy(jobTemplates.createdAt);

  return results;
}

/**
 * Update a job template by ID
 * @param id Job template ID
 * @param data Partial job template data to update
 * @param database Database instance (for dependency injection)
 * @returns Updated job template or null if not found
 */
export async function updateJobTemplate(
  id: string,
  data: UpdateJobTemplate,
  database: Database = db
): Promise<JobTemplate | null> {
  // Update the updatedAt timestamp
  const updateData = {
    ...data,
    updatedAt: new Date(),
  };

  const [jobTemplate] = await database
    .update(jobTemplates)
    .set(updateData)
    .where(eq(jobTemplates.id, id))
    .returning();

  return jobTemplate || null;
}

/**
 * Delete a job template by ID (hard delete)
 * @param id Job template ID
 * @param database Database instance (for dependency injection)
 * @returns true if deleted, false if not found
 */
export async function deleteJobTemplate(id: string, database: Database = db): Promise<boolean> {
  const result = await database.delete(jobTemplates).where(eq(jobTemplates.id, id)).returning();

  return result.length > 0;
}
