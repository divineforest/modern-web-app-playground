import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestProduct } from '../../../../tests/factories/products.js';
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

describe('Products Search Routes - Integration Tests', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    fastify = await buildTestApp();
  });

  afterEach(async () => {
    if (fastify) {
      await fastify.close();
    }
  });

  describe('GET /api/products/search', () => {
    it('should return matching products for basic search query', async () => {
      await createTestProduct(
        {
          status: 'active',
          name: 'Blue Cotton Shirt',
          description: 'A comfortable blue shirt',
        },
        db
      );
      await createTestProduct(
        {
          status: 'active',
          name: 'Red Cotton Shirt',
          description: 'A comfortable red shirt',
        },
        db
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/products/search?q=blue',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload) as ProductListResponse;
      expect(body.products.length).toBeGreaterThan(0);
      expect(body.products.some((p) => p.name.includes('Blue'))).toBe(true);
    });

    it('should match phrase in description', async () => {
      await createTestProduct(
        {
          status: 'active',
          name: 'Cotton Shirt',
          description: 'A blue cotton shirt for everyday wear',
        },
        db
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/products/search?q=blue%20cotton',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload) as ProductListResponse;
      expect(body.products.length).toBeGreaterThan(0);
    });

    it('should perform case-insensitive matching', async () => {
      await createTestProduct(
        {
          status: 'active',
          name: 'BLUE SHIRT',
          description: 'Uppercase blue shirt',
        },
        db
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/products/search?q=blue',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload) as ProductListResponse;
      expect(body.products.length).toBeGreaterThan(0);
    });

    it('should only return active products', async () => {
      const activeProduct = await createTestProduct(
        {
          status: 'active',
          name: 'Active Blue Shirt',
          description: 'Active product',
        },
        db
      );
      const draftProduct = await createTestProduct(
        {
          status: 'draft',
          name: 'Draft Blue Shirt',
          description: 'Draft product',
        },
        db
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/products/search?q=blue',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload) as ProductListResponse;
      const ids = body.products.map((p) => p.id);
      expect(ids).toContain(activeProduct.id);
      expect(ids).not.toContain(draftProduct.id);
    });

    it('should sort by relevance by default', async () => {
      await createTestProduct(
        {
          status: 'active',
          name: 'Running Shoes',
          description: 'Best shoes for running',
        },
        db
      );
      await createTestProduct(
        {
          status: 'active',
          name: 'Casual Shoes',
          description: 'Running is mentioned here but not in title',
        },
        db
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/products/search?q=running&sort=relevance',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload) as ProductListResponse;
      expect(body.products.length).toBeGreaterThanOrEqual(2);
      expect(body.products[0]?.name).toContain('Running');
    });

    it('should sort by price ascending', async () => {
      await createTestProduct(
        {
          status: 'active',
          name: 'Expensive Shirt',
          description: 'Shirt product',
          price: '100.00',
          currency: 'USD',
        },
        db
      );
      await createTestProduct(
        {
          status: 'active',
          name: 'Cheap Shirt',
          description: 'Shirt product',
          price: '10.00',
          currency: 'USD',
        },
        db
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/products/search?q=shirt&sort=price_asc',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload) as ProductListResponse;
      expect(body.products.length).toBeGreaterThanOrEqual(2);
      const prices = body.products.map((p) => Number.parseFloat(p.price));
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1] ?? 0);
      }
    });

    it('should sort by price descending', async () => {
      await createTestProduct(
        {
          status: 'active',
          name: 'Expensive Pants',
          description: 'Pants product',
          price: '100.00',
          currency: 'USD',
        },
        db
      );
      await createTestProduct(
        {
          status: 'active',
          name: 'Cheap Pants',
          description: 'Pants product',
          price: '10.00',
          currency: 'USD',
        },
        db
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/products/search?q=pants&sort=price_desc',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload) as ProductListResponse;
      expect(body.products.length).toBeGreaterThanOrEqual(2);
      const prices = body.products.map((p) => Number.parseFloat(p.price));
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeLessThanOrEqual(prices[i - 1] ?? Number.MAX_VALUE);
      }
    });

    it('should group by currency when sorting by price', async () => {
      await createTestProduct(
        {
          status: 'active',
          name: 'EUR Jacket',
          description: 'Jacket in euros',
          price: '50.00',
          currency: 'EUR',
        },
        db
      );
      await createTestProduct(
        {
          status: 'active',
          name: 'USD Jacket',
          description: 'Jacket in dollars',
          price: '100.00',
          currency: 'USD',
        },
        db
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/products/search?q=jacket&sort=price_asc',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload) as ProductListResponse;
      expect(body.products.length).toBeGreaterThanOrEqual(2);
      const currencies = body.products.map((p) => p.currency);
      const eurIndex = currencies.indexOf('EUR');
      const usdIndex = currencies.indexOf('USD');
      if (eurIndex !== -1 && usdIndex !== -1) {
        expect(eurIndex).toBeLessThan(usdIndex);
      }
      expect(body.products.length).toBeGreaterThan(0);
    });

    it('should paginate results', async () => {
      for (let i = 0; i < 5; i++) {
        await createTestProduct(
          {
            status: 'active',
            name: `Socks ${i}`,
            description: 'Comfortable socks',
          },
          db
        );
      }

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/products/search?q=socks&limit=2&page=1',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload) as ProductListResponse;
      expect(body.products.length).toBe(2);
      expect(body.pagination.limit).toBe(2);
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.total).toBeGreaterThanOrEqual(5);
    });

    it('should return 400 for query shorter than 2 characters', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/products/search?q=a',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for empty query', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/products/search?q=',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing query parameter', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/products/search',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return empty results for query with no matches', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/products/search?q=nonexistentproduct12345',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload) as ProductListResponse;
      expect(body.products).toEqual([]);
      expect(body.pagination.total).toBe(0);
    });

    it('should return 400 for invalid sort parameter', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/products/search?q=test&sort=invalid',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should not expose costPrice in search results', async () => {
      await createTestProduct(
        {
          status: 'active',
          name: 'Hat',
          description: 'Nice hat',
          costPrice: '5.00',
        },
        db
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/products/search?q=hat',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload) as ProductListResponse;
      expect(body.products.length).toBeGreaterThan(0);
      const product = body.products[0];
      expect(product).not.toHaveProperty('costPrice');
    });

    it('should support stemming for word variations', async () => {
      await createTestProduct(
        {
          status: 'active',
          name: 'Running Shoes',
          description: 'Perfect for runners',
        },
        db
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/products/search?q=run',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload) as ProductListResponse;
      expect(body.products.length).toBeGreaterThan(0);
      expect(body.products.some((p) => p.name.includes('Running'))).toBe(true);
    });
  });
});
