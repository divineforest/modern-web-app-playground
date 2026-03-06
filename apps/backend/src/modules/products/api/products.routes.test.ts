import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestProduct, createTestProducts } from '../../../../tests/factories/products.js';
import { buildTestApp } from '../../../app.js';
import { db } from '../../../db/index.js';

type ProductResponse = {
  id: string;
  status: string;
  name: string;
  slug: string;
  sku: string;
  description: string | null;
  shortDescription: string | null;
  category: string | null;
  tags: string[] | null;
  imageUrl: string | null;
  currency: string;
  price: string;
  compareAtPrice: string | null;
  weight: string | null;
  width: string | null;
  height: string | null;
  length: string | null;
  createdAt: string;
  updatedAt: string;
};

type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type ProductListResponse = {
  products: ProductResponse[];
  pagination: PaginationMeta;
};

describe('Products Routes - Integration Tests', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    fastify = await buildTestApp();
  });

  afterEach(async () => {
    if (fastify) {
      await fastify.close();
    }
  });

  describe('GET /api/products', () => {
    it('should list products with default pagination', async () => {
      await createTestProduct({ status: 'active' }, db);
      await createTestProduct({ status: 'active' }, db);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/products',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as ProductListResponse;
      expect(Array.isArray(body.products)).toBe(true);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(20);
      expect(typeof body.pagination.total).toBe('number');
      expect(typeof body.pagination.totalPages).toBe('number');
    });

    it('should not expose costPrice in the response', async () => {
      await createTestProduct({ status: 'active', costPrice: '50.00' }, db);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/products',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload) as ProductListResponse;
      const product = body.products[0];
      expect(product).not.toHaveProperty('costPrice');
    });

    it('should filter by status', async () => {
      const activeProduct = await createTestProduct({ status: 'active' }, db);
      const draftProduct = await createTestProduct({ status: 'draft' }, db);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/products?status=active',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload) as ProductListResponse;
      const ids = body.products.map((p) => p.id);
      expect(ids).toContain(activeProduct.id);
      expect(ids).not.toContain(draftProduct.id);
    });

    it('should filter by category', async () => {
      const electronicsProduct = await createTestProduct(
        { status: 'active', category: 'Electronics' },
        db
      );
      const clothingProduct = await createTestProduct(
        { status: 'active', category: 'Clothing' },
        db
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/products?category=Electronics',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload) as ProductListResponse;
      const ids = body.products.map((p) => p.id);
      expect(ids).toContain(electronicsProduct.id);
      expect(ids).not.toContain(clothingProduct.id);
    });

    it('should order by creation date (newest first)', async () => {
      const first = await createTestProduct({ status: 'active' }, db);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const second = await createTestProduct({ status: 'active' }, db);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/products?status=active',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload) as ProductListResponse;
      const ids = body.products.map((p) => p.id);
      expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
    });

    it('should return correct total in pagination metadata', async () => {
      await createTestProducts(3, { status: 'active', category: 'TestCat-total' }, db);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/products?category=TestCat-total',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload) as ProductListResponse;
      expect(body.pagination.total).toBeGreaterThanOrEqual(3);
      expect(body.products.length).toBeGreaterThanOrEqual(3);
    });

    it('should paginate results with page and limit', async () => {
      await createTestProducts(5, { status: 'active', category: 'TestCat-paged' }, db);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/products?category=TestCat-paged&limit=2&page=1',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload) as ProductListResponse;
      expect(body.products.length).toBe(2);
      expect(body.pagination.limit).toBe(2);
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.total).toBeGreaterThanOrEqual(5);
      expect(body.pagination.totalPages).toBeGreaterThanOrEqual(3);
    });

    it('should return the second page of results', async () => {
      await createTestProducts(4, { status: 'active', category: 'TestCat-p2' }, db);

      const page1Response = await fastify.inject({
        method: 'GET',
        url: '/api/products?category=TestCat-p2&limit=2&page=1',
      });
      const page2Response = await fastify.inject({
        method: 'GET',
        url: '/api/products?category=TestCat-p2&limit=2&page=2',
      });

      expect(page1Response.statusCode).toBe(200);
      expect(page2Response.statusCode).toBe(200);

      const page1 = JSON.parse(page1Response.payload) as ProductListResponse;
      const page2 = JSON.parse(page2Response.payload) as ProductListResponse;

      expect(page1.products.length).toBe(2);
      expect(page2.products.length).toBe(2);

      const page1Ids = new Set(page1.products.map((p) => p.id));
      const page2Ids = page2.products.map((p) => p.id);
      expect(page2Ids.every((id) => !page1Ids.has(id))).toBe(true);
    });

    it('should return totalPages consistent with total and limit', async () => {
      await createTestProducts(5, { status: 'active', category: 'TestCat-pages' }, db);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/products?category=TestCat-pages&limit=3',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload) as ProductListResponse;
      expect(body.pagination.totalPages).toBe(
        Math.ceil(body.pagination.total / body.pagination.limit)
      );
    });

    it('should return 400 for invalid status value', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/products?status=invalid',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for page less than 1', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/products?page=0',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for limit greater than 100', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/products?limit=101',
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
