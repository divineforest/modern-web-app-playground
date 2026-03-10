import { z } from 'zod';
import { cartItemSchema } from '../cart/schemas.js';

export const addressSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  addressLine1: z.string().min(1, 'Address line 1 is required'),
  addressLine2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().optional(),
  postalCode: z.string().min(1, 'Postal code is required'),
  countryCode: z
    .string()
    .length(2, 'Country code must be a 2-letter ISO 3166-1 alpha-2 code')
    .toUpperCase(),
  phone: z.string().optional(),
});

export const checkoutRequestSchema = z.object({
  shippingAddress: addressSchema,
  billingAddress: addressSchema.optional(),
  billingSameAsShipping: z.boolean().default(false),
});

export const checkoutResponseSchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string(),
  status: z.string(),
  orderDate: z.string(),
  currency: z.string(),
  subtotal: z.string(),
  taxAmount: z.string(),
  discountAmount: z.string(),
  shippingAmount: z.string(),
  totalAmount: z.string(),
  shippingAddress: addressSchema,
  billingAddress: addressSchema,
  items: z.array(cartItemSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Address = z.infer<typeof addressSchema>;
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;
