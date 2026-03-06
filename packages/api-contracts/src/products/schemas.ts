import { z } from 'zod';
import { paginationSchema } from '../shared/pagination.js';

const productStatusEnum = ['draft', 'active', 'archived'] as const;
export type ProductStatus = (typeof productStatusEnum)[number];

export const productStatusSchema = z.enum(productStatusEnum);

export const listProductsQuerySchema = z.object({
  status: productStatusSchema.optional(),
  category: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const productResponseSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  status: productStatusSchema,
  name: z.string(),
  slug: z.string(),
  sku: z.string(),
  description: z.string().nullable(),
  shortDescription: z.string().nullable(),
  category: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  imageUrl: z.string().nullable(),
  currency: z.string(),
  price: z.string(),
  compareAtPrice: z.string().nullable(),
  weight: z.string().nullable(),
  width: z.string().nullable(),
  height: z.string().nullable(),
  length: z.string().nullable(),
});

export const productsListResponseSchema = z.object({
  products: z.array(productResponseSchema),
  pagination: paginationSchema,
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

export const searchSortEnum = ['relevance', 'price_asc', 'price_desc'] as const;
export type SearchSort = (typeof searchSortEnum)[number];

export const searchSortSchema = z.enum(searchSortEnum);

export const searchProductsQuerySchema = z.object({
  q: z.string().min(2, 'Search query must be at least 2 characters'),
  sort: searchSortSchema.default('relevance'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type SearchProductsQuery = z.infer<typeof searchProductsQuerySchema>;
