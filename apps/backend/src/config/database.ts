import { env } from '../lib/env.js';

/**
 * Database configuration derived from environment variables.
 * All values are type-safe and validated at runtime by @t3-oss/env-core + Zod.
 */

const runtimeDatabaseUrl = env.DATABASE_URL;

const migrationsConfig = {
  directory: './src/db/migrations',
  tableName: 'drizzle_migrations',
} as const;

const runtimeLogging = env.NODE_ENV === 'development' || env.LOG_LEVEL === 'debug';

const runtimePoolConfig = {
  min: env.NODE_ENV === 'production' ? 2 : 1,
  max: env.NODE_ENV === 'production' ? 10 : 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
} as const;

const runtimeSslConfig =
  env.NODE_ENV === 'staging' || env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false;

export const databaseConfig = {
  /**
   * PostgreSQL connection URL with full connection parameters
   */
  url: runtimeDatabaseUrl,

  /**
   * Connection pool configuration
   */
  pool: runtimePoolConfig,

  /**
   * Migration configuration
   */
  migrations: migrationsConfig,

  /**
   * Database-specific logging
   */
  logging: runtimeLogging,

  /**
   * SSL configuration - enable for staging and production environments
   */
  ssl: runtimeSslConfig,
} as const;

/**
 * Get database URL based on environment
 */
export function getDatabaseUrl(): string {
  return runtimeDatabaseUrl;
}
