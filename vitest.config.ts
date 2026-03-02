import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup/env.ts', './vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', 'build'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:password@localhost:5432/accounting_test',
      PORT: '3000',
      LOG_LEVEL: 'error', // Reduce log noise in tests
      CORE_API_URL: 'http://localhost:4000',
      CORE_API_KEY: 'test-api-key',
      CORE_API_TIMEOUT: '5000',
      CORE_API_RETRY_ATTEMPTS: '2',
      CORE_API_RETRY_DELAY_MS: '100',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'build/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/coverage/**',
        'src/mocks/**',
        'vitest.setup.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
});
