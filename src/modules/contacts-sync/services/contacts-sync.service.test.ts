import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../../mocks/server.js';
import type { CoreContactUpsert, UpsertResponse } from '../../../shared/data-access/core/index.js';

import { syncContactsWithDefaults } from './contacts-sync.service.js';

describe('Contacts Sync Service', () => {
  const mockCompanyId = 'company_123';

  it('should sync contacts from Odoo to Core API', async () => {
    // ARRANGE
    const mockOdooContacts = [
      {
        id: 101,
        name: 'Alice Johnson',
        email: 'alice@company.com',
        phone: '+1-555-0001',
        write_date: '2024-01-15T10:00:00Z',
        active: true,
      },
      {
        id: 102,
        name: 'Bob Williams',
        email: 'bob@company.com',
        phone: '+1-555-0002',
        write_date: '2024-01-16T11:30:00Z',
        active: true,
      },
      {
        id: 103,
        name: 'Carol Davis',
        email: 'carol@company.com',
        phone: '+1-555-0003',
        write_date: '2024-01-17T09:15:00Z',
        active: false,
      },
    ];

    const expectedUpsertResponse: UpsertResponse = {
      success: true,
      upserted: 3,
      skipped: 0,
    };

    server.use(
      // Mock Odoo JSON-RPC endpoints
      http.post('*/jsonrpc', async ({ request }) => {
        const body = (await request.json()) as {
          method: string;
          params: Record<string, unknown>;
          id: number;
        };

        // Mock authentication
        if (body.method === '/web/session/authenticate') {
          return HttpResponse.json({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              uid: 1,
              user_context: { lang: 'en_US', tz: 'UTC' },
              db: body.params['db'],
              username: body.params['login'],
              session_id: 'mock_session_123',
            },
          });
        }

        // Mock get contacts
        if (
          body.method === 'call' &&
          body.params['service'] === 'object' &&
          body.params['method'] === 'execute_kw'
        ) {
          const { args } = body.params as { args: unknown[] };
          const [, , , model] = args as [string, number, string, string];

          if (model === 'res.partner') {
            return HttpResponse.json({
              jsonrpc: '2.0',
              id: body.id,
              result: mockOdooContacts,
            });
          }
        }

        return HttpResponse.json({ jsonrpc: '2.0', id: body.id, result: {} });
      }),

      // Mock Core SDK upsert endpoint
      http.post('http://localhost:4000/api/v1/contacts/upsert', async ({ request }) => {
        const body = (await request.json()) as { contacts: CoreContactUpsert[] };

        // Verify the transformed contacts match what we expect
        expect(body.contacts).toHaveLength(mockOdooContacts.length);

        // Verify each contact transformation using mock data
        mockOdooContacts.forEach((mockContact, i) => {
          expect(body.contacts[i]).toMatchObject({
            company_id: mockCompanyId,
            source_system: 'odoo',
            source_id: mockContact.id.toString(),
            name: mockContact.name,
          });
        });

        return HttpResponse.json(expectedUpsertResponse);
      })
    );

    // ACT
    const result = await syncContactsWithDefaults(mockCompanyId);

    // ASSERT
    expect(result.processed).toBe(3);
  });
});
