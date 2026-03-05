import { z } from 'zod';

export const registerInputSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginInputSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const userProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  isAdmin: z.boolean(),
  createdAt: z.string(),
});

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
