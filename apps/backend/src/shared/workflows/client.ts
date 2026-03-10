/**
 * Temporal Workflow Configuration and Client Setup
 *
 * Central configuration for Temporal client and workflow orchestration
 */
import { Client, Connection } from '@temporalio/client';
import { env } from '../../lib/env.js';

/**
 * Create and configure the Temporal client
 */
export async function createTemporalClient(): Promise<Client> {
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

  const connection = await Connection.connect(connectionOptions);

  const client = new Client({
    connection,
    namespace: env.TEMPORAL_NAMESPACE,
  });

  return client;
}

/**
 * Default task queue for workflows
 */
export const TASK_QUEUE = env.TEMPORAL_TASK_QUEUE;
