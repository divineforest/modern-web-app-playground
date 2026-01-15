/**
 * Workflow Registry
 *
 * Central registry for all Temporal workflows in the application.
 * Workflows are imported from their respective modules and re-exported here
 * for registration with the Temporal worker.
 */

// Export all workflows from modules
export { postmarkInboundEmailWorkflow } from '../../modules/inbound-email/workflows/process-inbound-email.workflow.js';
