import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  createJobSchema,
  jobIdSchema,
  jobStatusSchema,
  listJobsQuerySchema,
  updateJobSchema,
} from '../domain/job.types.js';

const c = initContract();

/**
 * Job response schema
 * Represents the full job object returned by the API
 */
const jobResponseSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  companyId: z.string().uuid(),
  serviceTypeId: z.string().uuid(),
  title: z.string(),
  status: jobStatusSchema,
  dueAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  assigneeId: z.string().uuid().nullable(),
  periodStart: z.string().nullable(), // DATE in postgres returns as string
  periodEnd: z.string().nullable(), // DATE in postgres returns as string
});

/**
 * Error response schemas
 */
const validationErrorSchema = z.object({
  error: z.string(),
  details: z
    .union([z.string(), z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))])
    .optional(),
});

const notFoundErrorSchema = z.object({
  error: z.string(),
});

const unauthorizedErrorSchema = z.object({
  error: z.string(),
});

const internalErrorSchema = z.object({
  error: z.string(),
});

/**
 * Delete response schema
 */
const deleteResponseSchema = z.object({
  success: z.boolean(),
  id: z.string().uuid(),
});

/**
 * List response schema - includes job details with company and assignee information
 */
const jobListItemSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  companyId: z.string().uuid(),
  companyName: z.string().nullable(),
  serviceTypeId: z.string().uuid(),
  title: z.string(),
  status: jobStatusSchema,
  dueAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  assigneeId: z.string().uuid().nullable(),
  assigneeName: z.string().nullable(),
  assigneeEmail: z.string().nullable(),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
});

/**
 * List response schema
 */
const listResponseSchema = z.object({
  jobs: z.array(jobListItemSchema),
});

/**
 * Jobs API Contract
 * Defines all endpoints for CRUD operations on jobs
 */
export const jobsContract = c.router({
  /**
   * Create a new job
   */
  create: {
    method: 'POST',
    path: '/api/internal/jobs',
    responses: {
      201: jobResponseSchema,
      400: validationErrorSchema,
      500: internalErrorSchema,
    },
    body: createJobSchema,
    summary: 'Create a new job',
    description: 'Creates a new job with the provided data',
  },

  /**
   * Get a job by ID
   */
  getById: {
    method: 'GET',
    path: '/api/internal/jobs/:id',
    responses: {
      200: jobResponseSchema,
      400: validationErrorSchema,
      401: unauthorizedErrorSchema,
      404: notFoundErrorSchema,
      500: internalErrorSchema,
    },
    pathParams: z.object({
      id: jobIdSchema,
    }),
    summary: 'Get a job by ID',
    description: 'Retrieves a single job by its unique identifier',
  },

  /**
   * List all jobs
   */
  list: {
    method: 'GET',
    path: '/api/internal/jobs',
    responses: {
      200: listResponseSchema,
      400: validationErrorSchema,
      401: unauthorizedErrorSchema,
      500: internalErrorSchema,
    },
    query: listJobsQuerySchema,
    summary: 'List all jobs',
    description: 'Retrieves all jobs with optional filtering',
  },

  /**
   * Update a job by ID
   */
  update: {
    method: 'PATCH',
    path: '/api/internal/jobs/:id',
    responses: {
      200: jobResponseSchema,
      400: validationErrorSchema,
      401: unauthorizedErrorSchema,
      404: notFoundErrorSchema,
      500: internalErrorSchema,
    },
    pathParams: z.object({
      id: jobIdSchema,
    }),
    body: updateJobSchema,
    summary: 'Update a job',
    description: 'Updates an existing job with partial data',
  },

  /**
   * Delete a job by ID
   */
  delete: {
    method: 'DELETE',
    path: '/api/internal/jobs/:id',
    responses: {
      200: deleteResponseSchema,
      400: validationErrorSchema,
      401: unauthorizedErrorSchema,
      404: notFoundErrorSchema,
      500: internalErrorSchema,
    },
    pathParams: z.object({
      id: jobIdSchema,
    }),
    summary: 'Delete a job',
    description: 'Permanently deletes a job from the database',
  },
});
