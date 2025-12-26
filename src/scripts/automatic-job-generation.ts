#!/usr/bin/env node

// Import Sentry instrumentation first to capture logs
import '../instrument.js';
import { logger } from '../lib/logger.js';
import { shutdown } from '../lib/shutdown.js';
import { automaticJobGenerationService } from '../modules/practice-management';

/**
 * Generate execution ID for tracking and logging
 * Format: auto-job-gen-YYYY-MM-DDTHH:MM:SSZ
 */
function generateExecutionId(): string {
  const now = new Date();
  return `auto-job-gen-${now.toISOString()}`;
}

/**
 * Main entry point for daily automatic job generation
 *
 * This script is designed to be executed by Render cron jobs at 02:00 UTC daily.
 * It discovers eligible companies with approved billing periods and creates
 * corresponding jobs automatically.
 *
 * Usage:
 * - Via Render cron job (recommended): node dist/scripts/automatic-job-generation.js
 * - Manual execution: npm run job:generate
 *
 * Exit codes:
 * - 0: Success
 * - 1: Configuration or critical error
 * - 2: Job generation execution failed
 */
async function main(): Promise<void> {
  const executionId = generateExecutionId();
  const executionDate = new Date().toISOString();

  logger.info(
    {
      executionId,
      executionDate,
    },
    'Starting automatic job generation'
  );

  try {
    // Execute the automatic job generation process
    const statistics = await automaticJobGenerationService.executeJobGeneration({ executionId });

    // Log successful completion with statistics
    logger.info(
      {
        executionId,
        executionDate,
        statistics,
      },
      'Completed automatic job generation successfully'
    );

    // Output human-readable summary for console/Render logs
    console.log(`✅ Automatic job generation completed successfully`);
    console.log(`📊 Execution ID: ${executionId}`);
    console.log(`📈 Statistics:`);
    console.log(`   - Companies processed: ${statistics.companiesProcessed}`);
    console.log(`   - Periods discovered: ${statistics.periodsDiscovered}`);
    console.log(`   - Jobs created: ${statistics.jobsCreated}`);
    console.log(`   - Jobs failed: ${statistics.jobsFailed}`);
    console.log(`   - Execution duration: ${(statistics.executionDurationMs / 1000).toFixed(2)}s`);

    // Exit with success code
    await shutdown(0);
  } catch (error) {
    // Log the error with full context
    logger.error(
      {
        executionId,
        executionDate,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      'Automatic job generation failed'
    );

    // Output human-readable error for console/Render logs
    console.error('❌ Automatic job generation failed');
    console.error(`🔍 Execution ID: ${executionId}`);
    console.error(`📅 Execution date: ${executionDate}`);
    console.error(`💥 Error: ${error instanceof Error ? error.message : 'Unknown error'}`);

    if (error instanceof Error && error.stack) {
      console.error(`📋 Stack trace: ${error.stack}`);
    }

    // Exit with failure code
    await shutdown(2);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error(
    {
      reason,
      promise,
    },
    'Unhandled promise rejection in automatic job generation'
  );
  console.error('❌ Unhandled promise rejection:', reason);
  void shutdown(2);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(
    {
      error: error.message,
      stack: error.stack,
    },
    'Uncaught exception in automatic job generation'
  );
  console.error('❌ Uncaught exception:', error.message);
  void shutdown(2);
});

// Execute the main function
main().catch(async (error) => {
  logger.error({ error }, 'Failed to start automatic job generation');
  console.error('❌ Failed to start automatic job generation:', error);
  await shutdown(1);
});
