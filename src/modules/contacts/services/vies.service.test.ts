import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../../mocks/server.js';
import { normalizeVatId, type ViesServiceConfig, validateVatId } from './vies.service.js';

// Test configuration that doesn't depend on env vars
const testConfig: ViesServiceConfig = {
  apiKey: 'test-api-key',
  baseUrl: 'https://api.vatcheckapi.com/v2',
  timeout: 5000,
  retryAttempts: 0,
  retryDelayMs: 100,
};

describe('vies.service', () => {
  describe('normalizeVatId', () => {
    it('removes spaces from VAT ID', () => {
      // ACT:
      const result = normalizeVatId('DE 123 456 789');

      // ASSERT:
      expect(result).toBe('DE123456789');
    });

    it('converts VAT ID to uppercase', () => {
      // ACT:
      const result = normalizeVatId('de123456789');

      // ASSERT:
      expect(result).toBe('DE123456789');
    });

    it('handles already normalized VAT ID', () => {
      // ACT:
      const result = normalizeVatId('DE123456789');

      // ASSERT:
      expect(result).toBe('DE123456789');
    });
  });

  describe('validateVatId', () => {
    it('returns success for valid registered VAT ID', async () => {
      // ARRANGE - uses default MSW handler for DE123456789

      // ACT:
      const result = await validateVatId('DE123456789', testConfig);

      // ASSERT:
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe('ACME Corp GmbH');
      expect(result.data?.countryCode).toBe('DE');
      expect(result.data?.isRegistered).toBe(true);

      // Verify comprehensive rawResponse structure
      expect(result.rawResponse).toBeDefined();
      expect(result.rawResponse?.vatId).toBe('DE123456789');
      expect(result.rawResponse?.url).toBe(
        'https://api.vatcheckapi.com/v2/check?vat_number=DE123456789'
      );
      expect(result.rawResponse?.status).toBe(200);
      expect(result.rawResponse?.body).toBeDefined();

      // Verify millisecond timestamps
      expect(typeof result.rawResponse?.startMs).toBe('number');
      expect(typeof result.rawResponse?.endMs).toBe('number');
      expect(typeof result.rawResponse?.durationMs).toBe('number');
      expect(result.rawResponse?.endMs).toBeGreaterThanOrEqual(result.rawResponse?.startMs ?? 0);
      expect(result.rawResponse?.durationMs).toBeGreaterThanOrEqual(0);

      // Verify human-readable timestamps and duration
      expect(typeof result.rawResponse?.start).toBe('string');
      expect(typeof result.rawResponse?.end).toBe('string');
      expect(typeof result.rawResponse?.duration).toBe('string');
      expect(result.rawResponse?.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(result.rawResponse?.end).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(result.rawResponse?.duration).toMatch(/^\d+(\.\d+)?(ms|s)$/);
    });

    it('returns success for Luxembourg test VAT ID', async () => {
      // ACT:
      const result = await validateVatId('LU26375245', testConfig);

      // ASSERT:
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('AMAZON EUROPE CORE S.A R.L.');
      expect(result.data?.countryCode).toBe('LU');
    });

    it('returns failure for invalid VAT format', async () => {
      // ACT:
      const result = await validateVatId('INVALID123', testConfig);

      // ASSERT:
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid VAT ID format');

      // Verify comprehensive rawResponse structure
      expect(result.rawResponse).toBeDefined();
      expect(result.rawResponse?.vatId).toBe('INVALID123');
      expect(result.rawResponse?.url).toBe(
        'https://api.vatcheckapi.com/v2/check?vat_number=INVALID123'
      );
      expect(result.rawResponse?.status).toBe(200);
      expect(result.rawResponse?.body).toBeDefined();
      expect(typeof result.rawResponse?.startMs).toBe('number');
      expect(typeof result.rawResponse?.endMs).toBe('number');
      expect(result.rawResponse?.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.rawResponse?.start).toBe('string');
      expect(typeof result.rawResponse?.end).toBe('string');
      expect(typeof result.rawResponse?.duration).toBe('string');
    });

    it('returns failure for unregistered VAT ID', async () => {
      // ACT:
      const result = await validateVatId('DE999999999', testConfig);

      // ASSERT:
      expect(result.success).toBe(false);
      expect(result.error).toBe('VAT ID is not registered');

      // Verify comprehensive rawResponse structure
      expect(result.rawResponse).toBeDefined();
      expect(result.rawResponse?.vatId).toBe('DE999999999');
      expect(result.rawResponse?.url).toBe(
        'https://api.vatcheckapi.com/v2/check?vat_number=DE999999999'
      );
      expect(result.rawResponse?.status).toBe(200);
      expect(result.rawResponse?.body).toBeDefined();
      expect(typeof result.rawResponse?.startMs).toBe('number');
      expect(typeof result.rawResponse?.endMs).toBe('number');
      expect(result.rawResponse?.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.rawResponse?.start).toBe('string');
      expect(typeof result.rawResponse?.end).toBe('string');
      expect(typeof result.rawResponse?.duration).toBe('string');
    });

    it('returns failure for rate limited response', async () => {
      // ACT:
      const result = await validateVatId('RATELIMIT', testConfig);

      // ASSERT:
      expect(result.success).toBe(false);
      expect(result.error).toBe('VIES API returned status 429');

      // Verify comprehensive rawResponse structure (for audit purposes even on HTTP errors)
      expect(result.rawResponse).toBeDefined();
      expect(result.rawResponse?.vatId).toBe('RATELIMIT');
      expect(result.rawResponse?.url).toBe(
        'https://api.vatcheckapi.com/v2/check?vat_number=RATELIMIT'
      );
      expect(result.rawResponse?.status).toBe(429);
      expect(result.rawResponse?.body).toBeDefined();
      expect(typeof result.rawResponse?.startMs).toBe('number');
      expect(typeof result.rawResponse?.endMs).toBe('number');
      expect(result.rawResponse?.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.rawResponse?.start).toBe('string');
      expect(typeof result.rawResponse?.end).toBe('string');
      expect(typeof result.rawResponse?.duration).toBe('string');
    });

    it('normalizes VAT ID before validation', async () => {
      // ACT: VAT ID with spaces and lowercase
      const result = await validateVatId('de 123 456 789', testConfig);

      // ASSERT:
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('ACME Corp GmbH');
    });

    it('returns failure on network error', async () => {
      // ARRANGE:
      server.use(
        http.get('https://api.vatcheckapi.com/v2/check', () => {
          return HttpResponse.error();
        })
      );

      // ACT:
      const result = await validateVatId('DE123456789', testConfig);

      // ASSERT:
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Verify comprehensive rawResponse structure (even on network errors)
      expect(result.rawResponse).toBeDefined();
      expect(result.rawResponse?.vatId).toBe('DE123456789');
      expect(result.rawResponse?.url).toBe(
        'https://api.vatcheckapi.com/v2/check?vat_number=DE123456789'
      );
      expect(result.rawResponse?.status).toBeUndefined();
      expect(result.rawResponse?.body).toBeUndefined();
      expect(typeof result.rawResponse?.startMs).toBe('number');
      expect(typeof result.rawResponse?.endMs).toBe('number');
      expect(result.rawResponse?.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.rawResponse?.start).toBe('string');
      expect(typeof result.rawResponse?.end).toBe('string');
      expect(typeof result.rawResponse?.duration).toBe('string');
    });

    it('returns failure on server error (500)', async () => {
      // ARRANGE:
      server.use(
        http.get('https://api.vatcheckapi.com/v2/check', () => {
          return HttpResponse.json({ error: 'Internal error' }, { status: 500 });
        })
      );

      // ACT:
      const result = await validateVatId('DE123456789', testConfig);

      // ASSERT:
      expect(result.success).toBe(false);
      expect(result.error).toContain('500');

      // Verify comprehensive rawResponse structure (for audit purposes even on HTTP errors)
      expect(result.rawResponse).toBeDefined();
      expect(result.rawResponse?.vatId).toBe('DE123456789');
      expect(result.rawResponse?.url).toBe(
        'https://api.vatcheckapi.com/v2/check?vat_number=DE123456789'
      );
      expect(result.rawResponse?.status).toBe(500);
      expect(result.rawResponse?.body).toEqual({ error: 'Internal error' });
      expect(typeof result.rawResponse?.startMs).toBe('number');
      expect(typeof result.rawResponse?.endMs).toBe('number');
      expect(result.rawResponse?.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.rawResponse?.start).toBe('string');
      expect(typeof result.rawResponse?.end).toBe('string');
      expect(typeof result.rawResponse?.duration).toBe('string');
    });
  });
});
