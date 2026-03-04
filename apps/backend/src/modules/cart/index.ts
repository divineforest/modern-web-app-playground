// ============================================================================
// API LAYER EXPORTS
// ============================================================================

export { cartContract } from './api/cart.contracts.js';
export { registerCartRoutes } from './api/cart.routes.js';

// ============================================================================
// DOMAIN EXPORTS
// ============================================================================

export type {
  AddItemInput,
  CartIdentifier,
  CartItem,
  CartResponse,
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
