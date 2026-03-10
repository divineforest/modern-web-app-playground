import { HttpResponse, http } from 'msw';

// Define API handlers for external services only
// Internal localhost endpoints should be tested via real integration tests
export const handlers = [
  // VIES API (vatcheckapi.com) endpoint
  http.get('https://api.vatcheckapi.com/v2/check', ({ request }) => {
    const url = new URL(request.url);
    const vatNumber = url.searchParams.get('vat_number');

    // Default success response for test VAT numbers
    if (vatNumber === 'DE123456789') {
      return HttpResponse.json({
        country_code: 'DE',
        vat_number: '123456789',
        format_valid: true,
        checksum_valid: true,
        registration_info: {
          is_registered: true,
          name: 'ACME Corp GmbH',
          address: 'Hauptstraße 123\n10115 Berlin',
          address_parts: null,
          checked_at: new Date().toISOString(),
        },
        registration_info_history: [],
      });
    }

    // Luxembourg test case (from spec example)
    if (vatNumber === 'LU26375245') {
      return HttpResponse.json({
        country_code: 'LU',
        vat_number: '26375245',
        format_valid: true,
        checksum_valid: true,
        registration_info: {
          is_registered: true,
          name: 'AMAZON EUROPE CORE S.A R.L.',
          address: '38, AVENUE JOHN F. KENNEDY\nL-1855  LUXEMBOURG',
          address_parts: null,
          checked_at: new Date().toISOString(),
        },
        registration_info_history: [],
      });
    }

    // Invalid VAT format
    if (vatNumber === 'INVALID123') {
      return HttpResponse.json({
        country_code: '',
        vat_number: 'INVALID123',
        format_valid: false,
        checksum_valid: false,
        registration_info: {
          is_registered: false,
          name: '',
          address: '',
          address_parts: null,
          checked_at: new Date().toISOString(),
        },
        registration_info_history: [],
      });
    }

    // Unregistered VAT
    if (vatNumber === 'DE999999999') {
      return HttpResponse.json({
        country_code: 'DE',
        vat_number: '999999999',
        format_valid: true,
        checksum_valid: true,
        registration_info: {
          is_registered: false,
          name: '',
          address: '',
          address_parts: null,
          checked_at: new Date().toISOString(),
        },
        registration_info_history: [],
      });
    }

    // Rate limit simulation
    if (vatNumber === 'RATELIMIT') {
      return HttpResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Default: return a valid response for any other VAT number
    // NOTE: This permissive default is intentional by design. It simulates real VIES API
    // behavior which accepts any VAT format and returns validation results. Tests needing
    // specific failure scenarios (invalid format, unregistered, rate limit) should use the
    // explicit test cases above (INVALID123, DE999999999, RATELIMIT).
    return HttpResponse.json({
      country_code: vatNumber?.substring(0, 2) || 'XX',
      vat_number: vatNumber?.substring(2) || '',
      format_valid: true,
      checksum_valid: true,
      registration_info: {
        is_registered: true,
        name: 'Test Company',
        address: 'Test Address',
        address_parts: null,
        checked_at: new Date().toISOString(),
      },
      registration_info_history: [],
    });
  }),

  // Core API contacts upsert endpoint
  http.post('http://localhost:4000/api/v1/contacts/upsert', async ({ request }) => {
    const body = (await request.json()) as { contacts: unknown[] };

    return HttpResponse.json({
      success: true,
      processed: body.contacts.length,
      results: body.contacts.map((contact, index) => ({
        id: `contact_${index + 1}`,
        status: 'created',
        contact: contact,
      })),
    });
  }),

  // Core API file upload endpoint (new)
  http.post('http://localhost:4000/api/internal/documents', async ({ request }) => {
    try {
      // Extract file metadata from FormData
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const filename = formData.get('filename') as string;

      if (!file || !filename) {
        return HttpResponse.json(
          {
            success: false,
            error: 'Missing file or filename',
            code: 'MISSING_REQUIRED_FIELDS',
          },
          { status: 400 }
        );
      }

      // Simulate successful file upload
      const mockFileId = `file_${Math.random().toString(36).substring(7)}`;
      const mockChecksum = `sha256:${Math.random().toString(36).substring(2, 15)}`;

      const response = {
        id: mockFileId,
        fileName: filename,
        originalName: filename,
        mimeType: file.type || 'application/octet-stream',
        url: `https://api.example.com/files/${mockFileId}`,
        checksum: mockChecksum,
      };

      console.log('[MSW] Returning successful file upload response:', response);
      return HttpResponse.json(response);
    } catch (error) {
      console.error('[MSW] Error in file upload handler:', error);
      return HttpResponse.json(
        {
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
        },
        { status: 500 }
      );
    }
  }),

  // Core API file upload endpoint (legacy)
  http.post('*/api/v1/files/upload', async ({ request }) => {
    // Extract file metadata from FormData
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const filename = formData.get('filename') as string;

    if (!file || !filename) {
      return HttpResponse.json(
        {
          success: false,
          error: 'Missing file or filename',
          code: 'MISSING_REQUIRED_FIELDS',
        },
        { status: 400 }
      );
    }

    // Simulate successful file upload
    const mockFileId = `file_${Math.random().toString(36).substring(7)}`;
    const mockChecksum = `sha256:${Math.random().toString(36).substring(2, 15)}`;

    return HttpResponse.json({
      success: true,
      fileId: mockFileId,
      url: `https://api.example.com/files/${mockFileId}`,
      size: file.size,
      checksum: mockChecksum,
    });
  }),

  // Core API error endpoints
  http.post('http://localhost:4000/api/v1/contacts/upsert/error', () => {
    return HttpResponse.json(
      {
        success: false,
        error: 'Invalid request data',
        code: 'VALIDATION_ERROR',
      },
      { status: 500 }
    );
  }),

  http.post('http://localhost:4000/api/internal/documents/error', () => {
    return HttpResponse.json(
      {
        success: false,
        error: 'Storage quota exceeded',
        code: 'STORAGE_QUOTA_EXCEEDED',
      },
      { status: 500 }
    );
  }),

  // Core API file upload error simulation
  http.post('*/api/v1/files/upload/error', () => {
    return HttpResponse.json(
      {
        success: false,
        error: 'Storage quota exceeded',
        code: 'STORAGE_QUOTA_EXCEEDED',
      },
      { status: 413 }
    );
  }),
];
