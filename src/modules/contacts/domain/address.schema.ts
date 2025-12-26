/**
 * Address Zod schema for runtime validation
 * Used to validate JSONB address data from the database
 */
import { z } from 'zod';

import { logger } from '../../../lib/logger.js';
import type { Address } from './address.types.js';

/**
 * Zod schema for Address validation
 * Matches the Address interface in address.types.ts
 *
 * IMPORTANT: addressLine is defined as "Required" in TR-2, meaning it must always
 * be present as a string field. However, it is allowed to be an empty string to
 * handle a known edge case:
 *
 * - VIES API can return valid, registered companies with an empty address field
 * - When this happens, we still want to create the contact (the VAT validation
 *   succeeded) rather than failing due to missing address data
 * - The empty address is stored for audit purposes and the contact can be
 *   enriched later
 *
 * For OCR-sourced data, addressLine typically contains the extracted address text.
 */
export const addressSchema = z.object({
  /** ISO 3166-1 alpha-2 country code (e.g., 'DE') - always required */
  countryCode: z.string().min(1, 'Country code is required'),
  /** City name - optional */
  city: z.string().optional(),
  /** Postal/ZIP code - optional */
  postalCode: z.string().optional(),
  /**
   * Full address line - must be present but empty string is allowed.
   * See schema comment above for why empty is permitted (VIES edge case).
   */
  addressLine: z.string(),
});

/**
 * Parse and validate an unknown value as an Address
 * Returns the validated Address or null if invalid
 *
 * @param value - The value to parse (typically from JSONB column)
 * @returns The validated Address or null if invalid/null
 */
export function parseAddress(value: unknown): Address | null {
  if (value === null || value === undefined) {
    return null;
  }

  const result = addressSchema.safeParse(value);

  if (result.success) {
    return result.data as Address;
  }

  // Log validation failure for debugging (data integrity issue)
  logger.warn(
    {
      context: 'address.validation',
      id: null,
      errors: result.error.flatten().fieldErrors,
    },
    'Invalid address data in database'
  );

  return null;
}
