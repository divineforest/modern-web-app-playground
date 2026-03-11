# E2E Testing Architecture

## Quick Reference

- **Installation**: `pnpm add -Dw playwright` (workspace root for CLI), `pnpm --filter @mercado/web add -D @playwright/test` (test runner), then `pnpm exec playwright install chromium`
- **Framework**: Playwright (Chromium)
- **Location**: `apps/web/e2e/`
- **Config**: `apps/web/playwright.config.ts`
- **Run**: `pnpm --filter web e2e` (local), CI via GitHub Actions
- **Feature specs**: `docs/specs/` (7 specs: auth, cart, cart-on-list-page, cart-sidebar, checkout, my-orders, search)

## Structure

```
apps/web/e2e/
├── fixtures/
│   └── test-base.ts          # Custom Playwright fixtures (injects POMs)
├── pages/
│   ├── products-page.ts      # Products listing POM
│   ├── product-detail-page.ts # Product detail POM
│   ├── cart-page.ts           # Cart POM
│   └── orders-page.ts        # My orders POM
├── products.spec.ts           # Product browsing + pagination (4 tests)
├── product-detail.spec.ts     # Product detail + quantity controls (4 tests)
├── cart-flow.spec.ts          # Cart add/remove/empty/quantity (5 tests)
├── search.spec.ts             # Search query/sort/pagination/validation (11 tests)
├── my-orders.spec.ts          # Orders auth redirect + empty state (3 tests)
├── global-setup.ts            # Seeds products via pnpm db:seed:products
└── test-results/
```

**Total**: 26 tests across 5 spec files.

## Page Object Model

1:1 mapping between app pages and POM classes. All selectors defined in constructor, all interactions as methods. POMs injected via custom Playwright fixtures in `test-base.ts` — tests never construct them manually.

**Gap**: `search.spec.ts` (11 tests, largest spec) uses raw `page` interactions with no POM.

## Test Data

- **Seed**: `global-setup.ts` runs `pnpm db:seed:products` once before all tests
- **Cart state**: Ephemeral per browser context (fresh localStorage = empty cart per test)
- **No test users**: All tests run as anonymous/guest — no authenticated flows tested
- **No API helpers**: No programmatic test data creation (no `ApiHelper` fixture)

## CI Configuration

- GitHub Actions with PostgreSQL service container
- `retries: 2`, `workers: 1` (sequential to avoid DB contention)
- Screenshots on failure, traces on first retry
- Artifacts uploaded with 14-day retention
- `forbidOnly: true` prevents `.only` from leaking to CI
- Health check on backend before tests start
- Chromium only (no Firefox/WebKit)

---

## Assessment Rubric

### Scoring Criteria

| # | Criterion | What it measures | Score |
|---|-----------|-----------------|-------|
| 1 | User Journey Coverage | Critical user flows tested end-to-end (browse, search, cart, checkout, auth, orders) | 5.0 |
| 2 | Selector Resilience | Selectors resistant to UI refactors (data-testid, getByRole vs fragile CSS) | 8.0 |
| 3 | Test Isolation | Each test starts from clean state, no inter-test dependencies | 8.5 |
| 4 | Flakiness Resistance | No hard waits, proper auto-wait, no race conditions | 8.5 |
| 5 | Page Object Architecture | Clean abstraction, selectors encapsulated, tests read like user stories | 9.0 |
| 6 | Error & Edge Case Coverage | Error states, empty states, validation, boundary conditions | 5.5 |
| 7 | CI/CD Integration | Reliable CI, artifact capture, retry strategy, parallelization | 9.0 |
| 8 | Test Data Management | Deterministic seed data, no shared mutable state, setup/teardown | 6.5 |
| 9 | Assertion Quality | Assertions meaningful, specific, verifying the right things | 7.0 |
| 10 | Maintainability & Readability | New developer can understand quickly, DRY where it matters | 8.0 |
| | **Total** | | **7.5** |

### Detailed Findings

#### 1. User Journey Coverage — 5.0

**Covered**: product browsing, pagination, product detail, quantity controls, cart CRUD, search (query, sort, pagination, validation, edge cases), orders (auth redirect, empty state).

**Missing (critical)**:
- Authentication flow (register, login, logout) — no tests despite `docs/specs/auth.md`
- Checkout flow (address, order placement, confirmation) — zero tests despite `docs/specs/checkout.md`
- All tests run as guest — no authenticated user flows
- Guest-to-authenticated cart merge (described in `docs/specs/cart.md`)
- Cart sidebar (`docs/specs/cart-sidebar.md`)
- Cart on list page / quick add-to-cart (`docs/specs/cart-on-list-page.md`)
- Order history with actual orders (only empty state tested)

#### 2. Selector Resilience — 8.0

**Strong**: consistent `data-testid` usage, `getByRole()` for semantic elements, `getByText()` for user content.

**Weak**:
- `search.spec.ts:129` — checks `MuiButton-contained` CSS class (MUI internal, breaks on upgrades)
- `product-detail-page.ts:18` — price uses regex `text=/\\$[\\d,.]+/` (fragile to format changes)
- Icon buttons use MUI's internal test IDs (`[data-testid="AddIcon"]`) instead of custom ones

#### 3. Test Isolation — 8.5

**Strong**: fresh browser context per test, no `beforeEach` with business data, tests are order-independent, `fullyParallel: true` locally.

