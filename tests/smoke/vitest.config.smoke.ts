import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/smoke/setup.ts'],
    include: ['tests/smoke/**/*.smoke.test.ts'],
    exclude: ['node_modules', 'dist', 'build'],

    // Extended timeouts for smoke tests (server startup takes time)
    testTimeout: 60000, // 60s per test
    hookTimeout: 60000, // 60s for setup/teardown

    // Smoke test environment - real server, not mocks
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:password@localhost:5432/accounting_test',
      LOG_LEVEL: 'error', // Reduce log noise in smoke tests
      PORT: process.env['SMOKE_PORT'] || '3001', // Use different port to avoid conflicts
      HOST: 'localhost',

      // Minimal required env vars for smoke test
      API_BEARER_TOKENS: 'smoke_test_token_12345',
      CORE_API_URL: 'http://localhost:4000',
      CORE_API_KEY: 'test-api-key',
      CORE_API_TIMEOUT: '5000',
      CORE_API_RETRY_ATTEMPTS: '2',
      CORE_API_RETRY_DELAY_MS: '100',
      VIES_API_KEY: 'test_vies_api_key',
      VIES_API_BASE_URL: 'https://api.vatcheckapi.com/v2',
      VIES_API_TIMEOUT: '5000',
      VIES_API_RETRY_ATTEMPTS: '0',
      VIES_API_RETRY_DELAY_MS: '100',
    },

    // No coverage for smoke tests (they're integration tests)
    coverage: {
      enabled: false,
    },
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
});
