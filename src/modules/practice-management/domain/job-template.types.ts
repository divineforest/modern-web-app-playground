import { z } from 'zod';

/**
 * Validation schema for job template code
 * Must be uppercase alphanumeric with underscores only
 */
const jobTemplateCodeSchema = z
  .string()
  .min(1, 'Code is required')
  .regex(/^[A-Z0-9_]+$/, 'Code must be uppercase alphanumeric with underscores only');

/**
 * Validation schema for job template name
 */
const jobTemplateNameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(255, 'Name must be 255 characters or less');

/**
 * Validation schema for job template description
 */
const jobTemplateDescriptionSchema = z.string().nullable().optional();

/**
 * Validation schema for isActive field
 * Stored as string "true" or "false" in database
 */
const jobTemplateIsActiveSchema = z.enum(['true', 'false']).default('true');

/**
 * Validation schema for service type ID
 */
const jobTemplateServiceTypeIdSchema = z.string().uuid().nullable().optional();

/**
 * Validation schema for default assignee ID
 */
const jobTemplateDefaultAssigneeIdSchema = z.string().uuid().nullable().optional();

/**
 * Validation schema for title pattern
 */
const jobTemplateTitlePatternSchema = z.string().min(1, 'Title pattern is required');

/**
 * Complete validation schema for creating a job template
 */
export const createJobTemplateSchema = z.object({
  code: jobTemplateCodeSchema,
  name: jobTemplateNameSchema,
  description: jobTemplateDescriptionSchema,
  isActive: jobTemplateIsActiveSchema,
  serviceTypeId: jobTemplateServiceTypeIdSchema,
  defaultAssigneeId: jobTemplateDefaultAssigneeIdSchema,
  titlePattern: jobTemplateTitlePatternSchema,
});

/**
 * Validation schema for updating a job template (all fields optional)
 */
export const updateJobTemplateSchema = z.object({
  code: jobTemplateCodeSchema.optional(),
  name: jobTemplateNameSchema.optional(),
  description: jobTemplateDescriptionSchema,
  isActive: jobTemplateIsActiveSchema.optional(),
  serviceTypeId: jobTemplateServiceTypeIdSchema,
  defaultAssigneeId: jobTemplateDefaultAssigneeIdSchema,
  titlePattern: jobTemplateTitlePatternSchema.optional(),
});

/**
 * Validation schema for job template ID
 */
export const jobTemplateIdSchema = z.string().uuid('Invalid job template ID');

/**
 * Validation schema for listing job templates query parameters
 */
export const listJobTemplatesQuerySchema = z.object({
  isActive: z.enum(['true', 'false']).optional(),
});

/**
 * Type for create job template input
 */
export type CreateJobTemplateInput = z.infer<typeof createJobTemplateSchema>;

/**
 * Type for update job template input
 */
export type UpdateJobTemplateInput = z.infer<typeof updateJobTemplateSchema>;

/**
 * Type for list job templates query
 */
export type ListJobTemplatesQuery = z.infer<typeof listJobTemplatesQuerySchema>;
