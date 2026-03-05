import { z } from 'zod';

const orderStatusEnum = [
  'draft',
  'confirmed',
  'processing',
  'shipped',
  'fulfilled',
  'paid',
  'cancelled',
  'cart',
] as const;
export type OrderStatus = (typeof orderStatusEnum)[number];

export const orderStatusSchema = z.enum(orderStatusEnum);

export const orderIdSchema = z.string().uuid('Invalid order ID');

const orderNumberSchema = z.string().min(1, 'Order number is required');

const referenceNumberSchema = z.string().nullable().optional();

const orderDateSchema = z.string().min(1, 'Order date is required');

const expectedDeliveryDateSchema = z.string().nullable().optional();

const currencySchema = z.string().length(3, 'Currency must be a 3-letter ISO code');

const monetaryAmountSchema = z
  .union([
    z.null(),
    z.coerce
      .number()
      .min(0, 'Amount must be non-negative')
      .transform((val) => val.toFixed(2)),
  ])
  .optional();

const requiredMonetaryAmountSchema = z.coerce
  .number()
  .min(0, 'Amount must be non-negative')
  .transform((val) => val.toFixed(2));

const shippingAddressSchema = z.string().nullable().optional();

const billingAddressSchema = z.string().nullable().optional();

const paymentTermsSchema = z.string().max(64).nullable().optional();

const notesSchema = z.string().nullable().optional();

const customerNotesSchema = z.string().nullable().optional();

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

export const listOrdersQuerySchema = z.object({
  status: orderStatusSchema.optional(),
});

export const orderResponseSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  status: orderStatusSchema,
  orderNumber: z.string(),
  referenceNumber: z.string().nullable(),
  orderDate: z.string(),
  expectedDeliveryDate: z.string().nullable(),
  currency: z.string(),
  subtotal: z.string(),
  taxAmount: z.string(),
  discountAmount: z.string(),
  shippingAmount: z.string(),
  totalAmount: z.string(),
  shippingAddress: z.string().nullable(),
  billingAddress: z.string().nullable(),
  paymentTerms: z.string().nullable(),
  notes: z.string().nullable(),
  customerNotes: z.string().nullable(),
});

export const orderDeleteResponseSchema = z.object({
  success: z.boolean(),
  id: z.string().uuid(),
});

export const ordersListResponseSchema = z.object({
  orders: z.array(orderResponseSchema),
});

export type CreateOrderInput = z.input<typeof createOrderSchema>;
export type CreateOrderOutput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.input<typeof updateOrderSchema>;
export type UpdateOrderOutput = z.infer<typeof updateOrderSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
