import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load environment variables
config();

// Use default DATABASE_URL for development if not set
const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
const databaseUrl = process.env.DATABASE_URL ?? (isDev ? 'postgresql://user:password@localhost:5432/accounting_dev' : '');

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
