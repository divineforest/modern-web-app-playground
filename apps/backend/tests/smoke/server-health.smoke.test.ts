describe('Smoke Tests - Server Health', () => {
  // Use the same defaults as vitest.config.smoke.ts
  const host = process.env['HOST'] || 'localhost';
  const port = parseInt(process.env['PORT'] || '3001', 10);
  const serverUrl = `http://${host}:${port}`;

  // Verify setup worked by checking if we can reach the server
  beforeAll(async () => {
    try {
      const response = await fetch(`${serverUrl}/healthz`, { signal: AbortSignal.timeout(1000) });
      if (!response.ok) {
        throw new Error(`Server not responding: ${response.status}`);
      }
    } catch {
      throw new Error(
        `Smoke test setup failed - server not accessible at ${serverUrl}. Check setup logs above for infrastructure requirements.`
      );
    }
  });

  describe('Health Endpoints', () => {
    it('GET /healthz returns 200 with valid JSON status', async () => {
      const response = await fetch(`${serverUrl}/healthz`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');

      const body = (await response.json()) as { status: string };

      // Validate JSON structure has status field
      expect(body).toHaveProperty('status');
      expect(typeof body.status).toBe('string');
    });

    it('GET /ready returns 200 with valid JSON status', async () => {
      const response = await fetch(`${serverUrl}/ready`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');

      const body = (await response.json()) as { status: string };

      // Validate JSON structure has status field
      expect(body).toHaveProperty('status');
      expect(typeof body.status).toBe('string');
    });

    it('GET /docs returns 200', async () => {
      const response = await fetch(`${serverUrl}/docs`);

      expect(response.status).toBe(200);
    });
  });
});
