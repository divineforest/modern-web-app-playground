import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  jsonb,
  numeric,
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
// Billing Tables
// =============================================================================

/**
 * Orders table schema
 * Stores orders without foreign key dependencies (standalone entity)
 * Also used for carts (status='cart') with userId or cartToken for identification
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
    userId: uuid('user_id'),
    cartToken: uuid('cart_token'),
  },
  (table) => [
    check(
      'orders_status_check',
      sql`${table.status} IN ('draft', 'confirmed', 'processing', 'shipped', 'fulfilled', 'paid', 'cancelled', 'cart')`
    ),
    uniqueIndex('idx_orders_order_number').on(table.orderNumber),
    uniqueIndex('idx_orders_cart_token')
      .on(table.cartToken)
      .where(sql`${table.cartToken} IS NOT NULL`),
    index('idx_orders_status').on(table.status),
    index('idx_orders_order_date').on(table.orderDate),
    index('idx_orders_payment_transaction_id').on(table.paymentTransactionId),
    index('idx_orders_user_id').on(table.userId),
  ]
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

// =============================================================================
// Product Tables
// =============================================================================

/**
 * Products table schema
 * Stores product catalog for the e-commerce system
 */
export const products = pgTable(
  'products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    status: varchar('status', { length: 32 }).notNull().default('draft'),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    sku: text('sku').notNull(),
    description: text('description'),
    shortDescription: text('short_description'),
    category: text('category'),
    tags: jsonb('tags').$type<string[] | null>(),
    imageUrl: text('image_url'),
    currency: varchar('currency', { length: 3 }).notNull(),
    price: numeric('price', { precision: 15, scale: 2 }).notNull(),
    compareAtPrice: numeric('compare_at_price', { precision: 15, scale: 2 }),
    costPrice: numeric('cost_price', { precision: 15, scale: 2 }),
    weight: numeric('weight', { precision: 15, scale: 2 }),
    width: numeric('width', { precision: 15, scale: 2 }),
    height: numeric('height', { precision: 15, scale: 2 }),
    length: numeric('length', { precision: 15, scale: 2 }),
  },
  (table) => [
    check('products_status_check', sql`${table.status} IN ('draft', 'active', 'archived')`),
    uniqueIndex('idx_products_sku').on(table.sku),
    uniqueIndex('idx_products_slug').on(table.slug),
    index('idx_products_status').on(table.status),
    index('idx_products_category').on(table.category),
  ]
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

/**
 * Order items table schema
 * Stores individual line items for orders and carts
 * Snapshots product details at the time of addition for historical accuracy
 */
export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    quantity: numeric('quantity', { precision: 10, scale: 0 }).notNull(),
    unitPrice: numeric('unit_price', { precision: 15, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    productName: text('product_name').notNull(),
    productSku: text('product_sku').notNull(),
    productImageUrl: text('product_image_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check('order_items_quantity_check', sql`${table.quantity}::int > 0`),
    uniqueIndex('idx_order_items_order_product').on(table.orderId, table.productId),
    index('idx_order_items_order_id').on(table.orderId),
  ]
);

export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
