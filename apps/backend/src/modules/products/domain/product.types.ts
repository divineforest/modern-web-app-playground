import { z } from 'zod';

/**
 * Product status enum
 */
const productStatusEnum = ['draft', 'active', 'archived'] as const;
export type ProductStatus = (typeof productStatusEnum)[number];

/**
 * Validation schema for product status
 */
export const productStatusSchema = z.enum(productStatusEnum);

/**
 * Validation schema for listing products query parameters
 */
export const listProductsQuerySchema = z.object({
  status: productStatusSchema.optional(),
  category: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Type for list products query
 */
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

/**
 * Pagination metadata returned alongside paginated results
 */
export interface PaginationResult {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
