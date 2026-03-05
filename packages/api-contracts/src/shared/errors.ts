import { z } from 'zod';

export const validationErrorSchema = z.object({
  error: z.string(),
  details: z
    .union([z.string(), z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))])
    .optional(),
});

export const notFoundErrorSchema = z.object({
  error: z.string(),
});

export const unauthorizedErrorSchema = z.object({
  error: z.string(),
});

export const internalErrorSchema = z.object({
  error: z.string(),
});

export const conflictErrorSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
});

export const unprocessableEntityErrorSchema = z.object({
  error: z.string(),
});
