// IMPORTANT: Import instrument.ts at the very top to initialize Sentry
import '../../instrument.js';

import * as Sentry from '@sentry/node';
import type {
  ActivityExecuteInput,
  ActivityInboundCallsInterceptor,
  Next,
} from '@temporalio/worker';
/**
 * Temporal Worker Implementation
 *
 * Following official Temporal TypeScript documentation patterns.
 */
import { NativeConnection, Worker } from '@temporalio/worker';
import { env } from '../../lib/env.js';
import * as paymentActivities from '../../modules/payment-webhooks/workflows/process-payment/index.js';

/**
 * Sentry Activity Interceptor
 *
 * Automatically captures all activity errors and sends them to Sentry
 * while preserving Temporal's retry logic.
 */
export class SentryActivityInterceptor implements ActivityInboundCallsInterceptor {
  async execute(
    input: ActivityExecuteInput,
    next: Next<ActivityInboundCallsInterceptor, 'execute'>
  ): Promise<unknown> {
    try {
      return await next(input);
    } catch (error) {
      // Capture error with Sentry with activity context
      Sentry.captureException(error, {
        tags: {
          service: 'temporal-worker',
          context: 'activity-execution',
        },
        extra: {
          // Basic metadata about the activity execution
          inputKeys: Object.keys(input),
        },
      });

      // Re-throw to preserve Temporal retry logic
      throw error;
    }
  }
}

async function run() {
  // Step 1: Establish a connection with Temporal server.
  //
  // Worker code uses `@temporalio/worker.NativeConnection`.
  // (But in your application code it's `@temporalio/client.Connection`.)

  // Configure connection with proper API key authentication and TLS
  // TLS is enabled for production/staging (Temporal Cloud), disabled for development (local)
  const isTlsEnabled = ['staging', 'production'].includes(env.NODE_ENV);

  const connectionOptions = {
    address: env.TEMPORAL_ADDRESS,
    tls: isTlsEnabled,
    ...(env.TEMPORAL_API_KEY &&
      env.TEMPORAL_API_KEY !== 'FAKE_TEMPORAL_API_KEY' && {
        apiKey: env.TEMPORAL_API_KEY,
      }),
  };

  const connection = await NativeConnection.connect(connectionOptions);

  try {
    // Step 2: Register Workflows and Activities with the Worker.
    const worker = await Worker.create({
      connection,
      namespace: env.TEMPORAL_NAMESPACE,
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      // Workflows are registered using a path as they run in a separate JS context.
      workflowsPath: new URL('./workflows.ts', import.meta.url).pathname,
      activities: {
        ...paymentActivities,
      },
      // Register the Sentry interceptor for automatic error capture
      interceptors: {
        activityInbound: [() => new SentryActivityInterceptor()],
      },
    });

    console.log(`Worker started, listening on task queue: ${env.TEMPORAL_TASK_QUEUE}`);

    // Step 3: Start accepting tasks on the task queue
    await worker.run();
  } finally {
    // Close the connection once the worker has stopped
    await connection.close();
  }
}

// Only start the Temporal worker when this file is executed directly (e.g., `npx tsx worker.ts`)
// This prevents the worker from starting when the file is imported for testing or to use SentryActivityInterceptor
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((err) => {
    console.error(err);
    // Send worker startup error to Sentry before exiting
    Sentry.captureException(err, {
      tags: {
        service: 'temporal-worker',
        context: 'worker-startup',
      },
    });
    process.exit(1);
  });
}
