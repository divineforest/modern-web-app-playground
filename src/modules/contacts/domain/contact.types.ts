/**
 * Contact-related types for VIES API responses and internal domain logic
 */

/**
 * Entity type for contacts
 * - legal_entity: Company/business (default)
 * - individual: Natural person
 */
export type ContactEntityType = 'legal_entity' | 'individual';

/**
 * Source of contact data
 * - ocr: Data came from OCR extraction (Mindee)
 * - vies: Data came from VIES API validation
 */
export type ContactSource = 'ocr' | 'vies';

/**
 * VAT type for contacts
 * - eligible: Subject to VAT
 * - exempt: VAT exempt
 */
export type ContactVatType = 'eligible' | 'exempt';

/**
 * VIES API response registration info
 * @see https://vatcheckapi.com/docs/check.html
 */
export interface ViesRegistrationInfo {
  /** Whether the VAT is registered and valid */
  is_registered: boolean;
  /** Company/entity name from VIES */
  name: string;
  /** Registered address (unparsed, may contain newlines) */
  address: string;
  /** Parsed address parts (may be null if not available) */
  address_parts: string | null;
  /** Timestamp when the check was performed */
  checked_at: string;
}

/**
 * VIES API response from vatcheckapi.com
 * @see https://vatcheckapi.com/docs/check.html
 */
export interface ViesApiResponse {
  /** ISO 2-letter country code */
  country_code: string;
  /** VAT number without country prefix */
  vat_number: string;
  /** Whether the VAT format is valid */
  format_valid: boolean;
  /** Whether the VAT checksum is valid */
  checksum_valid: boolean;
  /** Registration information (present when lookup succeeds) */
  registration_info: ViesRegistrationInfo;
  /** Historical registration info (typically empty array) */
  registration_info_history?: unknown[];
}

/**
 * Comprehensive raw response from VIES API request for audit purposes.
 * Captures the full context of the API call including timing information.
 */
export interface ViesRawResponse {
  /** The normalized VAT ID that was validated */
  vatId: string;
  /** The API URL that was called */
  url: string;
  /** HTTP status code (undefined on network errors) */
  status: number | undefined;
  /** The response body (raw, could be ViesApiResponse or error object) */
  body: unknown;
  /** Timestamp when request started (ms since epoch) */
  startMs: number;
  /** Timestamp when request ended (ms since epoch) */
  endMs: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Human-readable start timestamp (ISO 8601 format) */
  start: string;
  /** Human-readable end timestamp (ISO 8601 format) */
  end: string;
  /** Human-readable duration (e.g., "123ms", "1.5s") */
  duration: string;
}

/**
 * Result of VIES validation
 */
export interface ViesValidationResult {
  /** Whether the validation was successful */
  success: boolean;
  /** Validated data (present when success is true) */
  data?: {
    /** Company name from VIES */
    name: string;
    /** Registered address from VIES */
    address: string;
    /** Country code from VIES */
    countryCode: string;
    /** Whether the VAT is registered */
    isRegistered: boolean;
  };
  /** Comprehensive raw VIES API response for audit purposes */
  rawResponse?: ViesRawResponse;
  /** Error message (present when success is false) */
  error?: string;
}

/**
 * Allowed sort fields for contact list
 */
export type ContactSortField = 'created_at' | 'updated_at' | 'name';

/**
 * Allowed sort directions
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sort configuration for contact list
 */
export interface ContactSort {
  field: ContactSortField;
  direction: SortDirection;
}

/**
 * Filter options for listing contacts
 */
export interface ContactListFilters {
  /** Filter by company ID (requires join with global_contacts_companies) */
  companyId?: string;
  /** Filter by company's Bob reference ID (alternative to companyId, requires join with companies table) */
  bobReferenceId?: string;
  /** Filter by role (only valid with companyId or bobReferenceId) */
  role?: 'customer' | 'supplier';
  /** Filter by data source */
  source?: ContactSource;
  /** Filter by VAT ID validation status */
  isValidVatId?: boolean;
  /** Filter by country code */
  countryCode?: string;
  /** Filter by entity type */
  entityType?: ContactEntityType;
  /** Filter contacts updated after this timestamp (exclusive) */
  updatedAtGt?: Date;
  /** Filter contacts updated before this timestamp (exclusive) */
  updatedAtLt?: Date;
}

/**
 * Cursor data for pagination
 */
export interface CursorData {
  /** Sort field used */
  sortField: ContactSortField;
  /** Sort direction used */
  sortDirection: SortDirection;
  /** Value of the sort field for the last item */
  sortValue: string | Date;
  /** ID of the last item (for tiebreaker) */
  id: string;
}

/**
 * Pagination options for contact list
 */
export interface ContactPaginationOptions {
  /** Sort configuration */
  sort: ContactSort;
  /** Cursor for pagination (base64 encoded) */
  cursor?: string | undefined;
  /** Maximum number of items to return (null = all) */
  limit?: number | null | undefined;
}

/**
 * Pagination metadata in response
 */
export interface ContactPaginationResult {
  /** Cursor for next page (null if no more results) */
  nextCursor: string | null;
  /** Whether there are more results */
  hasMore: boolean;
}
