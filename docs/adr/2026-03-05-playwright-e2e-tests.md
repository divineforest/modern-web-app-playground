# Playwright E2E Tests

**Status:** accepted
**Date:** 2026-03-05

## Context

The web application (`apps/web/`) has zero automated tests. The backend has comprehensive unit/integration tests (Vitest + MSW) and smoke tests that validate server health endpoints, but nothing verifies that the frontend renders correctly, handles user interactions, or integrates with the backend through the browser.

### Current testing gap

```
apps/backend/tests/                    → Unit, integration, smoke tests (Vitest)
apps/web/                              → No tests of any kind
```

The web app has three pages with real user flows:

| Route | Flow |
|-------|------|
| `/` | Browse products grid, paginate, click to detail |
| `/products/:slug` | View product, select quantity, add to cart |
| `/cart` | View cart, update quantities, remove items, clear cart |

These flows involve cross-app integration: the web app calls the backend API via `@ts-rest/core` client (`apps/web/src/lib/api-client.ts`), manages cart tokens in `localStorage` (`apps/web/src/lib/cart-token.ts`), and maintains global cart state via React context (`apps/web/src/contexts/cart-context.tsx`).

Bugs in this integration layer — wrong API calls, broken token handling, missing error states — are invisible to backend tests and only caught by manual QA.

### Constraints

- The web app depends on a running backend (Fastify on port 3000) and PostgreSQL database.
- Vite proxies `/api` requests to the backend during development.
- CI already provisions PostgreSQL, runs migrations, and builds the backend. E2E tests SHALL reuse this infrastructure.
- The monorepo uses pnpm workspaces. Any new tooling SHALL integrate with the existing `pnpm` script conventions.

## Decision

Add Playwright as the E2E test framework, installed in `apps/web/`, testing the full web application against real backend and database services.

### 1. Package installation

Playwright is added as a dev dependency to `apps/web/`:

```jsonc
// apps/web/package.json
{
  "devDependencies": {
    "@playwright/test": "^1.52.0"
  },
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:report": "playwright show-report"
  }
}
```

Root `package.json` delegates to the web package:

```jsonc
// package.json (root)
{
  "scripts": {
    "test:e2e": "pnpm --filter @mercado/web test:e2e",
    "test:e2e:ui": "pnpm --filter @mercado/web test:e2e:ui"
  }
}
```

### 2. Playwright configuration

```typescript
// apps/web/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: 'pnpm --filter @mercado/backend dev',
      url: 'http://localhost:3000/healthz',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      cwd: '../../',
    },
    {
      command: 'pnpm --filter @mercado/web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
      cwd: '../../',
    },
  ],
});
```

Key design choices:
- `webServer` starts both backend and web dev servers automatically. In local development, `reuseExistingServer: true` skips startup if servers are already running.
- Single browser project (Chromium) to start. Cross-browser testing can be added later without structural changes.
- `trace: 'on-first-retry'` captures traces only on failures, keeping CI artifacts small.
- `workers: 1` in CI to avoid database contention between parallel tests.

### 3. File structure

```
apps/web/
├── e2e/
│   ├── fixtures/
│   │   └── test-base.ts         # Extended test fixture with API helpers
│   ├── pages/
│   │   ├── products-page.ts     # Products listing page object
│   │   ├── product-detail-page.ts  # Product detail page object
│   │   └── cart-page.ts         # Cart page object
│   ├── products.spec.ts         # Products listing tests
│   ├── product-detail.spec.ts   # Product detail tests
│   ├── cart-flow.spec.ts        # Full cart user flow tests
│   └── test-results/            # .gitignored output directory
├── playwright.config.ts
└── ...
```

### 4. Page Object pattern

Each page gets a Page Object class that encapsulates selectors and interactions:

```typescript
// apps/web/e2e/pages/products-page.ts
import type { Locator, Page } from '@playwright/test';

export class ProductsPage {
  readonly productCards: Locator;
  readonly nextPageButton: Locator;
  readonly loadingIndicator: Locator;

  constructor(private readonly page: Page) {
    this.productCards = page.getByTestId('product-card');
    this.nextPageButton = page.getByRole('button', { name: /next/i });
    this.loadingIndicator = page.getByRole('progressbar');
  }

  async goto() {
    await this.page.goto('/');
  }

  async clickProduct(index: number) {
    await this.productCards.nth(index).click();
  }

  async getProductCount() {
    return this.productCards.count();
  }
}
```

