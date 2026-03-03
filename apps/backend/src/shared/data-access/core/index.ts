/**
 * Core microservice data access layer
 * Provides access to core microservice data via:
 * - Direct database queries (read-only to core-owned tables)
 * - HTTP API calls (for write operations and business logic)
 */

export * from './companies.repository.js';
export * from './core-sdk.js';
