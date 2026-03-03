import { createEnv } from '@t3-oss/env-core';
import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file (optional in dev/test)
config();

// Check if we're in a development-like environment
const isDev = () => {
  const nodeEnv = process.env['NODE_ENV'];
  return !nodeEnv || nodeEnv === 'development' || nodeEnv === 'test';
};

/**
 * Helper that applies a default value only in development/test environments.
 * In production/staging, the field becomes required (no default).
 *
 * This enables:
 * - Local development without .env file (uses sensible defaults)
 * - Production/staging requires explicit configuration (fails fast if missing)
 */
const devDefault = <T extends z.ZodTypeAny>(schema: T, defaultValue: z.infer<T>): T => {
  return (isDev() ? schema.default(defaultValue) : schema) as T;
};

export const env = createEnv({
  /*
   * Server-side environment variables, not available on the client.
   * Will throw if you access these variables on the client.
   */
  server: {
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),

    // Database Configuration
    // Dev: Uses local PostgreSQL. Production: REQUIRED
    DATABASE_URL: devDefault(
      z.string().url().min(1),
      'postgresql://user:password@localhost:5432/accounting_dev'
    ),

    PORT: z.coerce.number().positive().default(3000),
    HOST: z.string().default('0.0.0.0'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    // JWT secret for token signing (optional, min 32 chars if provided)
    JWT_SECRET: z.string().min(32).optional(),

    // Core Microservice API Configuration
    // Dev: Points to localhost:4000 with dummy key. Production: REQUIRED
    CORE_API_URL: devDefault(z.string().url(), 'http://localhost:4000'),
    CORE_API_KEY: devDefault(z.string().min(1), 'dev-core-api-key'),
    CORE_API_TIMEOUT: z.coerce.number().positive().default(30000),
    CORE_API_RETRY_ATTEMPTS: z.coerce.number().positive().default(3),
    CORE_API_RETRY_DELAY_MS: z.coerce.number().positive().default(1000),

    // Temporal Workflow Orchestration
    TEMPORAL_ADDRESS: z.string().default('localhost:7233'),
    TEMPORAL_NAMESPACE: z.string().default('default'),
    TEMPORAL_TASK_QUEUE: z.string().default('default'),
    TEMPORAL_API_KEY: z.string().default('FAKE_TEMPORAL_API_KEY'),

    // Postmark Email Processing Limits
    POSTMARK_MAX_ATTACHMENT_SIZE: z.coerce.number().positive().default(10485760), // 10MB
    POSTMARK_MAX_TOTAL_ATTACHMENT_SIZE: z.coerce.number().positive().default(52428800), // 50MB

    // API Bearer Token Authentication
    // Dev: Uses dummy token. Production: REQUIRED (comma-separated list)
    API_BEARER_TOKENS: devDefault(z.string().min(1), 'dev-bearer-token-12345'),

    // Automatic Job Generation Configuration
    JOB_GENERATION_DUE_OFFSET_DAYS: z.coerce.number().positive().default(2),
    JOB_GENERATION_DUE_HOUR: z.coerce.number().min(0).max(23).default(17),
    JOB_GENERATION_BATCH_SIZE: z.coerce.number().positive().default(100),

    // VIES API (EU VAT validation)
    // Dev: Uses dummy key. Production: REQUIRED
    VIES_API_KEY: devDefault(z.string().min(1), 'dev-vies-api-key'),
    VIES_API_BASE_URL: z.string().url().default('https://api.vatcheckapi.com/v2'),
    VIES_API_TIMEOUT: z.coerce.number().positive().default(30000),
    VIES_API_RETRY_ATTEMPTS: z.coerce.number().nonnegative().default(2),
    VIES_API_RETRY_DELAY_MS: z.coerce.number().positive().default(1000),

    // AWS S3 Configuration
    // Dev: Configured for LocalStack. Production: Use real AWS credentials
    AWS_REGION: z.string().default('us-east-1'),
    AWS_ACCESS_KEY_ID: z.string().default('test'),
    AWS_SECRET_ACCESS_KEY: z.string().default('test'),
    S3_ENDPOINT: z.string().url().optional(), // Only needed for LocalStack
    S3_BUCKET_NAME: z.string().default('backend-accounting-documents'),
    S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),

    // Stripe Payment Configuration
    // Dev: Uses dummy secret. Production: REQUIRED
    STRIPE_WEBHOOK_SECRET: devDefault(z.string().min(1), 'whsec_test_secret'),
  },

  /*
   * Environment variables available on the client (and server).
   * Since this is a backend-only app, we don't have client vars,
   * but the clientPrefix is required by @t3-oss/env-core.
   */
  client: {},
  clientPrefix: 'PUBLIC_',

  /*
   * Due to how Next.js (and Vite) bundles environment variables on Edge and Client,
   * we need to manually destructure them to make sure all are included in bundle.
   *
   * 💡 You'll get type errors if not all variables from `server` & `client` are included here.
   */
  runtimeEnv: {
    NODE_ENV: process.env['NODE_ENV'],
    DATABASE_URL: process.env['DATABASE_URL'],
    PORT: process.env['PORT'],
    HOST: process.env['HOST'],
    LOG_LEVEL: process.env['LOG_LEVEL'],
    JWT_SECRET: process.env['JWT_SECRET'],
    CORE_API_URL: process.env['CORE_API_URL'],
    CORE_API_KEY: process.env['CORE_API_KEY'],
    CORE_API_TIMEOUT: process.env['CORE_API_TIMEOUT'],
    CORE_API_RETRY_ATTEMPTS: process.env['CORE_API_RETRY_ATTEMPTS'],
    CORE_API_RETRY_DELAY_MS: process.env['CORE_API_RETRY_DELAY_MS'],

    // Temporal Configuration
    TEMPORAL_ADDRESS: process.env['TEMPORAL_ADDRESS'],
    TEMPORAL_NAMESPACE: process.env['TEMPORAL_NAMESPACE'],
    TEMPORAL_TASK_QUEUE: process.env['TEMPORAL_TASK_QUEUE'],
    TEMPORAL_API_KEY: process.env['TEMPORAL_API_KEY'],

    POSTMARK_MAX_ATTACHMENT_SIZE: process.env['POSTMARK_MAX_ATTACHMENT_SIZE'],
    POSTMARK_MAX_TOTAL_ATTACHMENT_SIZE: process.env['POSTMARK_MAX_TOTAL_ATTACHMENT_SIZE'],

    API_BEARER_TOKENS: process.env['API_BEARER_TOKENS'],

    // Job Generation Configuration
    JOB_GENERATION_DUE_OFFSET_DAYS: process.env['JOB_GENERATION_DUE_OFFSET_DAYS'],
    JOB_GENERATION_DUE_HOUR: process.env['JOB_GENERATION_DUE_HOUR'],
    JOB_GENERATION_BATCH_SIZE: process.env['JOB_GENERATION_BATCH_SIZE'],

    // VIES API Configuration
    VIES_API_KEY: process.env['VIES_API_KEY'],
    VIES_API_BASE_URL: process.env['VIES_API_BASE_URL'],
    VIES_API_TIMEOUT: process.env['VIES_API_TIMEOUT'],
    VIES_API_RETRY_ATTEMPTS: process.env['VIES_API_RETRY_ATTEMPTS'],
    VIES_API_RETRY_DELAY_MS: process.env['VIES_API_RETRY_DELAY_MS'],

    // AWS / S3 Configuration
    AWS_REGION: process.env['AWS_REGION'],
    AWS_ACCESS_KEY_ID: process.env['AWS_ACCESS_KEY_ID'],
    AWS_SECRET_ACCESS_KEY: process.env['AWS_SECRET_ACCESS_KEY'],
    S3_ENDPOINT: process.env['S3_ENDPOINT'],
    S3_BUCKET_NAME: process.env['S3_BUCKET_NAME'],
    S3_FORCE_PATH_STYLE: process.env['S3_FORCE_PATH_STYLE'],

    // Stripe Configuration
    STRIPE_WEBHOOK_SECRET: process.env['STRIPE_WEBHOOK_SECRET'],
  },

  /*
   * By default, this library will feed the environment variables directly to
   * the Zod validator.
   *
   * This means that if you have an empty string for a value that is supposed
   * to be a number (e.g. `PORT=` in a ".env" file), Zod will incorrectly flag
   * it as a type mismatch violation. Additionally, if you have an empty string
   * for a value that is supposed to be a string with a default value (e.g.
   * `DOMAIN=` in an ".env" file), the default value will never be applied.
   *
   * In order to solve these issues, we recommend that all new projects
   * explicitly specify this option as true.
   */
  emptyStringAsUndefined: true,
});
