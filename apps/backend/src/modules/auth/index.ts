/**
 * Auth module - handles user authentication and session management
 */

export { registerAuthRoutes } from './api/auth.routes.js';
export { authService } from './services/auth.service.js';
export type { LoginInput, RegisterInput, UserProfile } from './domain/auth.types.js';