```typescript
// apps/web/e2e/pages/cart-page.ts
import type { Locator, Page } from '@playwright/test';

export class CartPage {
  readonly cartItems: Locator;
  readonly emptyState: Locator;
  readonly clearCartButton: Locator;
  readonly continueShoppingLink: Locator;

  constructor(private readonly page: Page) {
    this.cartItems = page.getByTestId('cart-item');
    this.emptyState = page.getByText('Your cart is empty');
    this.clearCartButton = page.getByRole('button', { name: /clear cart/i });
    this.continueShoppingLink = page.getByRole('link', { name: /continue shopping/i });
  }

  async goto() {
    await this.page.goto('/cart');
  }

  async getItemCount() {
    return this.cartItems.count();
  }

  async removeItem(index: number) {
    await this.cartItems.nth(index).getByRole('button', { name: /remove/i }).click();
  }
}
```

### 5. Test fixture with API helpers

A custom fixture provides test data setup via direct API calls, avoiding slow UI-based setup:

```typescript
// apps/web/e2e/fixtures/test-base.ts
import { test as base } from '@playwright/test';
import { CartPage } from '../pages/cart-page.js';
import { ProductDetailPage } from '../pages/product-detail-page.js';
import { ProductsPage } from '../pages/products-page.js';

interface TestFixtures {
  productsPage: ProductsPage;
  productDetailPage: ProductDetailPage;
  cartPage: CartPage;
}

export const test = base.extend<TestFixtures>({
  productsPage: async ({ page }, use) => {
    await use(new ProductsPage(page));
  },
  productDetailPage: async ({ page }, use) => {
    await use(new ProductDetailPage(page));
  },
  cartPage: async ({ page }, use) => {
    await use(new CartPage(page));
  },
});

export { expect } from '@playwright/test';
```

### 6. Example test spec

```typescript
// apps/web/e2e/cart-flow.spec.ts
import { test, expect } from './fixtures/test-base.js';

test.describe('Cart flow', () => {
  test('add product to cart and verify cart page', async ({ productsPage, cartPage, page }) => {
    await productsPage.goto();
    await expect(productsPage.productCards.first()).toBeVisible();

    await productsPage.clickProduct(0);

    await page.getByRole('button', { name: /add to cart/i }).click();
    await expect(page.getByText(/added to cart/i)).toBeVisible();

    await cartPage.goto();
    await expect(cartPage.cartItems).toHaveCount(1);
  });

  test('empty cart shows empty state', async ({ cartPage }) => {
    await cartPage.goto();
    await expect(cartPage.emptyState).toBeVisible();
    await expect(cartPage.continueShoppingLink).toBeVisible();
  });
});
```

### 7. Test data strategy

E2E tests SHALL rely on products seeded in the database before the test suite runs. The `pnpm db:seed:products` script (already exists) populates products into the dev/test database. The Playwright `globalSetup` runs this seed before all tests:

```typescript
// apps/web/e2e/global-setup.ts
import { execSync } from 'node:child_process';

export default function globalSetup() {
  execSync('pnpm db:seed:products', {
    cwd: '../../',
    stdio: 'inherit',
    env: { ...process.env },
  });
}
```

Referenced in `playwright.config.ts`:

```typescript
export default defineConfig({
  globalSetup: './e2e/global-setup.ts',
  // ...
});
```

Cart state is ephemeral (stored via cart token in `localStorage`), so each test starts with a fresh browser context and an empty cart by default.

### 8. CI integration

A new `e2e` job in `.github/workflows/ci.yml`, running after the existing `tests` job:

