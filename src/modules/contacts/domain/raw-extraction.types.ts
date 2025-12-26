/**
 * Raw Extraction Types
 *
 * Type definitions for OCR extraction data from Mindee API.
 * These types define the structure of data received from the OCR provider
 * and used throughout the contacts module.
 */

/**
 * Company registration entry from OCR extraction.
 * Contains information about company registrations like VAT numbers,
 * company registration numbers, SIRET, etc.
 */
export interface CompanyRegistration {
  /** Type of registration (e.g., 'VAT NUMBER', 'COMPANY REGISTRATION', 'SIRET') */
  type: string;
  /** Registration value */
  value: string;
}

/**
 * Value object from OCR extraction.
 * Mindee returns many extracted values wrapped in this structure.
 */
export interface OcrValueField {
  /** The extracted value, undefined if not found in the document */
  value?: string;
}

/**
 * Raw extraction data from Mindee OCR.
 *
 * This interface defines the structure of the extraction data
 * received from the Mindee Invoice API. It contains contact information
 * for both the supplier and customer on the invoice.
 *
 * @see https://developers.mindee.com/docs/invoice-ocr
 */
export interface RawExtractionData {
  /** Supplier/vendor name from the document */
  supplierName?: OcrValueField;

  /** Customer/buyer name from the document */
  customerName?: OcrValueField;

  /** Supplier's address from the document */
  supplierAddress?: OcrValueField;

  /** Customer's address from the document */
  customerAddress?: OcrValueField;

  /** Supplier's email address from the document */
  supplierEmail?: OcrValueField;

  /** Supplier's phone number from the document */
  supplierPhoneNumber?: OcrValueField;

  /** Supplier's company registration details (VAT, registration numbers, etc.) */
  supplierCompanyRegistrations?: CompanyRegistration[];

  /** Customer's company registration details (VAT, registration numbers, etc.) */
  customerCompanyRegistrations?: CompanyRegistration[];
}

/**
 * Registration type constants used in company registrations
 */
export const RegistrationTypes = {
  VAT_NUMBER: 'VAT NUMBER',
  COMPANY_REGISTRATION: 'COMPANY REGISTRATION',
  TAX_NUMBER: 'TAX NUMBER',
  SIRET: 'SIRET',
} as const;
