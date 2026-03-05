// ============================================================================
// API LAYER EXPORTS
// ============================================================================

export { ordersContract } from '@mercado/api-contracts';
export { registerOrdersRoutes } from './api/orders.routes.js';

// ============================================================================
// DOMAIN EXPORTS
// ============================================================================

export type { NewOrder, Order, UpdateOrder } from './domain/order.entity.js';
export type {
  CreateOrderInput,
  ListOrdersQuery,
  OrderStatus,
  UpdateOrderInput,
} from './domain/order.types.js';

// ============================================================================
// SERVICE EXPORTS
// ============================================================================

export {
  OrderNotFoundError,
  OrderValidationError,
  ordersService,
} from './services/orders.service.js';
