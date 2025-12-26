import { boolean, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Core microservice tables
 * These tables are managed by the core microservice and should NOT be included in migrations.
 * They are defined here only for type-safe querying with Drizzle ORM.
 */

/**
 * Companies table schema
 * Managed by the core microservice - DO NOT MIGRATE
 *
 * Note: Timestamp columns do not include { withTimezone: true } configuration
 * because this table is owned and managed by another microservice. Any schema
 * changes, including timezone configuration, are out of scope for this service.
 */
export const companies = pgTable('companies', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name').notNull(),
  status: varchar('status').notNull().default('onboarding'),
  billingSettings: jsonb('billing_settings').notNull().default('{}'),
  billingAddress: text('billing_address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  billingInboundToken: text('billing_inbound_token').notNull().unique(),
  bobReferenceId: varchar('bob_reference_id'),
  companyDetails: jsonb('company_details').notNull().default('{}'),
});

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;

/**
 * Billing Periods table schema
 * Managed by the core microservice - DO NOT MIGRATE
 *
 * Note: Timestamp columns do not include { withTimezone: true } configuration
 * because this table is owned and managed by another microservice. Any schema
 * changes, including timezone configuration, are out of scope for this service.
 */
export const billingPeriods = pgTable('billing_periods', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
  startDate: timestamp('start_date').defaultNow().notNull(),
  endDate: timestamp('end_date').defaultNow().notNull(),
  isApproved: varchar('is_approved', { length: 10 }).notNull().default('false'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type BillingPeriod = typeof billingPeriods.$inferSelect;
export type NewBillingPeriod = typeof billingPeriods.$inferInsert;

/**
 * Users table schema
 * Managed by the core microservice - DO NOT MIGRATE
 *
 * Note: Timestamp columns do not include { withTimezone: true } configuration
 * because this table is owned and managed by another microservice. Any schema
 * changes, including timezone configuration, are out of scope for this service.
 */
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  firstName: varchar('first_name').notNull(),
  lastName: varchar('last_name').notNull(),
  email: varchar('email').notNull().unique(),
  isAdmin: boolean('is_admin').default(false),
  password: varchar('password').notNull(),
  salt: varchar('salt').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  confirmedEmailAt: timestamp('confirmed_email_at'),
  phone: varchar('phone', { length: 30 }),
  locale: varchar('locale', { length: 10 }).default('en-GB'),
  adminRole: varchar('admin_role'),
  adminCompanyIds: text('admin_company_ids').array(),
  config: jsonb('config').notNull().default('{}'),
  isOptedInToMarketing: boolean('is_opted_in_to_marketing').notNull().default(false),
  plainCustomerId: varchar('plain_customer_id'),
  plainLastSyncedAt: timestamp('plain_last_synced_at'),
});

/**
 * Bob Contacts table schema
 * Managed by the core microservice - DO NOT MIGRATE
 *
 * This table stores contact records from the Bob system.
 * Used to lookup bob_id when creating global contact relationships.
 *
 * Note: Timestamp columns do not include { withTimezone: true } configuration
 * because this table is owned and managed by another microservice. Any schema
 * changes, including timezone configuration, are out of scope for this service.
 */
export const bobContacts = pgTable('bob_contacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull(),
  vatId: varchar('vat_id', { length: 20 }),
  bobId: varchar('bob_id', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type BobContact = typeof bobContacts.$inferSelect;
export type NewBobContact = typeof bobContacts.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
