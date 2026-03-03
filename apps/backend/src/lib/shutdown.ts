import * as Sentry from '@sentry/node';

/**
 * Gracefully shutdown with Sentry log flushing
 * Ensures all logs are sent to Sentry before process exits
 *
 * @param exitCode - Process exit code (0 for success, non-zero for errors)
 */
export async function shutdown(exitCode: number): Promise<never> {
  await Sentry.close(2000);
  process.exit(exitCode);
}
