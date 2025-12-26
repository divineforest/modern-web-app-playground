#!/usr/bin/env tsx

// Import Sentry instrumentation first to capture logs
import '../instrument.js';
import { createModuleLogger } from '../lib/logger.js';
import { shutdown } from '../lib/shutdown.js';
import { syncContactsWithDefaults } from '../modules/contacts-sync/index.js';

const logger = createModuleLogger('contacts-sync-cli');

/**
 * CLI script to run contacts sync
 * Usage: npm run sync:contacts <companyId>
 *
 * Environment variables required:
 * - ODOO_URL: Odoo instance URL
 * - ODOO_DATABASE: Odoo database name
 * - ODOO_USERNAME: Odoo username
 * - ODOO_API_KEY: Odoo API key
 */
async function main() {
  const args = process.argv.slice(2);
  const companyIdArg = args[0];

  if (!companyIdArg) {
    logger.error('Company ID is required');
    console.error('Usage: npm run sync:contacts <companyId>');
    console.error('');
    console.error('Environment variables required:');
    console.error('  ODOO_URL - Odoo instance URL');
    console.error('  ODOO_DATABASE - Odoo database name');
    console.error('  ODOO_USERNAME - Odoo username');
    console.error('  ODOO_API_KEY - Odoo API key');
    await shutdown(1);
  }

  // TypeScript doesn't infer that shutdown() never returns, so we assert the type is narrowed
  const companyId = companyIdArg as string;

  logger.info({ companyId }, 'Starting contacts sync CLI');

  try {
    const result = await syncContactsWithDefaults(companyId);
    logger.info(result, 'Contacts sync completed successfully');
    console.log(`✅ Successfully processed ${result.processed} contacts for company ${companyId}`);
    await shutdown(0);
  } catch (error) {
    logger.error({ error, companyId }, 'Contacts sync failed');
    console.error(
      `❌ Contacts sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    await shutdown(1);
  }
}

// Run the script
main().catch(async (error) => {
  logger.error({ error }, 'Unhandled error in contacts sync CLI');
  console.error(`❌ Unhandled error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  await shutdown(1);
});