```yaml
# .github/workflows/ci.yml (new job)
e2e:
  name: E2E Tests
  runs-on: ubuntu-latest
  needs: [static-checks, tests]

  services:
    postgres:
      image: postgres:15-alpine
      env:
        POSTGRES_USER: user
        POSTGRES_PASSWORD: password
        POSTGRES_DB: mercado_test
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
      ports:
        - 5432:5432

  steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Setup pnpm
      uses: pnpm/action-setup@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version-file: '.nvmrc'
        cache: 'pnpm'

    - name: Install dependencies
      run: pnpm install --frozen-lockfile

    - name: Install Playwright browsers
      run: pnpm --filter @mercado/web exec playwright install --with-deps chromium

    - name: Setup database
      run: |
        sudo apt-get update && sudo apt-get install -y postgresql-client
        PGPASSWORD=password psql -h localhost -U user -d mercado_test << 'EOF'
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        CREATE EXTENSION IF NOT EXISTS "pg_trgm";
        EOF
        pnpm --filter @mercado/backend db:migrate
      env:
        DATABASE_URL: postgresql://user:password@localhost:5432/mercado_test

    - name: Run E2E tests
      run: pnpm test:e2e
      env:
        NODE_ENV: test
        DATABASE_URL: postgresql://user:password@localhost:5432/mercado_test
        PORT: 3000
        HOST: localhost
        LOG_LEVEL: error
        API_BEARER_TOKENS: ci_test_token_12345
        VIES_API_KEY: ci_test_vies_key
        CORE_API_URL: http://localhost:4000
        CORE_API_KEY: ci_test_api_key
        CI: true

    - name: Upload test artifacts
      uses: actions/upload-artifact@v4
      if: ${{ !cancelled() }}
      with:
        name: playwright-report
        path: apps/web/e2e/test-results/
        retention-days: 14
```

### 9. `.gitignore` additions

```
# apps/web/.gitignore
e2e/test-results/
playwright-report/
blob-report/
```

### 10. `data-testid` conventions

Components in `apps/web/src/` SHALL use `data-testid` attributes for elements that E2E tests interact with. Naming convention: `kebab-case`, scoped by component.

| Source file | `data-testid` value | Element |
|-------------|---------------------|---------|
| `apps/web/src/pages/products.tsx` | `product-card` | Each product card in the grid |
| `apps/web/src/pages/product-detail.tsx` | `quantity-input` | Quantity number input |
| `apps/web/src/pages/product-detail.tsx` | `add-to-cart-button` | Add to cart button |
| `apps/web/src/pages/cart.tsx` | `cart-item` | Each cart line item |
| `apps/web/src/pages/cart.tsx` | `cart-item-quantity` | Quantity control per item |
| `apps/web/src/pages/cart.tsx` | `clear-cart-button` | Clear cart button |

Tests SHALL prefer accessible selectors (`getByRole`, `getByText`) over `data-testid` when the accessible name is stable. `data-testid` is a fallback for elements without unique accessible identifiers.

## Consequences

### Positive

- **User flow coverage**: The three core flows (browse → detail → cart) are validated end-to-end through a real browser, catching integration bugs that backend tests cannot.
- **Regression safety**: Frontend refactors (component restructuring, styling changes) are validated against actual rendering and interaction behavior.
- **CI integration**: E2E runs on every PR alongside existing backend tests, preventing broken user flows from reaching production.
- **Developer experience**: `pnpm test:e2e:ui` provides Playwright's interactive UI mode for debugging tests locally with trace viewer.

### Negative

- **Slower CI**: The `e2e` job adds ~3 minutes to CI pipeline time (Chromium install: ~30s cached, server startup: ~15s, test execution: ~60s for 3 spec files, overhead: ~30s). This runs in parallel with `smoke-test`, so wall-clock impact is limited to whichever is slower.
- **Test data dependency**: Tests depend on `db:seed:products` producing a known data set. If seed data changes, tests may need updates.
- **Browser install size**: Chromium binary (~150MB) must be downloaded in CI. Cached by `pnpm install` caching in subsequent runs.
- **`data-testid` additions**: Existing components need minor modifications to add test ID attributes.

### AI-Friendliness Impact

- **Discoverability**: 5/5 — Test files live in `apps/web/e2e/`, co-located with the web app they test. Page objects map 1:1 to page components. An LLM searching for "cart tests" finds `cart-flow.spec.ts` and `cart-page.ts` immediately.
- **Cohesion**: 4/5 — Page objects co-locate selectors and actions for each page. The test fixture centralizes page object instantiation. Slight penalty: `globalSetup` references backend seed script across app boundaries.
- **Pattern consistency**: 5/5 — Page Object Model is the standard Playwright pattern. Test structure (describe → test → arrange/act/assert) matches the backend's existing Vitest conventions.
- **Type coverage**: 4/5 — Playwright provides full TypeScript types for all APIs. Page objects are typed. Test IDs are string literals without a shared constant (trade-off for simplicity).
- **Traceability**: 4/5 — Full import chain from test to production code:
  ```
  apps/web/e2e/cart-flow.spec.ts
    → import { test, expect } from './fixtures/test-base.js'
      → import { CartPage } from '../pages/cart-page.js'
        → page.getByTestId('cart-item')
          → data-testid="cart-item" in apps/web/src/pages/cart.tsx
  ```
  An LLM can follow imports to locate every affected file.

