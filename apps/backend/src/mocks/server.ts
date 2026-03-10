import { setupServer } from 'msw/node';
import { handlers } from './handlers.js';

// Setup MSW server for Node.js environment (tests)
export const server = setupServer(...handlers);
