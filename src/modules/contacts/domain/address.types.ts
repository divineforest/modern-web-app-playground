/**
 * Address types for contact billing and postal addresses
 * Used for storing structured address data from OCR extraction and VIES validation
 */

/**
 * Structured address data
 * All addresses use addressLine for the full address string
 */
export interface Address {
  /** ISO 3166-1 alpha-2 country code (e.g., 'DE') - always required */
  countryCode: string;
  /** City name - optional */
  city?: string;
  /** Postal/ZIP code - optional */
  postalCode?: string;
  /** Full address line - required */
  addressLine: string;
}
