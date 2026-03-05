export type {
  ListProductsQuery,
  ProductStatus,
} from '@mercado/api-contracts';
export {
  listProductsQuerySchema,
  productStatusSchema,
} from '@mercado/api-contracts';

/**
 * Pagination metadata returned alongside paginated results
 */
export interface PaginationResult {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
