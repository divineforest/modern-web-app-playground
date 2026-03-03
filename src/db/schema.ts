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
    contactId: uuid('contact_id'),
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
    index('idx_invoices_status').on(table.status),
    index('idx_invoices_type').on(table.type),
    index('idx_invoices_issue_date').on(table.issueDate),
  ]
);

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;

/**
 * Orders table schema
 * Stores orders without foreign key dependencies (standalone entity)
 */
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    status: varchar('status', { length: 32 }).notNull().default('draft'),
    orderNumber: text('order_number').notNull(),
    referenceNumber: text('reference_number'),
    orderDate: date('order_date').notNull(),
    expectedDeliveryDate: date('expected_delivery_date'),
    currency: varchar('currency', { length: 3 }).notNull(),
    subtotal: text('subtotal').notNull(), // NUMERIC(15,2) stored as text for precision
    taxAmount: text('tax_amount').notNull().default('0.00'),
    discountAmount: text('discount_amount').notNull().default('0.00'),
    shippingAmount: text('shipping_amount').notNull().default('0.00'),
    totalAmount: text('total_amount').notNull(), // NUMERIC(15,2) stored as text for precision
    shippingAddress: text('shipping_address'),
    billingAddress: text('billing_address'),
    paymentTerms: varchar('payment_terms', { length: 64 }),
    notes: text('notes'),
    customerNotes: text('customer_notes'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    paymentTransactionId: text('payment_transaction_id'),
  },
  (table) => [
    check(
      'orders_status_check',
      sql`${table.status} IN ('draft', 'confirmed', 'processing', 'shipped', 'fulfilled', 'paid', 'cancelled')`
    ),
    uniqueIndex('idx_orders_order_number').on(table.orderNumber),
    index('idx_orders_status').on(table.status),
    index('idx_orders_order_date').on(table.orderDate),
    index('idx_orders_payment_transaction_id').on(table.paymentTransactionId),
  ]
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
