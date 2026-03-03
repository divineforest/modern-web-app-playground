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
});

/**
 * Type for list products query
 */
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
