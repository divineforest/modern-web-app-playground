import type { Database } from '../../src/db/index.js';
import { db, serviceTypes } from '../../src/db/index.js';
import type { ServiceType } from '../../src/db/schema.js';

/**
 * Get the first available service type from the database
 * Useful for tests that need a valid service type reference
 */
export async function getFirstServiceType(database: Database = db): Promise<ServiceType> {
  const [serviceType] = await database.select().from(serviceTypes).limit(1);

  if (!serviceType) {
    throw new Error('No service types found in database. Please ensure service types are seeded.');
  }

  return serviceType;
}
