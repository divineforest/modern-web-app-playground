import { test as base } from '@playwright/test';
import { CartPage } from '../pages/cart-page.js';
import { OrdersPage } from '../pages/orders-page.js';
import { ProductDetailPage } from '../pages/product-detail-page.js';
import { ProductsPage } from '../pages/products-page.js';

interface TestFixtures {
  productsPage: ProductsPage;
  productDetailPage: ProductDetailPage;
  cartPage: CartPage;
  ordersPage: OrdersPage;
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
});

export { expect } from '@playwright/test';