**Overall AI-friendliness: 4/5**

## Options Considered

### Option A: Playwright in `apps/web/` (recommended)

As described above. Playwright installed in the web package, tests in `apps/web/e2e/`, `webServer` config starts both servers.

**Trade-offs:**
- Playwright's `webServer` manages server lifecycle, reducing manual setup.
- Co-location with the web app makes ownership clear.
- Single `pnpm test:e2e` command from root.
- AI-friendliness: 4/5 — clear co-location, 1:1 page object mapping, standard Playwright patterns.

### Option B: Separate `packages/e2e` workspace package

Create a dedicated package for E2E tests, isolated from both `apps/web` and `apps/backend`:

```
packages/e2e/
├── package.json          # @mercado/e2e
├── playwright.config.ts
└── tests/
    └── ...
```

**Rejected because:**
- Adds a third package to maintain with its own `tsconfig.json`, dependencies, and build config.
- E2E tests are inherently coupled to the web app's DOM structure. Separating them into a different package obscures this coupling without reducing it.
- No shared code between E2E tests and other packages — the package boundary adds friction with no reuse benefit.
- AI-friendliness: 3/5 — an LLM working on `apps/web/src/pages/cart.tsx` must search a separate package to find related E2E tests. The co-location signal is lost.

### Option C: Cypress instead of Playwright

Use Cypress as the E2E framework.

**Rejected because:**
- Cypress runs tests inside the browser, limiting multi-tab and multi-origin scenarios.
- Playwright's `webServer` config natively handles multi-server startup (backend + frontend), which Cypress requires plugins or manual scripting for.
- Playwright's auto-wait and locator APIs (`getByRole`, `getByTestId`) produce less flaky tests than Cypress's retry-based assertion model.
- Playwright's trace viewer and `--ui` mode provide superior debugging for CI failures.
- Playwright has broader CI support (GitHub Actions reporter, artifact upload patterns).
- AI-friendliness: 3/5 — Cypress's custom command pattern (`cy.addToCart()`) is less type-traceable than Playwright's page object imports. Cypress config uses a different mental model (plugins, support files) that adds concepts without benefit.

## Migration Path

1. Run `pnpm --filter @mercado/web add -D @playwright/test` and `pnpm --filter @mercado/web exec playwright install chromium`. Create `apps/web/playwright.config.ts`. Verify: `pnpm --filter @mercado/web exec playwright test` runs (0 tests found).
2. Add `data-testid` attributes to `apps/web/src/pages/products.tsx` (`product-card`), `apps/web/src/pages/product-detail.tsx` (`quantity-input`, `add-to-cart-button`), and `apps/web/src/pages/cart.tsx` (`cart-item`, `cart-item-quantity`, `clear-cart-button`). Verify: `pnpm lint:web` passes.
3. Create `apps/web/e2e/pages/products-page.ts`, `apps/web/e2e/pages/product-detail-page.ts`, `apps/web/e2e/pages/cart-page.ts`. Verify: TypeScript compiles without errors.
4. Create `apps/web/e2e/fixtures/test-base.ts` exporting the extended `test` with page object fixtures.
5. Write `apps/web/e2e/products.spec.ts` — validates product listing loads, cards render, pagination works. Verify: `pnpm test:e2e` passes with 1 spec file.
6. Write `apps/web/e2e/product-detail.spec.ts` — validates product detail renders, add-to-cart flow works. Verify: `pnpm test:e2e` passes with 2 spec files.
7. Write `apps/web/e2e/cart-flow.spec.ts` — validates full browse → add → view cart → modify → remove flow. Verify: `pnpm test:e2e` passes with 3 spec files.
8. Add `apps/web/e2e/global-setup.ts` for database seeding via `pnpm db:seed:products`.
9. Add `test:e2e` and `test:e2e:ui` scripts to root `package.json`. Verify: `pnpm test:e2e` from root works.
10. Add `e2e` job to `.github/workflows/ci.yml` with PostgreSQL service, Chromium install, and artifact upload. Verify: CI pipeline passes on a test PR.
