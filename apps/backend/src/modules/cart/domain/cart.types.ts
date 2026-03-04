import { z } from 'zod';

/**
 * Validation schema for adding an item to the cart
 */
export const addItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
});

/**
 * Validation schema for updating an item quantity
 */
export const updateItemSchema = z.object({
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
});

/**
 * Validation schema for merging guest cart into user cart
 */
export const mergeCartSchema = z.object({
  cartToken: z.string().uuid('Invalid cart token'),
});

/**
 * Type for add item input
 */
export type AddItemInput = z.infer<typeof addItemSchema>;

/**
 * Type for update item input
 */
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

/**
 * Type for merge cart input
 */
export type MergeCartInput = z.infer<typeof mergeCartSchema>;

/**
 * Cart item representation with computed line total
 */
export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productImageUrl: string | null;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
  currency: string;
}

/**
 * Cart response representation
 */
export interface CartResponse {
  items: CartItem[];
  subtotal: string;
  itemCount: number;
  currency: string | null;
  cartToken?: string;
}

/**
 * Cart identifier - discriminated union for user vs guest
 */
export type CartIdentifier =
  | { type: 'user'; userId: string }
  | { type: 'guest'; cartToken?: string };
