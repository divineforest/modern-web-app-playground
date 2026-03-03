import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load environment variables
config();

// Use appropriate default DATABASE_URL based on NODE_ENV
const getDefaultDatabaseUrl = () => {
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'test') {
    return 'postgresql://user:password@localhost:5432/mercado_test';
  }
  if (!nodeEnv || nodeEnv === 'development') {
    return 'postgresql://user:password@localhost:5432/mercado_dev';
  }
  return ''; // Production/staging requires explicit DATABASE_URL
};

const databaseUrl = process.env.DATABASE_URL || getDefaultDatabaseUrl();

export default defineConfig({
  // Database dialect
  dialect: 'postgresql',

  // Schema files - all tables are managed by migrations
  schema: './src/db/schema.ts',

  // Output directory for migration files
  out: './src/db/migrations',

  // Database connection credentials
  dbCredentials: {
    url: databaseUrl,
  },

  // Migration configuration
  migrations: {
    table: 'drizzle_migrations',
    schema: 'public',
  },

  // Enable verbose logging for development
  verbose: process.env.NODE_ENV === 'development',

  // Enable strict mode for better type safety
  strict: true,

  // Introspection configuration
  introspect: {
    casing: 'camel',
  },
});
