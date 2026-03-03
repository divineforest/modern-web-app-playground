const DEFAULT_TEST_DATABASE_URL = 'postgresql://user:password@localhost:5432/accounting_test';

// Ensure the test runner always uses the dedicated test database connection.
// Priority: DATABASE_URL > default
const testDatabaseUrl = process.env['DATABASE_URL'] ?? DEFAULT_TEST_DATABASE_URL;

process.env['DATABASE_URL'] = testDatabaseUrl;
process.env['NODE_ENV'] = 'test';
process.env['API_BEARER_TOKENS'] = 'test_token_12345';

// VIES API configuration for tests
process.env['VIES_API_KEY'] = 'test_vies_api_key';
process.env['VIES_API_BASE_URL'] = 'https://api.vatcheckapi.com/v2';
process.env['VIES_API_TIMEOUT'] = '5000';
process.env['VIES_API_RETRY_ATTEMPTS'] = '0';
process.env['VIES_API_RETRY_DELAY_MS'] = '100';

// Stripe configuration for tests
process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_test_secret';
