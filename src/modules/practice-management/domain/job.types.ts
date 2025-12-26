import { z } from 'zod';

/**
 * Job status enum
 */
const jobStatusEnum = ['planned', 'in_progress', 'completed', 'canceled'] as const;
export type JobStatus = (typeof jobStatusEnum)[number];

/**
 * Validation schema for job status
 */
export const jobStatusSchema = z.enum(jobStatusEnum);

/**
 * Validation schema for job title
 */
const jobTitleSchema = z.string().min(1, 'Title is required');

/**
 * Validation schema for company ID
 */
const jobCompanyIdSchema = z.string().uuid('Invalid company ID');

/**
 * Validation schema for service type ID
 */
const jobServiceTypeIdSchema = z.string().uuid('Invalid service type ID');

/**
 * Validation schema for assignee ID
 */
const jobAssigneeIdSchema = z.string().uuid('Invalid assignee ID').nullable().optional();

/**
 * Validation schema for due date
 */
const jobDueAtSchema = z.coerce.date().nullable().optional();

/**
 * Validation schema for completed date
 */
const jobCompletedAtSchema = z.coerce.date().nullable().optional();

/**
 * Validation schema for period start date
 * Note: stored as DATE in postgres, comes back as string
 */
const jobPeriodStartSchema = z.string().nullable().optional();

/**
 * Validation schema for period end date
 * Note: stored as DATE in postgres, comes back as string
 */
const jobPeriodEndSchema = z.string().nullable().optional();

/**
 * Validation schema for billing period ID
 * References billing_periods table in core microservice
 */
const jobBillingPeriodIdSchema = z.string().uuid('Invalid billing period ID').nullable().optional();

/**
 * Complete validation schema for creating a job
 */
export const createJobSchema = z.object({
  companyId: jobCompanyIdSchema,
  serviceTypeId: jobServiceTypeIdSchema,
  title: jobTitleSchema,
  status: jobStatusSchema.default('planned'),
  dueAt: jobDueAtSchema,
  completedAt: jobCompletedAtSchema,
  assigneeId: jobAssigneeIdSchema,
  periodStart: jobPeriodStartSchema,
  periodEnd: jobPeriodEndSchema,
  billingPeriodId: jobBillingPeriodIdSchema,
});

/**
 * Validation schema for updating a job (all fields optional)
 * Note: companyId and serviceTypeId are intentionally excluded as they should be immutable after creation
 */
export const updateJobSchema = z.object({
  title: jobTitleSchema.optional(),
  status: jobStatusSchema.optional(),
  dueAt: jobDueAtSchema,
  completedAt: jobCompletedAtSchema,
  assigneeId: jobAssigneeIdSchema,
  periodStart: jobPeriodStartSchema,
  periodEnd: jobPeriodEndSchema,
  billingPeriodId: jobBillingPeriodIdSchema.optional(),
});

/**
 * Validation schema for job ID
 */
export const jobIdSchema = z.string().uuid('Invalid job ID');

/**
 * Validation schema for listing jobs query parameters
 */
export const listJobsQuerySchema = z.object({
  companyId: jobCompanyIdSchema.optional(),
  status: jobStatusSchema.optional(),
  assigneeId: z.string().uuid('Invalid assignee ID').optional(),
  dueBefore: z.coerce.date().optional(),
  dueAfter: z.coerce.date().optional(),
});

/**
 * Type for create job input
 */
export type CreateJobInput = z.infer<typeof createJobSchema>;

/**
 * Type for update job input
 */
export type UpdateJobInput = z.infer<typeof updateJobSchema>;

/**
 * Type for list jobs query
 */
export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;
