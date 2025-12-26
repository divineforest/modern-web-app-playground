/**
 * Inbound Email Module
 *
 * This module handles inbound email webhooks for processing invoices and documents.
 * It provides webhook endpoints that trigger Temporal workflows for reliable background processing.
 *
 * @module inbound-email
 *
 * ## Public API
 *
 * ### API Layer
 * - `postmarkWebhookRoutes` - Fastify route registration function for webhook endpoints
 *
 * ### Service Layer
 * - `processWebhook` - Process a Postmark webhook payload
 * - `PostmarkWebhookPayload` - Type definition for webhook payload
 * - `PostmarkAttachment` - Type definition for email attachments
 *
 * ### Workflows
 * - `postmarkInboundEmailWorkflow` - Temporal workflow for processing inbound emails
 * - `processInboundEmailActivity` - Temporal activity for email processing
 *
 * @example
 * ```typescript
 * // Register webhook routes
 * import { postmarkWebhookRoutes } from './modules/inbound-email';
 * await fastify.register(postmarkWebhookRoutes);
 * ```
 *
 * @example
 * ```typescript
 * // Process webhook manually (for testing)
 * import { processWebhook } from './modules/inbound-email';
 * await processWebhook(payload);
 * ```
 */

// API Layer Exports
export { postmarkWebhookRoutes } from './api/postmark-webhook.routes.js';
// Service Layer Exports
export type {
  AttachmentUploadConfig,
  EmailMetadata,
  PostmarkAttachment,
  PostmarkWebhookPayload,
} from './services/postmark-webhook-processor.js';
/** @lintignore - Public API for webhook processing */
export { processWebhook } from './services/postmark-webhook-processor.js';

// Workflow Exports
/** @lintignore - Public API for Temporal workflows */
export { processInboundEmailActivity } from './workflows/postmark-email-processor.activity.js';
/** @lintignore - Public API for Temporal workflows */
export { postmarkInboundEmailWorkflow } from './workflows/postmark-inbound-email.workflow.js';
