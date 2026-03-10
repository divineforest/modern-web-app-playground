import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './src/mocks/server.js';

// Set test environment variables
process.env['NODE_ENV'] = 'test';

// Start MSW server before all tests
beforeAll(() => {
  console.log('[MSW] Starting MSW server in vitest.setup.ts');
  server.listen({
    // Log ALL requests for debugging
    onUnhandledRequest(req, print) {
      const url = new URL(req.url);

      // Always log API requests to see what's happening
      if (url.pathname.startsWith('/api') || url.pathname.startsWith('/jsonrpc')) {
        console.log('[MSW] Unhandled API request:', req.method, url.href);
        print.warning();
        return;
      }

      // Allow database and other non-API localhost services to pass through silently
      // These are things like PostgreSQL connections on port 5432, etc.
      if (
        (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
        !url.pathname.startsWith('/api') &&
        !url.pathname.startsWith('/jsonrpc')
      ) {
        return; // Silent bypass for non-API localhost requests
      }

      // Log other unhandled requests as warnings for debugging
      console.log('[MSW] Warning: unhandled external request:', req.method, url.href);
      print.warning();
    },
  });
  console.log('[MSW] MSW server started successfully');
});

// Reset handlers after each test to ensure test isolation
afterEach(() => {
  server.resetHandlers();
});

// Clean up after all tests
afterAll(() => {
  server.close();
});
