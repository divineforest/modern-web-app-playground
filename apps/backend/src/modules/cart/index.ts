export { cartContract } from '@mercado/api-contracts';
export { registerCartRoutes } from './api/cart.routes.js';

export type {
  AddItemInput,
  CartIdentifier,
  MergeCartInput,
  UpdateItemInput,
} from './domain/cart.types.js';

export {
  CartItemNotFoundError,
  CartNotFoundError,
  CurrencyMismatchError,
  cartService,
  ProductNotAvailableError,
  ProductNotFoundError,
} from './services/cart.service.js';
