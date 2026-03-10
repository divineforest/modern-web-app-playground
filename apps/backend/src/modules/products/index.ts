export { productsContract } from '@mercado/api-contracts';
export { registerProductsRoutes } from './api/products.routes.js';

export type { NewProduct, Product, UpdateProduct } from './domain/product.entity.js';
export type { ListProductsQuery, ProductStatus } from './domain/product.types.js';

export { productsService } from './services/products.service.js';
