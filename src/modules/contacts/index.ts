// API exports
export { registerContactsRoutes } from './api/contacts.routes.js';

// Domain exports
export type { Address } from './domain/address.types.js';
export type {
  Contact,
  ContactResponse,
  GlobalContact,
  NewGlobalContact,
} from './domain/contact.entity.js';
export type {
  ContactEntityType,
  ContactSource,
  ContactVatType,
  ViesApiResponse,
  ViesValidationResult,
} from './domain/contact.types.js';
export type { ContactCompanyRole } from './domain/global-contact-company.types.js';
// Raw extraction types (Mindee OCR data structure)
export type {
  CompanyRegistration,
  OcrValueField,
  RawExtractionData,
} from './domain/raw-extraction.types.js';
// Service exports
export type {
  ContactResolveResult,
  ContactResolverOptions,
  FromOcrInput,
  OcrContactInput,
  ResolveFromExtractionOptions,
} from './services/contact-resolver.service.js';
// Raw extraction parser exports
export type {
  ContactRole,
  ParsedContactData,
} from './services/raw-extraction-parser.service.js';
export type { ViesServiceConfig } from './services/vies.service.js';
