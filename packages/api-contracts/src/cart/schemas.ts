import { z } from 'zod';

export const addItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
});

export const updateItemSchema = z.object({
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
});

export const mergeCartSchema = z.object({
  cartToken: z.string().uuid('Invalid cart token'),
});

export const cartItemSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  productName: z.string(),
  productSku: z.string(),
  productImageUrl: z.string().nullable(),
  unitPrice: z.string(),
  quantity: z.number().int(),
  lineTotal: z.string(),
  currency: z.string(),
});

export const cartResponseSchema = z.object({
  items: z.array(cartItemSchema),
  subtotal: z.string(),
  itemCount: z.number().int(),
  currency: z.string().nullable(),
  cartToken: z.string().optional(),
  newCartToken: z.union([z.string(), z.undefined()]).optional(),
});

export const successResponseSchema = z.object({
  success: z.boolean(),
});

export type AddItemInput = z.infer<typeof addItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type MergeCartInput = z.infer<typeof mergeCartSchema>;
