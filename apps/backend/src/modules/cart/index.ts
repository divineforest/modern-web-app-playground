// ============================================================================
// API LAYER EXPORTS
// ============================================================================

export { cartContract } from '@mercado/api-contracts';
export { registerCartRoutes } from './api/cart.routes.js';

// ============================================================================
// DOMAIN EXPORTS
// ============================================================================

export type {
  AddItemInput,
  CartIdentifier,
  MergeCartInput,
  UpdateItemInput,
} from './domain/cart.types.js';

// ============================================================================
// SERVICE EXPORTS
// ============================================================================

export {
  CartItemNotFoundError,
  CartNotFoundError,
  cartService,
  CurrencyMismatchError,
  ProductNotAvailableError,
  ProductNotFoundError,
} from './services/cart.service.js';
