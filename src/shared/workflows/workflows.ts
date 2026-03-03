/**
 * Workflow Registry
 *
 * Central registry for all Temporal workflows in the application.
 * Workflows are imported from their respective modules' public APIs and re-exported here
 * for registration with the Temporal worker.
 */

// Export all workflows from modules
export { postmarkInboundEmailWorkflow } from '../../modules/inbound-email/index.js';
export { paymentWebhookWorkflow } from '../../modules/payment-webhooks/index.js';
