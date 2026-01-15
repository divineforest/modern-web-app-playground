import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * Unified Database Schema
 * All tables are managed by this service and included in migrations.
 */

// =============================================================================
// Reference Tables
// =============================================================================

/**
 * Companies table schema
 * Stores company information for the practice management system
 */
export const companies = pgTable('companies', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name').notNull(),
  status: varchar('status').notNull().default('onboarding'),
  billingSettings: jsonb('billing_settings').notNull().default('{}'),
  billingAddress: text('billing_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  billingInboundToken: text('billing_inbound_token').notNull().unique(),
  bobReferenceId: varchar('bob_reference_id'),
  companyDetails: jsonb('company_details').notNull().default('{}'),
});

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;

/**
 * Users table schema
 * Stores user accounts and authentication data
 */
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  firstName: varchar('first_name').notNull(),
  lastName: varchar('last_name').notNull(),
  email: varchar('email').notNull().unique(),
  isAdmin: boolean('is_admin').default(false),
  password: varchar('password').notNull(),
  salt: varchar('salt').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  confirmedEmailAt: timestamp('confirmed_email_at', { withTimezone: true }),
  phone: varchar('phone', { length: 30 }),
  locale: varchar('locale', { length: 10 }).default('en-GB'),
  adminRole: varchar('admin_role'),
  adminCompanyIds: text('admin_company_ids').array(),
  config: jsonb('config').notNull().default('{}'),
  isOptedInToMarketing: boolean('is_opted_in_to_marketing').notNull().default(false),
  plainCustomerId: varchar('plain_customer_id'),
  plainLastSyncedAt: timestamp('plain_last_synced_at', { withTimezone: true }),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/**
 * Bob Contacts table schema
 * Stores contact records from the Bob system
 * Used to lookup bob_id when creating global contact relationships
 */
export const bobContacts = pgTable('bob_contacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull(),
  vatId: varchar('vat_id', { length: 20 }),
  bobId: varchar('bob_id', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type BobContact = typeof bobContacts.$inferSelect;
export type NewBobContact = typeof bobContacts.$inferInsert;

// =============================================================================
// Service Configuration Tables
// =============================================================================

/**
 * Service Types table schema
 * Reference table for categorizing types of accounting and financial services
 */
export const serviceTypes = pgTable(
  'service_types',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check('service_types_code_check', sql`${table.code} ~ '^[A-Z_]+$'`),
    check('service_types_status_check', sql`${table.status} IN ('active', 'deprecated')`),
  ]
);

export type ServiceType = typeof serviceTypes.$inferSelect;
export type NewServiceType = typeof serviceTypes.$inferInsert;

// =============================================================================
// Contact Management Tables
// =============================================================================

/**
 * Global Contacts table schema
 * Stores counterparty data from invoice extraction and VIES validation
 */
export const globalContacts = pgTable(
  'global_contacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    name: text('name').notNull(),
    email: text('email'),
    entityType: varchar('entity_type', { length: 32 }).notNull().default('legal_entity'),
    source: varchar('source', { length: 32 }).notNull(),
    phone: varchar('phone', { length: 50 }),
    vatId: varchar('vat_id', { length: 20 }),
    vatType: varchar('vat_type', { length: 32 }),
    taxNumber: varchar('tax_number', { length: 30 }),
    contactPerson: text('contact_person'),
    countryCode: varchar('country_code', { length: 2 }),
    billingAddress: jsonb('billing_address'),
    postalAddress: jsonb('postal_address'),
    rawExtraction: jsonb('raw_extraction'),
    rawViesResponse: jsonb('raw_vies_response'),
    isValidVatId: boolean('is_valid_vat_id').notNull().default(false),
    vatIdValidatedAt: timestamp('vat_id_validated_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'global_contacts_entity_type_check',
      sql`${table.entityType} IN ('legal_entity', 'individual')`
    ),
    check('global_contacts_source_check', sql`${table.source} IN ('ocr', 'vies')`),
    check(
      'global_contacts_vat_type_check',
      sql`${table.vatType} IS NULL OR ${table.vatType} IN ('eligible', 'exempt')`
    ),
    check(
      'global_contacts_vat_id_format_check',
      sql`${table.vatId} IS NULL OR ${table.vatId} ~ '^[A-Z]{2}[A-Z0-9]+$'`
    ),
    uniqueIndex('idx_global_contacts_vat_id')
      .on(table.vatId)
      .where(sql`${table.vatId} IS NOT NULL`),
    // Filter indexes for List Contacts API
    index('idx_global_contacts_country_code').on(table.countryCode),
    index('idx_global_contacts_source').on(table.source),
    index('idx_global_contacts_is_valid_vat_id').on(table.isValidVatId),
    index('idx_global_contacts_entity_type').on(table.entityType),
    // Pagination/sorting indexes for cursor-based pagination (sort field + id tiebreaker)
    index('idx_global_contacts_updated_at_id').on(table.updatedAt, table.id),
    index('idx_global_contacts_created_at_id').on(table.createdAt, table.id),
    index('idx_global_contacts_name_id').on(table.name, table.id),
  ]
);

