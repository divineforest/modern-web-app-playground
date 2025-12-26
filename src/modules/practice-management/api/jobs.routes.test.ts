import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestCompany } from '../../../../tests/factories/companies.js';
import { createTestJob } from '../../../../tests/factories/jobs.js';
import { getFirstServiceType } from '../../../../tests/factories/service-types.js';
import { buildTestApp } from '../../../app.js';
import { db } from '../../../db/index.js';

// Type definitions for API responses
type JobResponse = {
  id: string;
  companyId: string;
  serviceTypeId: string;
  title: string;
  status: string;
  period?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type JobListItem = JobResponse & {
  companyName: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
};

type JobListResponse = {
  jobs: JobListItem[];
};

type DeleteResponse = {
  success: boolean;
  id: string;
};

type ErrorResponse = {
  error?: string;
  message?: string;
};

describe('Jobs Routes - Integration Tests', () => {
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

  describe('POST /api/internal/jobs', () => {
    it('should create a job with valid data', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const serviceType = await getFirstServiceType(db);
      const requestBody = {
        companyId: company.id,
        serviceTypeId: serviceType.id,
        title: 'API Test Job',
        status: 'planned',
        dueAt: '2024-12-31T17:00:00.000Z',
        assigneeId: null,
        periodStart: '2024-01-01',
        periodEnd: '2024-01-31',
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/jobs',
        headers: authHeaders,
        payload: requestBody,
      });

      // ASSERT
      expect(response.statusCode).toBe(201);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as JobResponse;
      expect(body.id).toBeDefined();
      expect(body.companyId).toBe(requestBody.companyId);
      expect(body.serviceTypeId).toBe(requestBody.serviceTypeId);
      expect(body.title).toBe(requestBody.title);
      expect(body.status).toBe(requestBody.status);
      expect(body.createdAt).toBeDefined();
      expect(body.updatedAt).toBeDefined();
    });

    it('should return 400 for missing required fields', async () => {
      // ARRANGE
      const requestBody = {
        companyId: '00000000-0000-0000-0000-000000000001',
        // Missing serviceTypeId and title
        status: 'planned',
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/jobs',
        headers: authHeaders,
        payload: requestBody,
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload) as ErrorResponse;
      expect(body).toBeDefined();
    });

    it('should return 400 for invalid period dates', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const requestBody = {
        companyId: company.id,
        serviceTypeId: '00000000-0000-0000-0000-000000000001',
        title: 'Invalid Period Job',
        status: 'planned',
        periodStart: '2024-02-01',
        periodEnd: '2024-01-01', // End before start
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/jobs',
        headers: authHeaders,
        payload: requestBody,
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload) as ErrorResponse;
      expect(body.error).toContain('period');
    });

    it('should return 400 for invalid company reference', async () => {
      // ARRANGE
      const requestBody = {
        companyId: '00000000-0000-0000-0000-999999999999', // Non-existent
        serviceTypeId: '00000000-0000-0000-0000-000000000001',
        title: 'Test Job',
        status: 'planned',
      };

      // ACT
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/internal/jobs',
        headers: authHeaders,
        payload: requestBody,
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
    });

    describe('ACL', () => {
      it('should return 401 without authentication', async () => {
        // ARRANGE
        const company = await createTestCompany();
        const serviceType = await getFirstServiceType(db);
        const requestBody = {
          companyId: company.id,
          serviceTypeId: serviceType.id,
          title: 'Test Job',
          status: 'planned',
        };

        // ACT
        const response = await fastify.inject({
          method: 'POST',
          url: '/api/internal/jobs',
          payload: requestBody,
        });

        // ASSERT
        expect(response.statusCode).toBe(401);
      });

      it('should return 401 with invalid token', async () => {
        // ARRANGE
        const company = await createTestCompany();
        const serviceType = await getFirstServiceType(db);
        const requestBody = {
          companyId: company.id,
          serviceTypeId: serviceType.id,
          title: 'Test Job',
          status: 'planned',
        };

        // ACT
        const response = await fastify.inject({
          method: 'POST',
          url: '/api/internal/jobs',
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

  describe('GET /api/internal/jobs/:id', () => {
    it('should get a job by ID', async () => {
      // ARRANGE
      const created = await createTestJob({}, db);

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/jobs/${created.id}`,
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as JobResponse;
      expect(body.id).toBe(created.id);
      expect(body.title).toBe(created.title);
      expect(body.companyId).toBe(created.companyId);
    });

    it('should return 404 for non-existent ID', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/jobs/${nonExistentId}`,
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
        url: '/api/internal/jobs/invalid-uuid',
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
    });

    describe('ACL', () => {
      it('should return 401 without authentication', async () => {
        // ARRANGE
        const created = await createTestJob({}, db);

        // ACT
        const response = await fastify.inject({
          method: 'GET',
          url: `/api/internal/jobs/${created.id}`,
        });

        // ASSERT
        expect(response.statusCode).toBe(401);
      });

      it('should return 401 with invalid token', async () => {
        // ARRANGE
        const created = await createTestJob({}, db);

        // ACT
        const response = await fastify.inject({
          method: 'GET',
          url: `/api/internal/jobs/${created.id}`,
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

  describe('GET /api/internal/jobs', () => {
    it('should list all jobs', async () => {
      // ARRANGE
      const company = await createTestCompany();
      await createTestJob({ companyId: company.id }, db);
      await createTestJob({ companyId: company.id }, db);

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/internal/jobs',
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as JobListResponse;
      expect(body.jobs).toBeDefined();
      expect(Array.isArray(body.jobs)).toBe(true);
      expect(body.jobs.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by companyId', async () => {
      // ARRANGE
      const company1 = await createTestCompany();
      const company2 = await createTestCompany();
      const job1 = await createTestJob({ companyId: company1.id }, db);
      const job2 = await createTestJob({ companyId: company2.id }, db);

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/jobs?companyId=${company1.id}`,
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload) as JobListResponse;
      expect(body.jobs.some((j: { id: string }) => j.id === job1.id)).toBe(true);
      expect(body.jobs.some((j: { id: string }) => j.id === job2.id)).toBe(false);
    });

    it('should filter by status', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const plannedJob = await createTestJob({ companyId: company.id, status: 'planned' }, db);
      const completedJob = await createTestJob({ companyId: company.id, status: 'completed' }, db);

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/internal/jobs?status=planned',
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload) as JobListResponse;
      expect(body.jobs.some((j: { id: string }) => j.id === plannedJob.id)).toBe(true);
      expect(body.jobs.some((j: { id: string }) => j.id === completedJob.id)).toBe(false);
    });

    it('should filter by assigneeId', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const assignee1 = '00000000-0000-0000-0000-000000000001';
      const assignee2 = '00000000-0000-0000-0000-000000000002';

      const job1 = await createTestJob({ companyId: company.id, assigneeId: assignee1 }, db);
      const job2 = await createTestJob({ companyId: company.id, assigneeId: assignee2 }, db);

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/jobs?assigneeId=${assignee1}`,
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload) as JobListResponse;
      expect(body.jobs.some((j: { id: string }) => j.id === job1.id)).toBe(true);
      expect(body.jobs.some((j: { id: string }) => j.id === job2.id)).toBe(false);
    });

    it('should filter by dueAfter', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-02-15');

      const job1 = await createTestJob({ companyId: company.id, dueAt: date1 }, db);
      const job2 = await createTestJob({ companyId: company.id, dueAt: date2 }, db);

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/internal/jobs?dueAfter=2024-01-31',
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload) as JobListResponse;
      expect(body.jobs.some((j: { id: string }) => j.id === job2.id)).toBe(true);
      expect(body.jobs.some((j: { id: string }) => j.id === job1.id)).toBe(false);
    });

    it('should filter by dueBefore', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-02-15');

      const job1 = await createTestJob({ companyId: company.id, dueAt: date1 }, db);
      const job2 = await createTestJob({ companyId: company.id, dueAt: date2 }, db);

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/internal/jobs?dueBefore=2024-01-31',
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload) as JobListResponse;
      expect(body.jobs.some((j: { id: string }) => j.id === job1.id)).toBe(true);
      expect(body.jobs.some((j: { id: string }) => j.id === job2.id)).toBe(false);
    });

    it('should filter by multiple criteria', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const assigneeId = '00000000-0000-0000-0000-000000000001';

      const matchingJob = await createTestJob(
        {
          companyId: company.id,
          status: 'in_progress',
          assigneeId,
        },
        db
      );

      const nonMatchingJob = await createTestJob(
        {
          companyId: company.id,
          status: 'planned',
          assigneeId,
        },
        db
      );

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/internal/jobs?companyId=${company.id}&status=in_progress&assigneeId=${assigneeId}`,
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload) as JobListResponse;
      expect(body.jobs.some((j: { id: string }) => j.id === matchingJob.id)).toBe(true);
      expect(body.jobs.some((j: { id: string }) => j.id === nonMatchingJob.id)).toBe(false);
    });

    it('should include company name and assignee details in list response', async () => {
      // ARRANGE
      const company = await createTestCompany();
      const job = await createTestJob(
        {
          companyId: company.id,
          assigneeId: '00000000-0000-0000-0000-000000000001',
        },
        db
      );

      // ACT
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/internal/jobs',
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload) as JobListResponse;
      const responseJob = body.jobs.find((j) => j.id === job.id);

      expect(responseJob).toBeDefined();
      expect(responseJob?.companyName).toBeDefined();
      expect(typeof responseJob?.companyName).toBe('string');
      // assigneeName and assigneeEmail might be null if user details are not populated
      expect(responseJob).toHaveProperty('assigneeName');
      expect(responseJob).toHaveProperty('assigneeEmail');
    });

    describe('ACL', () => {
      it('should return 401 without authentication', async () => {
        // ACT
        const response = await fastify.inject({
          method: 'GET',
          url: '/api/internal/jobs',
        });

        // ASSERT
        expect(response.statusCode).toBe(401);
      });

      it('should return 401 with invalid token', async () => {
        // ACT
        const response = await fastify.inject({
          method: 'GET',
          url: '/api/internal/jobs',
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

  describe('PATCH /api/internal/jobs/:id', () => {
    it('should update a job', async () => {
      // ARRANGE
      const created = await createTestJob({ title: 'Original Title', status: 'planned' }, db);

      // ACT
      const response = await fastify.inject({
        method: 'PATCH',
        url: `/api/internal/jobs/${created.id}`,
        headers: authHeaders,
        payload: {
          title: 'Updated Title',
          status: 'in_progress',
        },
      });

      // ASSERT
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload) as JobResponse;
      expect(body.id).toBe(created.id);
      expect(body.title).toBe('Updated Title');
      expect(body.status).toBe('in_progress');
    });

    it('should automatically set completedAt when status changes to completed', async () => {
      // ARRANGE
      const created = await createTestJob({ status: 'planned' }, db);

      // ACT
      const response = await fastify.inject({
        method: 'PATCH',
        url: `/api/internal/jobs/${created.id}`,
        headers: authHeaders,
        payload: {
          status: 'completed',
        },
      });

      // ASSERT
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload) as JobResponse;
      expect(body.status).toBe('completed');
      expect(body.completedAt).not.toBeNull();
      expect(body.completedAt).toBeDefined();
    });

    it('should return 404 for non-existent ID', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT
      const response = await fastify.inject({
        method: 'PATCH',
        url: `/api/internal/jobs/${nonExistentId}`,
        headers: authHeaders,
        payload: {
          title: 'Updated',
        },
      });

      // ASSERT
      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.payload) as ErrorResponse;
      expect(body.error).toBeDefined();
    });

    it('should return 400 for invalid period dates', async () => {
      // ARRANGE
      const created = await createTestJob(
        {
          periodStart: '2024-01-01',
          periodEnd: '2024-01-31',
        },
        db
      );

      // ACT
      const response = await fastify.inject({
        method: 'PATCH',
        url: `/api/internal/jobs/${created.id}`,
        headers: authHeaders,
        payload: {
          periodEnd: '2023-12-01', // Before periodStart
        },
      });

      // ASSERT
      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.payload) as ErrorResponse;
      expect(body.error).toContain('period');
    });

    it('should return 400 for invalid status value', async () => {
      // ARRANGE
      const created = await createTestJob({}, db);

      // ACT
      const response = await fastify.inject({
        method: 'PATCH',
        url: `/api/internal/jobs/${created.id}`,
        headers: authHeaders,
        payload: {
          status: 'invalid_status',
        },
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
    });

    describe('ACL', () => {
      it('should return 401 without authentication', async () => {
        // ARRANGE
        const created = await createTestJob({ status: 'planned' }, db);

        // ACT
        const response = await fastify.inject({
          method: 'PATCH',
          url: `/api/internal/jobs/${created.id}`,
          payload: {
            status: 'in_progress',
          },
        });

        // ASSERT
        expect(response.statusCode).toBe(401);
      });

      it('should return 401 with invalid token', async () => {
        // ARRANGE
        const created = await createTestJob({ status: 'planned' }, db);

        // ACT
        const response = await fastify.inject({
          method: 'PATCH',
          url: `/api/internal/jobs/${created.id}`,
          headers: {
            authorization: 'Bearer invalid_token',
          },
          payload: {
            status: 'in_progress',
          },
        });

        // ASSERT
        expect(response.statusCode).toBe(401);
        const body = JSON.parse(response.payload) as ErrorResponse;
        expect(body.message).toBe('Invalid authentication token');
      });
    });
  });

  describe('DELETE /api/internal/jobs/:id', () => {
    it('should delete a job', async () => {
      // ARRANGE
      const created = await createTestJob({}, db);

      // ACT
      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/internal/jobs/${created.id}`,
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
        url: `/api/internal/jobs/${created.id}`,
        headers: authHeaders,
      });

      expect(getResponse.statusCode).toBe(404);
    });

    it('should return 404 for non-existent ID', async () => {
      // ARRANGE
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // ACT
      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/internal/jobs/${nonExistentId}`,
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
        url: '/api/internal/jobs/invalid-uuid',
        headers: authHeaders,
      });

      // ASSERT
      expect(response.statusCode).toBe(400);
    });

    describe('ACL', () => {
      it('should return 401 without authentication', async () => {
        // ARRANGE
        const created = await createTestJob({}, db);

        // ACT
        const response = await fastify.inject({
          method: 'DELETE',
          url: `/api/internal/jobs/${created.id}`,
        });

        // ASSERT
        expect(response.statusCode).toBe(401);
      });

      it('should return 401 with invalid token', async () => {
        // ARRANGE
        const created = await createTestJob({}, db);

        // ACT
        const response = await fastify.inject({
          method: 'DELETE',
          url: `/api/internal/jobs/${created.id}`,
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
});
