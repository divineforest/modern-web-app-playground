import type {
  JobTemplate as JobTemplateSchema,
  NewJobTemplate as NewJobTemplateSchema,
} from '../../../db/schema.js';

/**
 * Job Template entity
 * Represents a reusable job template for accounting operations
 */
export type JobTemplate = JobTemplateSchema;

/**
 * New Job Template entity for creation
 */
export type NewJobTemplate = NewJobTemplateSchema;

/**
 * Update Job Template entity for partial updates
 */
export type UpdateJobTemplate = Partial<Omit<NewJobTemplate, 'id' | 'createdAt'>>;
