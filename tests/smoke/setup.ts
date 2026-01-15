import { afterAll, beforeAll } from 'vitest';
import { type ServerResult, startServer } from './helpers/server.js';

// Global server instance for cleanup
let serverInstance: ServerResult | null = null;

beforeAll(async () => {
  // Determine mode from environment variable (default to dev)
  const mode = (process.env['SMOKE_MODE'] as 'dev' | 'build') || 'dev';
  const host = process.env['HOST'] || 'localhost';
  const port = parseInt(process.env['PORT'] || '3001', 10);

  console.log(`[SMOKE] Starting smoke test setup (mode: ${mode}, host: ${host}, port: ${port})`);

  try {
    serverInstance = await startServer({
      mode,
      host,
      port,
      timeoutMs: 30000, // 30s timeout
    });

    console.log('[SMOKE] Server started successfully at', serverInstance.url);
  } catch (error) {
    console.error('[SMOKE] ❌ CRITICAL: Failed to start server for smoke tests');
    console.error('[SMOKE] Error:', error);
    console.error('');
    console.error('[SMOKE] 🚨 SMOKE TESTS REQUIRE INFRASTRUCTURE TO BE RUNNING:');
    console.error('[SMOKE] 1. Start database: docker-compose up -d db');
    console.error('[SMOKE] 2. Start LocalStack: docker-compose up -d localstack');
    console.error('[SMOKE] 3. Start Temporal: temporal server start-dev');
    console.error('');
    console.error(
      '[SMOKE] 💡 Quick start all services: docker-compose up -d && temporal server start-dev'
    );

    // Clean up any partial server instance
    if (serverInstance) {
      try {
        serverInstance.cleanup();
      } catch (cleanupError) {
        console.error('[SMOKE] Failed to cleanup partial server:', cleanupError);
      }
    }

    // Force test failure - smoke tests must have working infrastructure
    throw new Error(
      `Smoke test setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}, 60000); // 60s timeout for setup

afterAll(() => {
  console.log('[SMOKE] Starting smoke test teardown');

  if (serverInstance) {
    serverInstance.cleanup();
    serverInstance = null;
    console.log('[SMOKE] Server stopped successfully');
  } else {
    console.log('[SMOKE] No server instance to clean up');
  }
}, 10000); // 10s timeout for teardown
