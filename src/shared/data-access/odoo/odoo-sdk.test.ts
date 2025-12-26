import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { server } from '../../../mocks/server.js';
import {
  createOdooSdk,
  getContactsFromOdoo,
  type OdooCredentials,
  OdooSdk,
  OdooSdkError,
} from './odoo-sdk.js';

describe('Odoo SDK', () => {
  const mockCredentials: OdooCredentials = {
    url: 'https://test.odoo.com',
    database: 'test_db',
    username: 'test_user',
    apiKey: 'test_api_key',
  };

  describe('OdooSdk class', () => {
    let sdk: OdooSdk;

    beforeEach(() => {
      sdk = new OdooSdk(mockCredentials, {
        timeout: 5000,
        retryAttempts: 2,
        retryDelayMs: 100,
      });
    });

    describe('authentication', () => {
      it('should authenticate successfully with valid credentials', async () => {
        // ARRANGE
        // Mock successful authentication
        server.use(
          http.post('*/jsonrpc', async ({ request }) => {
            const body = (await request.json()) as {
              method: string;
              params: Record<string, unknown>;
              id: number;
            };

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

            return HttpResponse.json({ jsonrpc: '2.0', id: body.id, result: {} });
          })
        );

        // ACT & ASSERT
        await expect(sdk.authenticate()).resolves.not.toThrow();
      });

      it('should handle authentication errors', async () => {
        // ARRANGE
        // Mock authentication failure
        server.use(
          http.post('*/jsonrpc', async ({ request }) => {
            const body = (await request.json()) as { method: string; id: number };
            if (body.method === '/web/session/authenticate') {
              return HttpResponse.json({
                jsonrpc: '2.0',
                id: body.id,
                error: {
                  code: 401,
                  message: 'Invalid credentials',
                  data: 'Authentication failed',
                },
              });
            }
            return HttpResponse.json({ jsonrpc: '2.0', id: body.id, result: {} });
          })
        );

        // ACT & ASSERT
        await expect(sdk.authenticate()).rejects.toThrow(OdooSdkError);
      });
    });

    describe('getContacts', () => {
      it('should return contacts from Odoo API', async () => {
        // ARRANGE
        // Mock authentication and contacts API
        server.use(
          http.post('*/jsonrpc', async ({ request }) => {
            const body = (await request.json()) as {
              method: string;
              params: Record<string, unknown>;
              id: number;
            };

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
                  result: [
                    {
                      id: 1,
                      name: 'John Doe',
                      email: 'john@example.com',
                      phone: '+1-555-0123',
                      write_date: '2024-01-15T10:00:00Z',
                      active: true,
                    },
                    {
                      id: 2,
                      name: 'Jane Smith',
                      email: 'jane@example.com',
                      phone: '+1-555-0124',
                      write_date: '2024-01-16T11:30:00Z',
                      active: true,
                    },
                    {
                      id: 3,
                      name: 'Archived Contact',
                      email: 'archived@example.com',
                      write_date: '2024-01-17T09:15:00Z',
                      active: false,
                    },
                  ],
                });
              }
            }

            return HttpResponse.json({ jsonrpc: '2.0', id: body.id, result: {} });
          })
        );

        // ACT
        const contacts = await sdk.getContacts();

        // ASSERT
        expect(contacts).toHaveLength(3);
        expect(contacts[0]).toMatchObject({
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1-555-0123',
          write_date: '2024-01-15T10:00:00Z',
          active: true,
        });
        expect(contacts[1]).toMatchObject({
          id: 2,
          name: 'Jane Smith',
          email: 'jane@example.com',
          phone: '+1-555-0124',
          write_date: '2024-01-16T11:30:00Z',
          active: true,
        });
        expect(contacts[2]).toMatchObject({
          id: 3,
          name: 'Archived Contact',
          email: 'archived@example.com',
          write_date: '2024-01-17T09:15:00Z',
          active: false,
        });
      });

      it('should authenticate automatically if not already authenticated', async () => {
        // ARRANGE
        // Mock authentication and contacts API - same as above but explicit for this test
        server.use(
          http.post('*/jsonrpc', async ({ request }) => {
            const body = (await request.json()) as {
              method: string;
              params: Record<string, unknown>;
              id: number;
            };

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
                  result: [
                    {
                      id: 1,
                      name: 'John Doe',
                      email: 'john@example.com',
                      phone: '+1-555-0123',
                      write_date: '2024-01-15T10:00:00Z',
                      active: true,
                    },
                    {
                      id: 2,
                      name: 'Jane Smith',
                      email: 'jane@example.com',
                      phone: '+1-555-0124',
                      write_date: '2024-01-16T11:30:00Z',
                      active: true,
                    },
                    {
                      id: 3,
                      name: 'Archived Contact',
                      email: 'archived@example.com',
                      write_date: '2024-01-17T09:15:00Z',
                      active: false,
                    },
                  ],
                });
              }
            }

            return HttpResponse.json({ jsonrpc: '2.0', id: body.id, result: {} });
          })
        );

        // ACT
        const contacts = await sdk.getContacts();

        // ASSERT
        expect(contacts).toHaveLength(3);
        expect(contacts[0]).toMatchObject({
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1-555-0123',
          write_date: '2024-01-15T10:00:00Z',
          active: true,
        });
        expect(contacts[1]).toMatchObject({
          id: 2,
          name: 'Jane Smith',
          email: 'jane@example.com',
          phone: '+1-555-0124',
          write_date: '2024-01-16T11:30:00Z',
          active: true,
        });
        expect(contacts[2]).toMatchObject({
          id: 3,
          name: 'Archived Contact',
          email: 'archived@example.com',
          write_date: '2024-01-17T09:15:00Z',
          active: false,
        });
      });

      it('should handle API errors gracefully', async () => {
        // ARRANGE
        // Mock successful authentication but failed contacts API call
        server.use(
          http.post('*/jsonrpc', async ({ request }) => {
            const body = (await request.json()) as {
              method: string;
              params: { service?: string };
              id: number;
            };

            if (body.method === '/web/session/authenticate') {
              return HttpResponse.json({
                jsonrpc: '2.0',
                id: body.id,
                result: {
                  uid: 1,
                  user_context: {},
                  db: 'test_db',
                  username: 'test_user',
                  session_id: 'mock_session_123',
                },
              });
            }

            if (body.method === 'call' && body.params['service'] === 'object') {
              return HttpResponse.json({
                jsonrpc: '2.0',
                id: body.id,
                error: {
                  code: 500,
                  message: 'Database connection failed',
                  data: 'Server error',
                },
              });
            }

            return HttpResponse.json({ jsonrpc: '2.0', id: body.id, result: {} });
          })
        );

        // ACT & ASSERT
        await expect(sdk.getContacts()).rejects.toThrow(OdooSdkError);
      });

      it('should return contacts with proper structure', async () => {
        // ARRANGE
        // Mock authentication and contacts API with structured response
        server.use(
          http.post('*/jsonrpc', async ({ request }) => {
            const body = (await request.json()) as {
              method: string;
              params: Record<string, unknown>;
              id: number;
            };

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
                  result: [
                    {
                      id: 1,
                      name: 'Test Contact',
                      email: 'test@example.com',
                      phone: '+1-555-0123',
                      write_date: '2024-01-15T10:00:00Z',
                      active: true,
                    },
                  ],
                });
              }
            }

            return HttpResponse.json({ jsonrpc: '2.0', id: body.id, result: {} });
          })
        );

        // ACT
        const contacts = await sdk.getContacts();

        // ASSERT
        for (const contact of contacts) {
          expect(contact).toHaveProperty('id');
          expect(contact).toHaveProperty('name');
          expect(contact).toHaveProperty('write_date');
          expect(contact).toHaveProperty('active');
          expect(typeof contact.id).toBe('number');
          expect(typeof contact.name).toBe('string');
          expect(typeof contact.active).toBe('boolean');
          // Verify write_date is a valid ISO date string
          expect(new Date(contact.write_date).toString()).not.toBe('Invalid Date');
        }
      });
    });

    describe('getContactCategories', () => {
      it('should return contact categories from Odoo API', async () => {
        // ARRANGE
        // Mock authentication and contact categories API
        server.use(
          http.post('*/jsonrpc', async ({ request }) => {
            const body = (await request.json()) as {
              method: string;
              params: Record<string, unknown>;
              id: number;
            };

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

            if (
              body.method === 'call' &&
              body.params['service'] === 'object' &&
              body.params['method'] === 'execute_kw'
            ) {
              const { args } = body.params as { args: unknown[] };
              const [, , , model] = args as [string, number, string, string];

              if (model === 'res.partner.category') {
                return HttpResponse.json({
                  jsonrpc: '2.0',
                  id: body.id,
                  result: [
                    {
                      id: 1,
                      name: 'Customer',
                      write_date: '2024-01-10T10:00:00Z',
                      active: true,
                    },
                    {
                      id: 2,
                      name: 'Vendor',
                      write_date: '2024-01-12T14:30:00Z',
                      active: true,
                    },
                  ],
                });
              }
            }

            return HttpResponse.json({ jsonrpc: '2.0', id: body.id, result: {} });
          })
        );

        // ACT
        const categories = await sdk.getContactCategories();

        // ASSERT
        expect(categories).toHaveLength(2);
        expect(categories[0]).toMatchObject({
          id: 1,
          name: 'Customer',
          write_date: '2024-01-10T10:00:00Z',
          active: true,
        });
        expect(categories[1]).toMatchObject({
          id: 2,
          name: 'Vendor',
          write_date: '2024-01-12T14:30:00Z',
          active: true,
        });
      });

      it('should authenticate automatically if not already authenticated', async () => {
        // ARRANGE
        // Mock authentication and contact categories API for auto-authentication test
        server.use(
          http.post('*/jsonrpc', async ({ request }) => {
            const body = (await request.json()) as {
              method: string;
              params: Record<string, unknown>;
              id: number;
            };

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

            if (
              body.method === 'call' &&
              body.params['service'] === 'object' &&
              body.params['method'] === 'execute_kw'
            ) {
              const { args } = body.params as { args: unknown[] };
              const [, , , model] = args as [string, number, string, string];

              if (model === 'res.partner.category') {
                return HttpResponse.json({
                  jsonrpc: '2.0',
                  id: body.id,
                  result: [
                    { id: 1, name: 'Customer', write_date: '2024-01-10T10:00:00Z', active: true },
                    { id: 2, name: 'Vendor', write_date: '2024-01-12T14:30:00Z', active: true },
                  ],
                });
              }
            }

            return HttpResponse.json({ jsonrpc: '2.0', id: body.id, result: {} });
          })
        );

        // ACT
        const categories = await sdk.getContactCategories();

        // ASSERT
        expect(categories).toHaveLength(2);
        expect(categories[0]).toMatchObject({
          id: 1,
          name: 'Customer',
          write_date: '2024-01-10T10:00:00Z',
          active: true,
        });
        expect(categories[1]).toMatchObject({
          id: 2,
          name: 'Vendor',
          write_date: '2024-01-12T14:30:00Z',
          active: true,
        });
      });
    });

    describe('testConnection', () => {
      it('should return true for successful connection test', async () => {
        // ARRANGE
        // Mock successful authentication for connection test
        server.use(
          http.post('*/jsonrpc', async ({ request }) => {
            const body = (await request.json()) as {
              method: string;
              params: Record<string, unknown>;
              id: number;
            };

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

            return HttpResponse.json({ jsonrpc: '2.0', id: body.id, result: {} });
          })
        );

        // ACT
        const result = await sdk.testConnection();

        // ASSERT
        expect(result).toBe(true);
      });

      it('should return false when authentication fails', async () => {
        // ARRANGE
        // Mock authentication failure for connection test
        server.use(
          http.post('*/jsonrpc', async ({ request }) => {
            const body = (await request.json()) as { method: string; id: number };

            if (body.method === '/web/session/authenticate') {
              return HttpResponse.json({
                jsonrpc: '2.0',
                id: body.id,
                error: {
                  code: 401,
                  message: 'Invalid credentials',
                },
              });
            }

            return HttpResponse.json({ jsonrpc: '2.0', id: body.id, result: {} });
          })
        );

        // ACT
        const result = await sdk.testConnection();

        // ASSERT
        expect(result).toBe(false);
      });
    });

    describe('error handling and retries', () => {
      it('should retry on network errors', async () => {
        // ARRANGE
        // Mock network error on first attempt, success on second
        let attempts = 0;
        server.use(
          http.post('*/jsonrpc', async ({ request }) => {
            attempts++;
            const body = (await request.json()) as { method: string; id: number };

            if (body.method === '/web/session/authenticate') {
              if (attempts === 1) {
                // Simulate network error by returning error response
                return HttpResponse.error();
              }
              return HttpResponse.json({
                jsonrpc: '2.0',
                id: body.id,
                result: {
                  uid: 1,
                  user_context: {},
                  db: 'test_db',
                  username: 'test_user',
                  session_id: 'mock_session_123',
                },
              });
            }
            return HttpResponse.json({ jsonrpc: '2.0', id: body.id, result: {} });
          })
        );

        // ACT
        await expect(sdk.authenticate()).resolves.not.toThrow();

        // ASSERT
        expect(attempts).toBeGreaterThan(1);
      });

      it('should throw error after max retries', async () => {
        // ARRANGE
        // Mock persistent network errors to test retry limit
        server.use(
          http.post('*/jsonrpc', () => {
            return HttpResponse.error();
          })
        );

        // ACT & ASSERT
        await expect(sdk.authenticate()).rejects.toThrow(OdooSdkError);
      });

      it('should handle HTTP errors properly', async () => {
        // ARRANGE
        // Mock HTTP 500 error response
        server.use(
          http.post('*/jsonrpc', () => {
            return new HttpResponse(null, { status: 500, statusText: 'Internal Server Error' });
          })
        );

        // ACT & ASSERT
        await expect(sdk.authenticate()).rejects.toThrow(OdooSdkError);
      });
    });
  });

  describe('Factory functions', () => {
    describe('createOdooSdk', () => {
      it('should create OdooSdk instance', () => {
        // ARRANGE
        // ACT
        const sdk = createOdooSdk(mockCredentials);

        // ASSERT
        expect(sdk).toBeInstanceOf(OdooSdk);
      });

      it('should create SDK with custom configuration', () => {
        // ARRANGE
        const customConfig = {
          timeout: 10000,
          retryAttempts: 5,
          retryDelayMs: 500,
        };

        // ACT
        const sdk = createOdooSdk(mockCredentials, customConfig);

        // ASSERT
        expect(sdk).toBeInstanceOf(OdooSdk);
      });

      it('should create SDK with different credentials', () => {
        // ARRANGE
        const differentCredentials: OdooCredentials = {
          url: 'https://different.odoo.com',
          database: 'different_db',
          username: 'different_user',
          apiKey: 'different_api_key',
        };

        // ACT
        const sdk = createOdooSdk(differentCredentials);

        // ASSERT
        expect(sdk).toBeInstanceOf(OdooSdk);
      });
    });

    describe('getContactsFromOdoo', () => {
      it('should provide backward compatibility for contacts retrieval', async () => {
        // ARRANGE
        // Mock authentication and contacts API for backward compatibility function
        server.use(
          http.post('*/jsonrpc', async ({ request }) => {
            const body = (await request.json()) as {
              method: string;
              params: Record<string, unknown>;
              id: number;
            };

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
                  result: [
                    {
                      id: 1,
                      name: 'John Doe',
                      email: 'john@example.com',
                      phone: '+1-555-0123',
                      write_date: '2024-01-15T10:00:00Z',
                      active: true,
                    },
                    {
                      id: 2,
                      name: 'Jane Smith',
                      email: 'jane@example.com',
                      phone: '+1-555-0124',
                      write_date: '2024-01-16T11:30:00Z',
                      active: true,
                    },
                    {
                      id: 3,
                      name: 'Archived Contact',
                      email: 'archived@example.com',
                      write_date: '2024-01-17T09:15:00Z',
                      active: false,
                    },
                  ],
                });
              }
            }

            return HttpResponse.json({ jsonrpc: '2.0', id: body.id, result: {} });
          })
        );

        // ACT
        const contacts = await getContactsFromOdoo(mockCredentials);

        // ASSERT
        expect(contacts).toHaveLength(3);
        expect(contacts[0]).toMatchObject({
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1-555-0123',
          write_date: '2024-01-15T10:00:00Z',
          active: true,
        });
        expect(contacts[1]).toMatchObject({
          id: 2,
          name: 'Jane Smith',
          email: 'jane@example.com',
          phone: '+1-555-0124',
          write_date: '2024-01-16T11:30:00Z',
          active: true,
        });
        expect(contacts[2]).toMatchObject({
          id: 3,
          name: 'Archived Contact',
          email: 'archived@example.com',
          write_date: '2024-01-17T09:15:00Z',
          active: false,
        });
      });

      it('should work with simplified convenience function', async () => {
        // ARRANGE
        // Mock authentication and contacts API for convenience function test
        server.use(
          http.post('*/jsonrpc', async ({ request }) => {
            const body = (await request.json()) as {
              method: string;
              params: Record<string, unknown>;
              id: number;
            };

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

            if (
              body.method === 'call' &&
              body.params['service'] === 'object' &&
              body.params['method'] === 'execute_kw'
            ) {
              return HttpResponse.json({
                jsonrpc: '2.0',
                id: body.id,
                result: [
                  {
                    id: 1,
                    name: 'Test Contact',
                    email: 'test@example.com',
                    write_date: '2024-01-15T10:00:00Z',
                    active: true,
                  },
                  {
                    id: 2,
                    name: 'Test Contact 2',
                    email: 'test2@example.com',
                    write_date: '2024-01-16T10:00:00Z',
                    active: true,
                  },
                  {
                    id: 3,
                    name: 'Test Contact 3',
                    email: 'test3@example.com',
                    write_date: '2024-01-17T10:00:00Z',
                    active: true,
                  },
                ],
              });
            }

            return HttpResponse.json({ jsonrpc: '2.0', id: body.id, result: {} });
          })
        );

        // ACT
        const contacts = await getContactsFromOdoo(mockCredentials);

        // ASSERT
        expect(contacts).toHaveLength(3);
        expect(contacts[0]).toMatchObject({
          id: 1,
          name: 'Test Contact',
          email: 'test@example.com',
          write_date: '2024-01-15T10:00:00Z',
          active: true,
        });
        expect(contacts[1]).toMatchObject({
          id: 2,
          name: 'Test Contact 2',
          email: 'test2@example.com',
          write_date: '2024-01-16T10:00:00Z',
          active: true,
        });
        expect(contacts[2]).toMatchObject({
          id: 3,
          name: 'Test Contact 3',
          email: 'test3@example.com',
          write_date: '2024-01-17T10:00:00Z',
          active: true,
        });
      });
    });
  });

  describe('Type definitions', () => {
    it('should properly type OdooCredentials', () => {
      // ARRANGE
      const credentials: OdooCredentials = {
        url: 'https://test.com',
        database: 'test',
        username: 'user',
        apiKey: 'api_key_123',
      };

      // ACT & ASSERT
      expect(typeof credentials.url).toBe('string');
      expect(typeof credentials.database).toBe('string');
      expect(typeof credentials.username).toBe('string');
      expect(typeof credentials.apiKey).toBe('string');
    });
  });
});
