import type {
  NewProduct as NewProductSchema,
  Product as ProductSchema,
} from '../../../db/schema.js';
import type { ProductStatus } from './product.types.js';

export type Product = Omit<ProductSchema, 'status'> & {
  status: ProductStatus;
};

export type NewProduct = Omit<NewProductSchema, 'status'> & {
  status?: ProductStatus;
};

export type UpdateProduct = Partial<Omit<NewProduct, 'id' | 'createdAt'>>;
