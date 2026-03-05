// ============================================================================
// API LAYER EXPORTS
// ============================================================================

export { productsContract } from '@mercado/api-contracts';
export { registerProductsRoutes } from './api/products.routes.js';

// ============================================================================
// DOMAIN EXPORTS
// ============================================================================

export type { NewProduct, Product, UpdateProduct } from './domain/product.entity.js';
export type { ListProductsQuery, ProductStatus } from './domain/product.types.js';

// ============================================================================
// SERVICE EXPORTS
// ============================================================================

export { productsService } from './services/products.service.js';
