import type { Database } from '../../src/db/index.js';
import { db, jobTemplates } from '../../src/db/index.js';
import type { JobTemplate, NewJobTemplate } from '../../src/db/schema-local.js';

/**
 * Build test job template data with default values that can be overridden
 * Use this when you only need the data structure, not a database record
 */
export function buildTestJobTemplateData(overrides: Partial<NewJobTemplate> = {}): NewJobTemplate {
  const timestamp = Date.now();
  const random = Math.random();

  return {
    code: overrides.code || `TEST_CODE_${timestamp}_${random}`.toUpperCase().replace(/\./g, '_'),
    name: overrides.name || 'Test Job Template',
    description: overrides.description !== undefined ? overrides.description : 'Test description',
    isActive: overrides.isActive || 'true',
    serviceTypeId: overrides.serviceTypeId !== undefined ? overrides.serviceTypeId : null,
    defaultAssigneeId: overrides.defaultAssigneeId || null,
    titlePattern: overrides.titlePattern || 'Test Job - {company_name}',
    ...overrides,
  };
}

/**
 * Create a test job template record in the database with default values that can be overridden
 */
export async function createTestJobTemplate(
  overrides: Partial<NewJobTemplate> = {},
  database: Database = db
): Promise<JobTemplate> {
  const jobTemplateData = buildTestJobTemplateData(overrides);
  const [jobTemplate] = await database.insert(jobTemplates).values(jobTemplateData).returning();

  if (!jobTemplate) {
    throw new Error('Failed to create test job template');
  }

  return jobTemplate;
}

/**
 * Create multiple test job template records in the database with unique codes
 */
export async function createTestJobTemplates(
  count: number,
  overrides: Partial<NewJobTemplate> = {},
  database: Database = db
): Promise<JobTemplate[]> {
  const result: JobTemplate[] = [];

  for (let index = 0; index < count; index++) {
    const timestamp = Date.now();
    const random = Math.random();
    const jobTemplateData = buildTestJobTemplateData({
      code: `TEST_CODE_${timestamp}_${index}_${random}`.toUpperCase().replace(/\./g, '_'),
      name: `Test Job Template ${index + 1}`,
      ...overrides,
    });
    const [jobTemplate] = await database.insert(jobTemplates).values(jobTemplateData).returning();

    if (!jobTemplate) {
      throw new Error(`Failed to create test job template ${index + 1}`);
    }

    result.push(jobTemplate);
  }

  return result;
}
