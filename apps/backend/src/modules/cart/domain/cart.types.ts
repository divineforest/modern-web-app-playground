import type { z } from 'zod';
import type { cartItemSchema, cartResponseSchema } from '@mercado/api-contracts';

export type {
  AddItemInput,
  MergeCartInput,
  UpdateItemInput,
} from '@mercado/api-contracts';
export {
  addItemSchema,
  cartItemSchema,
  cartResponseSchema,
  mergeCartSchema,
  updateItemSchema,
} from '@mercado/api-contracts';

export type CartItem = z.infer<typeof cartItemSchema>;
export type CartResponse = z.infer<typeof cartResponseSchema>;

/**
 * Cart identifier - discriminated union for user vs guest
 */
export type CartIdentifier =
  | { type: 'user'; userId: string }
  | { type: 'guest'; cartToken?: string };
