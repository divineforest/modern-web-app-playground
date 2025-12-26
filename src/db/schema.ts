/**
 * Main schema file - exports all tables for querying
 *
 * This file combines:
 * - Core microservice tables (for querying only, no migrations)
 * - Local microservice tables (for querying and migrations)
 */

// Re-export core microservice tables (NO MIGRATIONS)
export * from './schema-core.js';

// Re-export local microservice tables (WITH MIGRATIONS)
export * from './schema-local.js';
