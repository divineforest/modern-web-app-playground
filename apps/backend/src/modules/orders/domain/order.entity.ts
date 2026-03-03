import type { NewOrder as NewOrderSchema, Order as OrderSchema } from '../../../db/schema.js';
import type { OrderStatus } from './order.types.js';

export type Order = Omit<OrderSchema, 'status'> & {
  status: OrderStatus;
};

export type NewOrder = Omit<NewOrderSchema, 'status'> & {
  status?: OrderStatus;
};

export type UpdateOrder = Partial<Omit<NewOrder, 'id' | 'createdAt'>>;
