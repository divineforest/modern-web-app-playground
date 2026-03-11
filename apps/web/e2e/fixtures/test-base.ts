import { test as base, type Page } from '@playwright/test';
import { ApiHelper, testUser } from '../helpers/api-helper.js';
import { CartPage } from '../pages/cart-page.js';
import { CheckoutPage } from '../pages/checkout-page.js';
import { LoginPage } from '../pages/login-page.js';
import { OrderConfirmationPage } from '../pages/order-confirmation-page.js';
import { OrdersPage } from '../pages/orders-page.js';
import { ProductDetailPage } from '../pages/product-detail-page.js';
import { ProductsPage } from '../pages/products-page.js';
import { RegisterPage } from '../pages/register-page.js';
import { SearchResultsPage } from '../pages/search-results-page.js';

interface TestFixtures {
  productsPage: ProductsPage;
  productDetailPage: ProductDetailPage;
  cartPage: CartPage;
  ordersPage: OrdersPage;
  loginPage: LoginPage;
  registerPage: RegisterPage;
  checkoutPage: CheckoutPage;
  orderConfirmationPage: OrderConfirmationPage;
  searchResultsPage: SearchResultsPage;
  apiHelper: ApiHelper;
  /** Page pre-authenticated as a unique test user via API register + UI login. */
  authenticatedPage: Page;
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
  ordersPage: async ({ page }, use) => {
    await use(new OrdersPage(page));
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  registerPage: async ({ page }, use) => {
    await use(new RegisterPage(page));
  },
  checkoutPage: async ({ page }, use) => {
    await use(new CheckoutPage(page));
  },
  orderConfirmationPage: async ({ page }, use) => {
    await use(new OrderConfirmationPage(page));
  },
  searchResultsPage: async ({ page }, use) => {
    await use(new SearchResultsPage(page));
  },
  apiHelper: async ({ page }, use) => {
    await use(new ApiHelper(page.request));
  },
  authenticatedPage: async ({ page }, use) => {
    const user = testUser();

    // Register via UI — the register endpoint sets the session cookie on the
    // Vite proxy origin (localhost:5173), so all subsequent API calls are
    // correctly authenticated without any domain mismatch.
    await page.goto('/register');
    await page.locator('input[autocomplete=given-name]').fill(user.firstName);
    await page.locator('input[autocomplete=family-name]').fill(user.lastName);
    await page.locator('input[type=email]').fill(user.email);
    await page.locator('input[autocomplete=new-password]').first().fill(user.password);
    await page.locator('input[autocomplete=new-password]').last().fill(user.password);
    await page.getByRole('button', { name: 'Register' }).click();
    await page.waitForURL('/');

    await use(page);
  },
});

export { expect } from '@playwright/test';
export { testUser, uniqueEmail, type TestUser } from '../helpers/api-helper.js';
