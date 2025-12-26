import type { ConnectionOptions as TlsConnectionOptions } from 'node:tls';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { databaseConfig, getDatabaseUrl } from '../config/database.js';
import * as schema from './schema.js';

type PoolConfig = {
  min: number;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
};

type SslConfig = TlsConnectionOptions | boolean;

export interface DatabaseContext {
  client: ReturnType<typeof postgres>;
  db: ReturnType<typeof drizzle<typeof schema>>;
  close: () => Promise<void>;
}

export interface CreateDatabaseOptions {
  url?: string;
  pool?: Partial<PoolConfig>;
  ssl?: SslConfig;
  logger?: boolean;
}

function resolvePool(overrides?: Partial<PoolConfig>): PoolConfig {
  if (!overrides) {
    return databaseConfig.pool;
  }

  return {
    min: overrides.min ?? databaseConfig.pool.min,
    max: overrides.max ?? databaseConfig.pool.max,
    idleTimeoutMillis: overrides.idleTimeoutMillis ?? databaseConfig.pool.idleTimeoutMillis,
    connectionTimeoutMillis:
      overrides.connectionTimeoutMillis ?? databaseConfig.pool.connectionTimeoutMillis,
  };
}

function createClient(databaseUrl: string, pool: PoolConfig, ssl: SslConfig) {
  return postgres(databaseUrl, {
    max: pool.max,
    idle_timeout: pool.idleTimeoutMillis,
    connect_timeout: pool.connectionTimeoutMillis,
    ssl,
  });
}

function createDrizzle(
  client: ReturnType<typeof postgres>,
  logger: boolean
): ReturnType<typeof drizzle<typeof schema>> {
  return drizzle(client, {
    schema,
    logger,
  });
}

function createDatabaseContext(options: CreateDatabaseOptions = {}): DatabaseContext {
  const pool = resolvePool(options.pool);
  const ssl = options.ssl ?? databaseConfig.ssl;
  const url = options.url ?? getDatabaseUrl();
  const logger = options.logger ?? databaseConfig.logging;

  const client = createClient(url, pool, ssl);
  const db = createDrizzle(client, logger);

  return {
    client,
    db,
    close: async () => {
      await client.end();
    },
  };
}

const runtimeContext = createDatabaseContext();

/**
 * Main database instance using environment configuration
 */
export const db = runtimeContext.db;

/**
 * Database type for dependency injection
 */
export type Database = typeof db;
