import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestJobTemplate } from '../../../../tests/factories/job-templates.js';
import { buildTestApp } from '../../../app.js';
import { db } from '../../../db/index.js';

// Type definitions for API responses
type JobTemplateResponse = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  titlePattern?: string | null;
  createdAt: string;
  updatedAt: string;
};

type JobTemplateListResponse = {
  jobTemplates: JobTemplateResponse[];
};

type DeleteResponse = {
  success: boolean;
  id: string;
};

type ErrorResponse = {
  error?: string;
  message?: string;
};

describe('Job Templates Routes - Integration Tests', () => {
  let fastify: FastifyInstance;

  // Test authentication token matching the configuration
  const authHeaders = {
    authorization: 'Bearer test_token_12345',
  };

  beforeEach(async () => {
    fastify = await buildTestApp();
  });

  afterEach(async () => {
    if (fastify) {
      await fastify.close();
    }
  });

  describe('POST /api/internal/job-templates', () => {
    it('should create a job template with valid data', async () => {
      // ARRANGE
      const requestBody = {
        code: `API_TEST_${Date.now()}`,
        name: 'API Test Template',
        description: 'Test description',
        isActive: 'true',
        defaultAssigneeId: null,
        titlePattern: 'API Test - {company_name}',
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/job-templates',
        headers: authHeaders,
        payload: requestBody,
      });

      // ASSERT
      expect(response.statusCode).toBe(201);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as JobTemplateResponse;
      expect(body.id).toBeDefined();
      expect(body.code).toBe(requestBody.code);
      expect(body.name).toBe(requestBody.name);
      expect(body.description).toBe(requestBody.description);
      expect(body.isActive).toBe(requestBody.isActive);
      expect(body.titlePattern).toBe(requestBody.titlePattern);
      expect(body.createdAt).toBeDefined();
      expect(body.updatedAt).toBeDefined();
    });

    it('should return 400 for invalid code format', async () => {
      // ARRANGE
      const requestBody = {
        code: 'invalid-code', // Invalid: lowercase with hyphens
        name: 'Test Template',
        titlePattern: 'Test',
        isActive: 'true',
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/job-templates',
        headers: authHeaders,
        payload: requestBody,
      });

      // ASSERT
      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.payload) as ErrorResponse;
      // ts-rest validation errors can be in body, bodyErrors, or message
      expect(body).toBeDefined();
      // Just verify we got a 400 response, the format can vary
    });

    it('should return 400 for missing required fields', async () => {
      // ARRANGE
      const requestBody = {
        code: 'MISSING_NAME',
        // Missing name and titlePattern
        isActive: 'true',
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/job-templates',
        headers: authHeaders,
        payload: requestBody,
      });

      // ASSERT
      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.payload) as ErrorResponse;
      // ts-rest validation errors can be in body, bodyErrors, or message
      expect(body).toBeDefined();
      // Just verify we got a 400 response, the format can vary
    });

    describe('ACL', () => {
      it('should return 401 without authentication', async () => {
        // ARRANGE
        const requestBody = {
          code: `API_TEST_${Date.now()}`,
          name: 'API Test Template',
          titlePattern: 'Test',
          isActive: 'true',
        };

        // ACT
        const response = await fastify.inject({
          method: 'POST',
          url: '/api/internal/job-templates',
          payload: requestBody,
        });

        // ASSERT
        expect(response.statusCode).toBe(401);
        const body = JSON.parse(response.payload) as ErrorResponse;
        expect(body.message).toBe('Missing authentication token');
      });

      it('should return 401 with invalid token', async () => {
        // ARRANGE
        const requestBody = {
          code: `API_TEST_${Date.now()}`,
          name: 'API Test Template',
          titlePattern: 'Test',
          isActive: 'true',
        };

        // ACT
        const response = await fastify.inject({
          method: 'POST',
          url: '/api/internal/job-templates',
          headers: {
            authorization: 'Bearer invalid_token',
          },
          payload: requestBody,
        });

        // ASSERT
        expect(response.statusCode).toBe(401);
        const body = JSON.parse(response.payload) as ErrorResponse;
        expect(body.message).toBe('Invalid authentication token');
      });
    });
  });

  describe('GET /api/internal/job-templates/:id', () => {
    it('should get a job template by ID', async () => {
      // ARRANGE
      const created = await createTestJobTemplate({}, db);

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/job-templates/${created.id}`,
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as JobTemplateResponse;
      expect(body.id).toBe(created.id);
      expect(body.code).toBe(created.code);
      expect(body.name).toBe(created.name);
    });

    it('should return 404 for non-existent ID', async () => {
      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/internal/job-templates/00000000-0000-0000-0000-000000000000',
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.payload) as ErrorResponse;
      expect(body.error).toBeDefined();
    });

    it('should return 400 for invalid UUID format', async () => {
      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/internal/job-templates/invalid-uuid',
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
    });

    describe('ACL', () => {
      it('should return 401 without authentication', async () => {
        // ARRANGE
        const created = await createTestJobTemplate({}, db);

        // ACT
        const response = await fastify.inject({
          method: 'GET',
          url: `/api/internal/job-templates/${created.id}`,
        });

        // ASSERT
        expect(response.statusCode).toBe(401);
      });

      it('should return 401 with invalid token', async () => {
        // ARRANGE
        const created = await createTestJobTemplate({}, db);

        // ACT
        const response = await fastify.inject({
          method: 'GET',
          url: `/api/internal/job-templates/${created.id}`,
          headers: {
            authorization: 'Bearer invalid_token',
          },
        });

        // ASSERT
        expect(response.statusCode).toBe(401);
        const body = JSON.parse(response.payload) as ErrorResponse;
        expect(body.message).toBe('Invalid authentication token');
      });
    });
  });

  describe('GET /api/internal/job-templates', () => {
    it('should list all job templates', async () => {
      // ARRANGE
      await createTestJobTemplate({ isActive: 'true' }, db);
      await createTestJobTemplate({ isActive: 'false' }, db);

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/internal/job-templates',
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as JobTemplateListResponse;
      expect(body.jobTemplates).toBeDefined();
      expect(Array.isArray(body.jobTemplates)).toBe(true);
      expect(body.jobTemplates.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by isActive status', async () => {
      // ARRANGE
      const activeTemplate = await createTestJobTemplate({ isActive: 'true' }, db);
      const inactiveTemplate = await createTestJobTemplate({ isActive: 'false' }, db);

      // ACT
      const activeResponse = await fastify.inject({
        method: 'GET',
        url: '/api/internal/job-templates?isActive=true',
        headers: authHeaders,
      });

      // ASSERT
      expect(activeResponse.statusCode).toBe(200);

      const activeBody = JSON.parse(activeResponse.payload) as JobTemplateListResponse;
      expect(activeBody.jobTemplates.some((t: { id: string }) => t.id === activeTemplate.id)).toBe(
        true
      );
      expect(
        activeBody.jobTemplates.some((t: { id: string }) => t.id === inactiveTemplate.id)
      ).toBe(false);

      // ACT
      const inactiveResponse = await fastify.inject({
        method: 'GET',
        url: '/api/internal/job-templates?isActive=false',
        headers: authHeaders,
      });

      // ASSERT
      expect(inactiveResponse.statusCode).toBe(200);

      const inactiveBody = JSON.parse(inactiveResponse.payload) as JobTemplateListResponse;
      expect(
        inactiveBody.jobTemplates.some((t: { id: string }) => t.id === inactiveTemplate.id)
      ).toBe(true);
      expect(
        inactiveBody.jobTemplates.some((t: { id: string }) => t.id === activeTemplate.id)
      ).toBe(false);
    });

    describe('ACL', () => {
      it('should return 401 without authentication', async () => {
        // ACT
        const response = await fastify.inject({
          method: 'GET',
          url: '/api/internal/job-templates',
        });

        // ASSERT
        expect(response.statusCode).toBe(401);
      });

      it('should return 401 with invalid token', async () => {
        // ACT
        const response = await fastify.inject({
          method: 'GET',
          url: '/api/internal/job-templates',
          headers: {
            authorization: 'Bearer invalid_token',
          },
        });

        // ASSERT
        expect(response.statusCode).toBe(401);
        const body = JSON.parse(response.payload) as ErrorResponse;
        expect(body.message).toBe('Invalid authentication token');
      });
    });
  });

  describe('PATCH /api/internal/job-templates/:id', () => {
    it('should update a job template', async () => {
      // ARRANGE
      const created = await createTestJobTemplate(
        {
          name: 'Original Name',
          description: 'Original Description',
        },
        db
      );

      const updatePayload = {
        name: 'Updated Name',
        description: 'Updated Description',
      };

      // ACT
      const response = await fastify.inject({
        method: 'PATCH',
        url: `/api/internal/job-templates/${created.id}`,
        headers: authHeaders,
        payload: updatePayload,
      });

      // ASSERT
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as JobTemplateResponse;
      expect(body.id).toBe(created.id);
      expect(body.name).toBe('Updated Name');
      expect(body.description).toBe('Updated Description');
      expect(body.code).toBe(created.code); // Unchanged
    });

    it('should perform partial updates', async () => {
      // ARRANGE
      const created = await createTestJobTemplate(
        {
          name: 'Original Name',
          isActive: 'true',
        },
        db
      );

      const updatePayload = {
        isActive: 'false',
      };

      // ACT
      const response = await fastify.inject({
        method: 'PATCH',
        url: `/api/internal/job-templates/${created.id}`,
        headers: authHeaders,
        payload: updatePayload,
      });

      // ASSERT
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload) as JobTemplateResponse;
      expect(body.name).toBe('Original Name'); // Unchanged
      expect(body.isActive).toBe('false'); // Updated
    });

    it('should return 404 for non-existent ID', async () => {
      // ACT
      const response = await fastify.inject({
        method: 'PATCH',
        url: '/api/internal/job-templates/00000000-0000-0000-0000-000000000000',
        headers: authHeaders,
        payload: { name: 'Updated Name' },
      });

      // ASSERT
      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.payload) as ErrorResponse;
      expect(body.error).toBeDefined();
    });

    it('should return 400 for invalid update data', async () => {
      // ARRANGE
      const created = await createTestJobTemplate({}, db);

      // ACT
      const response = await fastify.inject({
        method: 'PATCH',
        url: `/api/internal/job-templates/${created.id}`,
        headers: authHeaders,
        payload: { code: 'invalid-code' }, // Invalid format
      });

      // ASSERT
      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.payload) as ErrorResponse;
      // ts-rest validation errors can be in body, bodyErrors, or message
      expect(body).toBeDefined();
      // Just verify we got a 400 response, the format can vary
    });

    it('should return 400 for invalid UUID format', async () => {
      // ACT
      const response = await fastify.inject({
        method: 'PATCH',
        url: '/api/internal/job-templates/invalid-uuid',
        headers: authHeaders,
        payload: { name: 'Updated Name' },
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
    });

    describe('ACL', () => {
      it('should return 401 without authentication', async () => {
        // ARRANGE
        const created = await createTestJobTemplate({}, db);

        // ACT
        const response = await fastify.inject({
          method: 'PATCH',
          url: `/api/internal/job-templates/${created.id}`,
          payload: { name: 'Updated Name' },
        });

        // ASSERT
        expect(response.statusCode).toBe(401);
      });

      it('should return 401 with invalid token', async () => {
        // ARRANGE
        const created = await createTestJobTemplate({}, db);

        // ACT
        const response = await fastify.inject({
          method: 'PATCH',
          url: `/api/internal/job-templates/${created.id}`,
          headers: {
            authorization: 'Bearer invalid_token',
          },
          payload: { name: 'Updated Name' },
        });

        // ASSERT
        expect(response.statusCode).toBe(401);
        const body = JSON.parse(response.payload) as ErrorResponse;
        expect(body.message).toBe('Invalid authentication token');
      });
    });
  });

  describe('DELETE /api/internal/job-templates/:id', () => {
    it('should delete a job template', async () => {
      // ARRANGE
      const created = await createTestJobTemplate({}, db);

      // ACT
      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/internal/job-templates/${created.id}`,
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as DeleteResponse;
      expect(body.success).toBe(true);
      expect(body.id).toBe(created.id);

      // Verify it's deleted
      const getResponse = await fastify.inject({
        method: 'GET',
        url: `/api/internal/job-templates/${created.id}`,
        headers: authHeaders,
      });

      expect(getResponse.statusCode).toBe(404);
    });

    it('should return 404 for non-existent ID', async () => {
      // ACT
      const response = await fastify.inject({
        method: 'DELETE',
        url: '/api/internal/job-templates/00000000-0000-0000-0000-000000000000',
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.payload) as ErrorResponse;
      expect(body.error).toBeDefined();
    });

    it('should return 400 for invalid UUID format', async () => {
      // ACT
      const response = await fastify.inject({
        method: 'DELETE',
        url: '/api/internal/job-templates/invalid-uuid',
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
    });

    describe('ACL', () => {
      it('should return 401 without authentication', async () => {
        // ARRANGE
        const created = await createTestJobTemplate({}, db);

        // ACT
        const response = await fastify.inject({
          method: 'DELETE',
          url: `/api/internal/job-templates/${created.id}`,
        });

        // ASSERT
        expect(response.statusCode).toBe(401);
      });

      it('should return 401 with invalid token', async () => {
        // ARRANGE
        const created = await createTestJobTemplate({}, db);

        // ACT
        const response = await fastify.inject({
          method: 'DELETE',
          url: `/api/internal/job-templates/${created.id}`,
          headers: {
            authorization: 'Bearer invalid_token',
          },
        });

        // ASSERT
        expect(response.statusCode).toBe(401);
        const body = JSON.parse(response.payload) as ErrorResponse;
        expect(body.message).toBe('Invalid authentication token');
      });
    });
  });

  describe('Performance', () => {
    it('should respond to create request within reasonable time', async () => {
      // ARRANGE
      const start = Date.now();

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/job-templates',
        headers: authHeaders,
        payload: {
          code: `PERF_TEST_${Date.now()}`,
          name: 'Performance Test',
          titlePattern: 'Test',
          isActive: 'true',
        },
      });
      const end = Date.now();

      // ASSERT
      expect(response.statusCode).toBe(201);
      expect(end - start).toBeLessThan(100); // Should respond quickly with inject
    });
  });
});