export type GlobalContact = typeof globalContacts.$inferSelect;
export type NewGlobalContact = typeof globalContacts.$inferInsert;

/**
 * Global Contacts Companies join table schema
 * Many-to-many relationship between global contacts and companies with role attribute
 */
export const globalContactsCompanies = pgTable(
  'global_contacts_companies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    globalContactId: uuid('global_contact_id')
      .notNull()
      .references(() => globalContacts.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    role: varchar('role', { length: 32 }).notNull(),
    // Optional reference to Bob contact ID, populated when a matching bob_contacts record exists
    bobId: varchar('bob_id', { length: 100 }),
  },
  (table) => [
    check('global_contacts_companies_role_check', sql`${table.role} IN ('customer', 'supplier')`),
    uniqueIndex('idx_global_contacts_companies_unique').on(
      table.globalContactId,
      table.companyId,
      table.role
    ),
    // Composite index for company + role filtering (also covers company-only queries via leftmost prefix)
    index('idx_global_contacts_companies_company_role').on(table.companyId, table.role),
    index('idx_global_contacts_companies_contact_id').on(table.globalContactId),
  ]
);

export type GlobalContactCompany = typeof globalContactsCompanies.$inferSelect;
export type NewGlobalContactCompany = typeof globalContactsCompanies.$inferInsert;

/**
 * Global Contacts Documents join table schema
 * Many-to-many relationship between global contacts and documents for traceability
 */
export const globalContactsDocuments = pgTable(
  'global_contacts_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    globalContactId: uuid('global_contact_id')
      .notNull()
      .references(() => globalContacts.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    // External document ID reference (no FK as documents table is in core microservice)
    documentId: uuid('document_id').notNull(),
  },
  (table) => [
    // Prevent duplicate links (same contact and document)
    uniqueIndex('idx_global_contacts_documents_unique').on(table.globalContactId, table.documentId),
    // Index for efficient document lookups
    index('idx_global_contacts_documents_document_id').on(table.documentId),
    // Index for efficient contact lookups
    index('idx_global_contacts_documents_contact_id').on(table.globalContactId),
  ]
);

export type GlobalContactDocument = typeof globalContactsDocuments.$inferSelect;
export type NewGlobalContactDocument = typeof globalContactsDocuments.$inferInsert;

// =============================================================================
// Billing Tables
// =============================================================================

/**
 * Invoices table schema
 * Stores billing documents linked to companies and contacts
 */
export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    contactId: uuid('contact_id').references(() => globalContacts.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    type: varchar('type', { length: 32 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('draft'),
    invoiceNumber: text('invoice_number'),
    issueDate: date('issue_date'),
    dueDate: date('due_date'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    currency: varchar('currency', { length: 3 }),
    totalAmount: text('total_amount'), // NUMERIC(15,2) stored as text for precision
    description: text('description'),
  },
  (table) => [
    check('invoices_type_check', sql`${table.type} IN ('sales', 'purchase')`),
    check(
      'invoices_status_check',
      sql`${table.status} IN ('new', 'draft', 'sent', 'paid', 'overdue', 'cancelled')`
    ),
    uniqueIndex('idx_invoices_company_invoice_number')
      .on(table.companyId, table.invoiceNumber)
      .where(sql`${table.invoiceNumber} IS NOT NULL`),
    index('idx_invoices_company_id').on(table.companyId),
    index('idx_invoices_contact_id').on(table.contactId),
    index('idx_invoices_status').on(table.status),
    index('idx_invoices_type').on(table.type),
    index('idx_invoices_issue_date').on(table.issueDate),
  ]
);

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
