import { z } from 'zod';

/**
 * Order status enum
 */
const orderStatusEnum = [
  'draft',
  'confirmed',
  'processing',
  'shipped',
  'fulfilled',
  'paid',
  'cancelled',
] as const;
export type OrderStatus = (typeof orderStatusEnum)[number];

/**
 * Validation schema for order status
 */
export const orderStatusSchema = z.enum(orderStatusEnum);

/**
 * Validation schema for order ID
 */
export const orderIdSchema = z.string().uuid('Invalid order ID');

/**
 * Validation schema for order number
 */
const orderNumberSchema = z.string().min(1, 'Order number is required');

/**
 * Validation schema for reference number
 */
const referenceNumberSchema = z.string().nullable().optional();

/**
 * Validation schema for order date
 * Note: stored as DATE in postgres, comes back as string
 */
const orderDateSchema = z.string().min(1, 'Order date is required');

/**
 * Validation schema for expected delivery date
 * Note: stored as DATE in postgres, comes back as string
 */
const expectedDeliveryDateSchema = z.string().nullable().optional();

/**
 * Validation schema for currency (ISO 4217 code)
 */
const currencySchema = z.string().length(3, 'Currency must be a 3-letter ISO code');

/**
 * Validation schema for monetary amounts
 * Uses union to handle null before coercion (z.coerce runs before .nullable())
 */
const monetaryAmountSchema = z
  .union([
    z.null(),
    z.coerce
      .number()
      .min(0, 'Amount must be non-negative')
      .transform((val) => val.toFixed(2)),
  ])
  .optional();

/**
 * Validation schema for required monetary amounts
 */
const requiredMonetaryAmountSchema = z.coerce
  .number()
  .min(0, 'Amount must be non-negative')
  .transform((val) => val.toFixed(2));

/**
 * Validation schema for shipping address
 */
const shippingAddressSchema = z.string().nullable().optional();

/**
 * Validation schema for billing address
 */
const billingAddressSchema = z.string().nullable().optional();

/**
 * Validation schema for payment terms
 */
const paymentTermsSchema = z.string().max(64).nullable().optional();

/**
 * Validation schema for notes
 */
const notesSchema = z.string().nullable().optional();

/**
 * Validation schema for customer notes
 */
const customerNotesSchema = z.string().nullable().optional();

/**
 * Complete validation schema for creating an order
 */
export const createOrderSchema = z.object({
  status: orderStatusSchema.default('draft'),
  orderNumber: orderNumberSchema,
  referenceNumber: referenceNumberSchema,
  orderDate: orderDateSchema,
  expectedDeliveryDate: expectedDeliveryDateSchema,
  currency: currencySchema,
  subtotal: requiredMonetaryAmountSchema,
  taxAmount: z
    .union([
      z.null(),
      z.coerce
        .number()
        .min(0, 'Amount must be non-negative')
        .transform((val) => val.toFixed(2)),
    ])
    .optional()
    .default(null)
    .transform((val) => (val === null ? '0.00' : val)),
  discountAmount: z
    .union([
      z.null(),
      z.coerce
        .number()
        .min(0, 'Amount must be non-negative')
        .transform((val) => val.toFixed(2)),
    ])
    .optional()
    .default(null)
    .transform((val) => (val === null ? '0.00' : val)),
  shippingAmount: z
    .union([
      z.null(),
      z.coerce
        .number()
        .min(0, 'Amount must be non-negative')
        .transform((val) => val.toFixed(2)),
    ])
    .optional()
    .default(null)
    .transform((val) => (val === null ? '0.00' : val)),
  totalAmount: requiredMonetaryAmountSchema,
  shippingAddress: shippingAddressSchema,
  billingAddress: billingAddressSchema,
  paymentTerms: paymentTermsSchema,
  notes: notesSchema,
  customerNotes: customerNotesSchema,
});

/**
 * Validation schema for updating an order (all fields optional)
 */
export const updateOrderSchema = z.object({
  status: orderStatusSchema.optional(),
  orderNumber: orderNumberSchema.optional(),
  referenceNumber: referenceNumberSchema,
  orderDate: orderDateSchema.optional(),
  expectedDeliveryDate: expectedDeliveryDateSchema,
  currency: currencySchema.optional(),
  subtotal: monetaryAmountSchema.optional(),
  taxAmount: monetaryAmountSchema.optional(),
  discountAmount: monetaryAmountSchema.optional(),
  shippingAmount: monetaryAmountSchema.optional(),
  totalAmount: monetaryAmountSchema.optional(),
  shippingAddress: shippingAddressSchema,
  billingAddress: billingAddressSchema,
  paymentTerms: paymentTermsSchema,
  notes: notesSchema,
  customerNotes: customerNotesSchema,
});

/**
 * Validation schema for listing orders query parameters
 */
export const listOrdersQuerySchema = z.object({
  status: orderStatusSchema.optional(),
});

/**
 * Type for create order input (before Zod transforms)
 * Uses z.input to get the type before transforms are applied
 */
export type CreateOrderInput = z.input<typeof createOrderSchema>;

/**
 * Type for create order output (after Zod transforms)
 * Used internally after validation
 */
export type CreateOrderOutput = z.infer<typeof createOrderSchema>;

/**
 * Type for update order input (before Zod transforms)
 */
export type UpdateOrderInput = z.input<typeof updateOrderSchema>;

/**
 * Type for update order output (after Zod transforms)
 */
export type UpdateOrderOutput = z.infer<typeof updateOrderSchema>;

/**
 * Type for list orders query
 */
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
