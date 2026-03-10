import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  conflictErrorSchema,
  internalErrorSchema,
  unauthorizedErrorSchema,
  validationErrorSchema,
} from '../shared/errors.js';
import { loginInputSchema, registerInputSchema, userProfileSchema } from './schemas.js';

const c = initContract();

export const authContract = c.router({
  register: {
    method: 'POST',
    path: '/api/auth/register',
    responses: {
      201: userProfileSchema,
      400: validationErrorSchema,
      409: conflictErrorSchema,
      500: internalErrorSchema,
    },
    body: registerInputSchema,
    summary: 'Register new user',
    description: 'Creates a new user account and returns a session cookie',
  },

  login: {
    method: 'POST',
    path: '/api/auth/login',
    responses: {
      200: userProfileSchema,
      400: validationErrorSchema,
      401: unauthorizedErrorSchema,
      500: internalErrorSchema,
    },
    body: loginInputSchema,
    summary: 'Login',
    description: 'Authenticates user and returns a session cookie',
  },

  logout: {
    method: 'POST',
    path: '/api/auth/logout',
    responses: {
      200: z.object({ success: z.boolean() }),
      500: internalErrorSchema,
    },
    body: z.object({}),
    summary: 'Logout',
    description: 'Invalidates the current session and clears the session cookie',
  },

  me: {
    method: 'GET',
    path: '/api/auth/me',
    responses: {
      200: userProfileSchema,
      401: unauthorizedErrorSchema,
      500: internalErrorSchema,
    },
    summary: 'Get current user',
    description: 'Returns the authenticated user profile',
  },
});
