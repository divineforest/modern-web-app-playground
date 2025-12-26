/**
 * Practice Management Module
 *
 * This module provides CRUD operations for managing jobs and job templates within the accounting system.
 * - Job templates are reusable structures that define standardized job configurations
 * - Jobs are individual work items that need to be completed for specific companies
 *
 * @module practice-management
 *
 * ## Public API
 *
 * ### Job Templates
 * #### API Layer
 * - `jobTemplatesContract` - ts-rest API contract definition
 * - `jobTemplatesRoutes` - Fastify route registration function
 *
 * #### Service Layer
 * - `jobTemplatesService` - Default service instance
 * - `createJobTemplatesService` - Service factory for dependency injection
 * - `JobTemplateNotFoundError` - Error thrown when job template is not found
 * - `JobTemplateValidationError` - Error thrown when validation fails
 *
 * #### Domain Types
 * - `JobTemplate` - Job template entity type
 * - `NewJobTemplate` - Type for creating job templates
 * - `UpdateJobTemplate` - Type for updating job templates
 * - `CreateJobTemplateInput` - Input type for create operation
 * - `UpdateJobTemplateInput` - Input type for update operation
 * - `ListJobTemplatesQuery` - Query parameters for listing
 *
 * ### Jobs
 * #### API Layer
 * - `jobsContract` - ts-rest API contract definition
 * - `registerJobsRoutes` - Fastify route registration function
 *
 * #### Service Layer
 * - `jobsService` - Default service instance
 * - `createJobsService` - Service factory for dependency injection
 * - `JobNotFoundError` - Error thrown when job is not found
 * - `JobValidationError` - Error thrown when validation fails
 *
 * #### Domain Types
 * - `Job` - Job entity type
 * - `NewJob` - Type for creating jobs
 * - `UpdateJob` - Type for updating jobs
 * - `CreateJobInput` - Input type for create operation
 * - `UpdateJobInput` - Input type for update operation
 * - `ListJobsQuery` - Query parameters for listing
 */

// ============================================================================
// JOB TEMPLATES EXPORTS
// ============================================================================

// API Layer Exports
export { jobTemplatesRoutes } from './api/job-templates.routes.js';

// Domain Exports
export type {
  JobTemplate,
  NewJobTemplate,
  UpdateJobTemplate,
} from './domain/job-template.entity.js';
export type {
  CreateJobTemplateInput,
  ListJobTemplatesQuery,
  UpdateJobTemplateInput,
} from './domain/job-template.types.js';

// ============================================================================
// JOBS EXPORTS
// ============================================================================

// API Layer Exports
export { registerJobsRoutes } from './api/jobs.routes.js';

// Domain Exports
export type { Job, NewJob, UpdateJob } from './domain/job.entity.js';
export type {
  CreateJobInput,
  ListJobsQuery,
  UpdateJobInput,
} from './domain/job.types.js';

// ============================================================================
// AUTOMATIC JOB GENERATION EXPORTS
// ============================================================================

export type {
  CompanyBillingPeriodFilters,
  CompanyBillingPeriodPair,
} from './repositories/company-billing-periods.repository.js';
// Repository Layer Exports
export type {
  JobGenerationConfig,
  JobGenerationStatistics,
} from './services/automatic-job-generation.service.js';
// Service Layer Exports
export { automaticJobGenerationService } from './services/automatic-job-generation.service.js';