**Weak**: all tests share seeded product DB; cart operations create server-side records that accumulate; `workers: 1` in CI masks potential isolation issues.

#### 4. Flakiness Resistance — 8.5

**Strong**: zero `waitForTimeout()` calls, proper `waitForURL()` for navigation, Playwright auto-retry on all assertions, conditional pagination test avoids failures on small datasets.

**Weak**:
- `search.spec.ts:57` — conditional pagination silently passes when condition isn't met
- `setQuantity()` reads `textContent()` then clicks N times — potential race on slow UI updates
- No explicit wait for loading states to disappear before interacting

#### 5. Page Object Architecture — 9.0

**Strong**: clean 1:1 page-to-POM mapping, selectors in constructor, actions as methods, custom fixtures inject POMs, `test-base.ts` as single entry point.

**Weak**: `search.spec.ts` (largest spec, 11 tests) has no POM — selectors scattered throughout. No shared navigation helpers for repeated setup patterns.

#### 6. Error & Edge Case Coverage — 5.5

**Covered**: search validation (short queries), empty results, empty query state, empty cart, unauthenticated redirect, empty orders.

**Missing**: network errors (API 500, timeouts), form validation, cart boundaries (duplicate product, max quantity, out-of-stock), auth errors (wrong password, duplicate email), 404 page, session expiry, cart token cookie behavior.

#### 7. CI/CD Integration — 9.0

**Strong**: full GitHub Actions job, PostgreSQL service container, `retries: 2`, screenshots/traces, artifact upload (14-day retention), `forbidOnly: true`, health check before tests.

**Weak**: Chromium only, no test sharding, no HTML report artifact.

#### 8. Test Data Management — 6.5

**Strong**: global seed via `pnpm db:seed:products`, ephemeral cart per context, graceful error handling if products already exist.

**Weak**: single global seed with no per-test data setup, no test user accounts, no API helper fixtures, no cleanup between runs, seed data assumptions not documented in test files.

#### 9. Assertion Quality — 7.0

**Strong**: assertions verify user-visible outcomes (text, URL, element count), URL assertions check route + query params, cart quantity assertions check values.

**Weak**:
- Many `toBeVisible()` assertions without content checks (e.g., H1 visible but name not verified)
- No price correctness assertions (product price vs cart price)
- Search tests don't verify results match the query
- `products.spec.ts:37` — conditional assertion means pagination might never be tested
- `my-orders.spec.ts:10-14` — tests 2-3 expect empty state but never authenticate (likely false positives since test 1 confirms redirect)

#### 10. Maintainability & Readability — 8.0

**Strong**: tests read like user stories, consistent describe/test structure, POMs abstract selectors, TypeScript throughout, file names match features.

**Weak**: duplicated setup in cart-flow tests (4/5 tests repeat same navigation), `search.spec.ts` is 134 lines with no POM, no comments explaining seed data assumptions, inconsistent imports (`@playwright/test` vs `./fixtures/test-base.js`).

---

## Improvement Priorities

Listed in priority order. Each item notes which scoring criteria it improves.

### 1. Authentication + checkout flow tests → criteria 1, 6

The largest gap. Requires:
- Auth fixture that registers/logs in a test user via API
- Tests for: register → login → browse → cart → checkout → confirmation → order history
- Guest cart merge on login, session persistence, logout

New files: `e2e/pages/login-page.ts`, `e2e/pages/register-page.ts`, `e2e/pages/checkout-page.ts`, `e2e/pages/order-confirmation-page.ts`, `e2e/auth.spec.ts`, `e2e/checkout-flow.spec.ts`. Update `e2e/fixtures/test-base.ts` with `authenticatedPage` fixture.

### 2. API helper fixture for test data → criteria 8, 1

Create `ApiHelper` class injected as a Playwright fixture:
- `createUser()` via `POST /api/auth/register`
- `addToCart()` via `POST /api/cart/items`
- `placeOrder()` via `POST /api/checkout`

Enables fast setup without UI navigation and unblocks authenticated flow tests.

### 3. SearchResultsPage POM → criteria 5, 10

Extract selectors and actions from `search.spec.ts` (11 tests, 134 lines) into a `SearchResultsPage` POM. Update imports to use `test-base.ts` fixtures.

### 4. Network error and edge case tests → criteria 6

Use `page.route()` to mock API failures:
- API 500 → error state displayed
- Network timeout → user feedback
- Add same product twice → quantity increases
- 404 page

### 5. Assertion specificity → criteria 9

- Product detail: assert product name text, not just H1 visibility
- Search results: verify items contain the search term
- Cart: verify product name and price match what was added
- Replace conditional assertions with `test.skip()` when preconditions aren't met

### 6. Fix my-orders.spec.ts auth issue → criteria 9

Tests 2-3 navigate to `/orders` and assert empty state, but test 1 proves unauthenticated users redirect to `/login`. These tests pass for wrong reasons or are silently broken. They need authentication setup.

### 7. Remove MUI class assertions → criteria 2

Replace `toHaveClass(/MuiButton-contained/)` with accessible alternatives: `aria-pressed`, `aria-current`, custom `data-active` attribute, or `toHaveCSS()`.

### 8. Reduce test setup duplication → criteria 10

Extract shared helper: `navigateToFirstProductDetail(productsPage, page)` to replace the repeated 3-line navigation pattern in cart-flow and product-detail tests.
