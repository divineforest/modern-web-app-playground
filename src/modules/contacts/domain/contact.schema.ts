/**
 * Contact Zod schemas for runtime validation
 * Used to validate enum fields from the database
 */
import { z } from 'zod';

import { createModuleLogger } from '../../../lib/logger.js';
import type { ContactEntityType, ContactSource, ContactVatType } from './contact.types.js';

const logger = createModuleLogger('contact-schema');

/**
 * Zod schema for ContactEntityType validation
 */
const contactEntityTypeSchema = z.enum(['legal_entity', 'individual']);

/**
 * Zod schema for ContactSource validation
 */
const contactSourceSchema = z.enum(['ocr', 'vies']);

/**
 * Zod schema for ContactVatType validation
 */
const contactVatTypeSchema = z.enum(['eligible', 'exempt']);

/**
 * Parse and validate a value as ContactEntityType
 * Returns the validated type or throws on invalid data
 *
 * @param value - The value to parse (typically from database column)
 * @returns The validated ContactEntityType
 * @throws ZodError if the value is not a valid ContactEntityType
 */
export function parseContactEntityType(value: unknown): ContactEntityType {
  return contactEntityTypeSchema.parse(value);
}

/**
 * Parse and validate a value as ContactSource
 * Returns the validated type or throws on invalid data
 *
 * @param value - The value to parse (typically from database column)
 * @returns The validated ContactSource
 * @throws ZodError if the value is not a valid ContactSource
 */
export function parseContactSource(value: unknown): ContactSource {
  return contactSourceSchema.parse(value);
}

/**
 * Safely parse a value as ContactVatType or null
 * Returns the validated type, null if invalid
 *
 * @param value - The value to parse
 * @returns The validated ContactVatType or null
 */
export function parseContactVatTypeSafe(value: unknown): ContactVatType | null {
  if (value === null || value === undefined) {
    return null;
  }
  const result = contactVatTypeSchema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  logger.warn({ value }, 'Invalid vatType in database');
  return null;
}
