/**
 * S3 data access layer
 * Provides generic S3 storage operations.
 *
 * NOTE: Keep methods domain-agnostic (e.g., uploadJson, getObject).
 * Domain-specific logic belongs in src/modules/<domain>/
 */

export * from './s3-storage.js';
