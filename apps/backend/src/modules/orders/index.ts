export { ordersContract } from '@mercado/api-contracts';
export { registerOrdersRoutes } from './api/orders.routes.js';

export type { NewOrder, Order, UpdateOrder } from './domain/order.entity.js';
export type {
  CreateOrderInput,
  ListOrdersQuery,
  OrderStatus,
  UpdateOrderInput,
} from './domain/order.types.js';

export {
  OrderNotFoundError,
  OrderValidationError,
  ordersService,
} from './services/orders.service.js';
