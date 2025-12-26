import { env } from '../../../lib/env.js';
import { createModuleLogger } from '../../../lib/logger.js';
import { type CoreContactUpsert, createCoreSdk } from '../../../shared/data-access/core/index.js';
import {
  getContactsFromOdoo,
  type OdooContact,
  type OdooCredentials,
} from '../../../shared/data-access/odoo/index.js';

const logger = createModuleLogger('contacts-sync');

/**
 * Main sync function that gets contacts from Odoo and upserts them to core API
 */
async function syncContacts(
  companyId: string,
  odooCredentials: OdooCredentials
): Promise<{ processed: number }> {
  logger.info({ companyId }, 'Starting contacts sync');

  try {
    // Get contacts from Odoo via SDK
    const contacts = await getContactsFromOdoo(odooCredentials);
    logger.debug({ count: contacts.length }, 'Retrieved contacts from Odoo');

    let processed = 0;

    // Process contacts in batches
    const BATCH_SIZE = 200;
    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE);

      // Normalize contacts to upsert payloads
      const payloads = batch.map((contact) => normalizeContact(companyId, contact));

      // Upsert batch to target API via Core SDK
      const coreSdk = createCoreSdk();
      const upsertResult = await coreSdk.upsertContacts(payloads);
      logger.debug({ upsertResult }, 'Upserted batch to core API');

      processed += batch.length;
      logger.debug({ processed, batchSize: batch.length }, 'Processed batch');
    }

    logger.info({ processed }, 'Contacts sync completed successfully');
    return { processed };
  } catch (error) {
    logger.error({ error, companyId }, 'Contacts sync failed');
    throw error;
  }
}

/**
 * Convenience function that uses default configuration from environment variables
 */
export async function syncContactsWithDefaults(companyId: string): Promise<{ processed: number }> {
  const odooCredentials: OdooCredentials = {
    url: env.ODOO_URL,
    database: env.ODOO_DATABASE,
    username: env.ODOO_USERNAME,
    apiKey: env.ODOO_API_KEY,
  };

  return syncContacts(companyId, odooCredentials);
}

/**
 * Normalize Odoo contact to upsert payload format
 */
function normalizeContact(companyId: string, contact: OdooContact): CoreContactUpsert {
  return {
    company_id: companyId,
    source_system: 'odoo',
    source_id: contact.id.toString(),
    name: contact.name,
  };
}
