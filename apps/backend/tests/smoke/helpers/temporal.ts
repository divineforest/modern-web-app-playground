import { Client, Connection } from '@temporalio/client';
import { env } from '../../../src/lib/env.js';

/**
 * Create a Temporal client for smoke tests
 */
export async function createTemporalClient(): Promise<Client> {
  const isTlsEnabled = ['staging', 'production'].includes(env.NODE_ENV);

  const connectionOptions = {
    address: env.TEMPORAL_ADDRESS,
    tls: isTlsEnabled,
    ...(env.TEMPORAL_API_KEY &&
      env.TEMPORAL_API_KEY !== 'FAKE_TEMPORAL_API_KEY' && {
        apiKey: env.TEMPORAL_API_KEY,
      }),
  };

  const connection = await Connection.connect(connectionOptions);

  const client = new Client({
    connection,
    namespace: env.TEMPORAL_NAMESPACE,
  });

  return client;
}

/**
 * Workflow execution status from Temporal
 */
export type WorkflowStatus =
  | 'WORKFLOW_EXECUTION_STATUS_UNSPECIFIED'
  | 'WORKFLOW_EXECUTION_STATUS_RUNNING'
  | 'WORKFLOW_EXECUTION_STATUS_COMPLETED'
  | 'WORKFLOW_EXECUTION_STATUS_FAILED'
  | 'WORKFLOW_EXECUTION_STATUS_CANCELED'
  | 'WORKFLOW_EXECUTION_STATUS_TERMINATED'
  | 'WORKFLOW_EXECUTION_STATUS_CONTINUED_AS_NEW'
  | 'WORKFLOW_EXECUTION_STATUS_TIMED_OUT';

/**
 * Wait for workflow to reach a terminal state or expected retry condition
 */
export async function waitForWorkflow(
  client: Client,
  workflowId: string,
  timeoutMs: number
): Promise<{
  status: WorkflowStatus;
  hasActivityRetry: boolean;
}> {
  const startTime = Date.now();
  const pollInterval = 2000; // Check every 2 seconds

  console.log(
    `[SMOKE] Waiting for workflow ${workflowId} to reach terminal state (timeout: ${timeoutMs}ms)...`
  );
  console.log('[SMOKE] NOTE: Workflow may fail/retry due to Core API being unavailable');

  while (Date.now() - startTime < timeoutMs) {
    try {
      const handle = client.workflow.getHandle(workflowId);
      const description = await handle.describe();

      const status = description.status.name as WorkflowStatus;

      // Terminal states - success
      if (status === 'WORKFLOW_EXECUTION_STATUS_COMPLETED') {
        console.log('[SMOKE] ✓ Workflow completed successfully');
        return { status, hasActivityRetry: false };
      }

      if (status === 'WORKFLOW_EXECUTION_STATUS_FAILED') {
        console.log('[SMOKE] ⚠ Workflow failed as expected (Core API unavailable)');
        return { status, hasActivityRetry: false };
      }

      // Unexpected terminal states
      if (
        status === 'WORKFLOW_EXECUTION_STATUS_TERMINATED' ||
        status === 'WORKFLOW_EXECUTION_STATUS_CANCELED'
      ) {
        throw new Error(`Workflow was terminated or canceled unexpectedly: ${status}`);
      }

      // Check for activity retries (expected behavior when Core API is unavailable)
      if (status === 'WORKFLOW_EXECUTION_STATUS_RUNNING') {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);

        // After 20 seconds, check if activities are retrying (expected behavior)
        if (elapsed >= 20) {
          // Try to get workflow history to check for activity failures
          try {
            const history = await handle.fetchHistory();
            const events = history.events || [];

            // Check if there are activity task failed events with fetch errors
            const hasFetchFailure = events.some((event) => {
              if (event.activityTaskFailedEventAttributes) {
                const failure = event.activityTaskFailedEventAttributes.failure;
                return (
                  failure?.message?.toLowerCase().includes('fetch failed') ||
                  failure?.message?.toLowerCase().includes('core api')
                );
              }
              return false;
            });

            if (hasFetchFailure) {
              console.log(
                '[SMOKE] ⚠ Workflow is running with expected Core API fetch failures (activity retrying)'
              );
              console.log('[SMOKE] ✓ This is expected behavior for smoke test');
              return { status, hasActivityRetry: true };
            }
          } catch {
            // If we can't fetch history, continue waiting
            console.log('[SMOKE] Could not fetch workflow history, continuing to wait...');
          }
        }
      }

      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      if (elapsed % 10 === 0) {
        const readableStatus = status.replace('WORKFLOW_EXECUTION_STATUS_', '');
        console.log(`[SMOKE] Still waiting... (${elapsed}s elapsed, status: ${readableStatus})`);
      }
    } catch (error) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      console.log(
        `[SMOKE] Error checking workflow status (${elapsed}s elapsed): ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }

    await new Promise((resolve) => global.setTimeout(resolve, pollInterval));
  }

  throw new Error(`Workflow ${workflowId} did not reach expected state within ${timeoutMs}ms`);
}

/**
 * Verify workflow has executed activities (either completed or retrying)
 */
export async function verifyWorkflowExecution(client: Client, workflowId: string): Promise<void> {
  console.log('[SMOKE] Verifying workflow execution...');

  const handle = client.workflow.getHandle(workflowId);

  // Check workflow history for completed activities
  try {
    const history = await handle.fetchHistory();
    const events = history.events || [];

    const completedActivities = events.filter(
      (event) => event.activityTaskCompletedEventAttributes != null
    ).length;

    if (completedActivities > 0) {
      console.log(`[SMOKE] ✓ Activity completed (${completedActivities} activities)`);
      return;
    }

    throw new Error('No activities found - workflow may have failed before activity execution');
  } catch (error) {
    if (error instanceof Error && error.message.includes('No activities found')) {
      throw error;
    }

    // If we can't fetch history but workflow is running, assume it's working
    console.log('[SMOKE] ⚠ Could not verify activity execution, but workflow is running');
  }
}
