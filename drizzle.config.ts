import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load environment variables
config();

export default defineConfig({
  // Database dialect
  dialect: 'postgresql',

  // Schema files - ONLY local tables that should be managed by migrations
  schema: './src/db/schema-local.ts',

  // Output directory for migration files
  out: './src/db/migrations',

  // Database connection credentials
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
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
