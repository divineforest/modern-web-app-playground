import type { Job as JobSchema, NewJob as NewJobSchema } from '../../../db/schema.js';
import type { JobStatus } from './job.types.js';

/**
 * Job entity
 * Represents an individual job/task for a company
 * We override the status type to be the specific enum instead of generic string
 */
export type Job = Omit<JobSchema, 'status'> & {
  status: JobStatus;
};

/**
 * New Job entity for creation
 * We override the status type to be the specific enum instead of generic string
 */
export type NewJob = Omit<NewJobSchema, 'status'> & {
  status: JobStatus;
};

/**
 * Update Job entity for partial updates
 */
export type UpdateJob = Partial<Omit<NewJob, 'id' | 'createdAt'>>;

/**
 * Job with related company and assignee details
 * Used in list responses to include company name and assignee information
 */
export type JobWithDetails = Job & {
  companyName: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
};
