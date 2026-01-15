/**
 * Raw Extraction Zod schema for runtime validation
 * Used to validate JSONB raw extraction data from the database and API input
 */
import { z } from 'zod';

import { logger } from '../../../lib/logger.js';
import type {
  CompanyRegistration,
  OcrValueField,
  RawExtractionData,
} from './raw-extraction.types.js';

/**
 * Zod schema for company registration validation
 * Represents a single registration entry (VAT NUMBER, COMPANY REGISTRATION, etc.)
 */
const companyRegistrationSchema = z.object({
  type: z.string(),
  value: z.string(),
}) as z.ZodSchema<CompanyRegistration>;

/**
 * Zod schema for OCR value field validation
 * Mindee wraps extracted values in this structure
 */
const ocrValueFieldSchema = z.object({
  value: z.string().optional(),
}) as z.ZodSchema<OcrValueField>;

/**
 * Zod schema for RawExtractionData validation
 *
 * This schema validates the structure of OCR extraction data from Mindee API.
 * All fields are optional since not all documents contain all information.
 * It allows additional fields to pass through since the full OCR response
 * may contain more data than we explicitly type.
 */
export const rawExtractionSchema = z
  .object({
    /** Supplier/vendor name from the document */
    supplierName: ocrValueFieldSchema.optional(),
    /** Customer/buyer name from the document */
    customerName: ocrValueFieldSchema.optional(),
    /** Supplier's address from the document */
    supplierAddress: ocrValueFieldSchema.optional(),
    /** Customer's address from the document */
    customerAddress: ocrValueFieldSchema.optional(),
    /** Supplier's email address from the document */
    supplierEmail: ocrValueFieldSchema.optional(),
    /** Supplier's phone number from the document */
    supplierPhoneNumber: ocrValueFieldSchema.optional(),
    /** Supplier's company registration details (VAT, registration numbers, etc.) */
    supplierCompanyRegistrations: z.array(companyRegistrationSchema).optional(),
    /** Customer's company registration details (VAT, registration numbers, etc.) */
    customerCompanyRegistrations: z.array(companyRegistrationSchema).optional(),
  })
  .passthrough() as z.ZodSchema<RawExtractionData>; // Allow additional fields from the full OCR response

/**
 * Parse and validate an unknown value as RawExtractionData
 * Returns the validated RawExtractionData or null if invalid
 *
 * @param value - The value to parse (typically from JSONB column)
 * @returns The validated RawExtractionData or null if invalid/null
 */
export function parseRawExtraction(value: unknown): RawExtractionData | null {
  if (value === null || value === undefined) {
    return null;
  }

  // If it's not an object, it can't be valid extraction data
  if (typeof value !== 'object') {
    return null;
  }

  const result = rawExtractionSchema.safeParse(value);

  if (result.success) {
    return result.data;
  }

  // Log validation failure for debugging (data integrity issue)
  logger.warn(
    {
      context: 'raw-extraction.validation',
      errors: result.error.flatten().fieldErrors,
    },
    'Invalid raw extraction data in database'
  );

  return null;
}
