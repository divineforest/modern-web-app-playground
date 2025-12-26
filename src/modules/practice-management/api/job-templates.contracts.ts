import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  createJobTemplateSchema,
  jobTemplateIdSchema,
  listJobTemplatesQuerySchema,
  updateJobTemplateSchema,
} from '../domain/job-template.types.js';

const c = initContract();

/**
 * Job template response schema
 * Represents the full job template object returned by the API
 */
const jobTemplateResponseSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.string(),
  defaultAssigneeId: z.string().uuid().nullable(),
  titlePattern: z.string(),
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
 * List response schema
 */
const listResponseSchema = z.object({
  jobTemplates: z.array(jobTemplateResponseSchema),
});

/**
 * Job Templates API Contract
 * Defines all endpoints for CRUD operations on job templates
 */
export const jobTemplatesContract = c.router({
  /**
   * Create a new job template
   */
  create: {
    method: 'POST',
    path: '/api/internal/job-templates',
    responses: {
      201: jobTemplateResponseSchema,
      400: validationErrorSchema,
      500: internalErrorSchema,
    },
    body: createJobTemplateSchema,
    summary: 'Create a new job template',
    description: 'Creates a new job template with the provided data',
  },

  /**
   * Get a job template by ID
   */
  getById: {
    method: 'GET',
    path: '/api/internal/job-templates/:id',
    responses: {
      200: jobTemplateResponseSchema,
      400: validationErrorSchema,
      401: unauthorizedErrorSchema,
      404: notFoundErrorSchema,
      500: internalErrorSchema,
    },
    pathParams: z.object({
      id: jobTemplateIdSchema,
    }),
    summary: 'Get a job template by ID',
    description: 'Retrieves a single job template by its unique identifier',
  },

  /**
   * List all job templates
   */
  list: {
    method: 'GET',
    path: '/api/internal/job-templates',
    responses: {
      200: listResponseSchema,
      400: validationErrorSchema,
      401: unauthorizedErrorSchema,
      500: internalErrorSchema,
    },
    query: listJobTemplatesQuerySchema,
    summary: 'List all job templates',
    description: 'Retrieves all job templates with optional filtering by isActive status',
  },

  /**
   * Update a job template by ID
   */
  update: {
    method: 'PATCH',
    path: '/api/internal/job-templates/:id',
    responses: {
      200: jobTemplateResponseSchema,
      400: validationErrorSchema,
      401: unauthorizedErrorSchema,
      404: notFoundErrorSchema,
      500: internalErrorSchema,
    },
    pathParams: z.object({
      id: jobTemplateIdSchema,
    }),
    body: updateJobTemplateSchema,
    summary: 'Update a job template',
    description: 'Updates an existing job template with partial data',
  },

  /**
   * Delete a job template by ID
   */
  delete: {
    method: 'DELETE',
    path: '/api/internal/job-templates/:id',
    responses: {
      200: deleteResponseSchema,
      400: validationErrorSchema,
      401: unauthorizedErrorSchema,
      404: notFoundErrorSchema,
      500: internalErrorSchema,
    },
    pathParams: z.object({
      id: jobTemplateIdSchema,
    }),
    summary: 'Delete a job template',
    description: 'Permanently deletes a job template from the database',
  },
});
