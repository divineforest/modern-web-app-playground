import { expect, test } from './fixtures/test-base.js';

test.describe('My Orders page', () => {
  test('redirects to login when unauthenticated', async ({ page, ordersPage }) => {
    await ordersPage.goto();
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });

  test('displays empty state when user has no orders', async ({ ordersPage }) => {
    await ordersPage.goto();
    await expect(ordersPage.emptyState).toBeVisible();
    await expect(ordersPage.browseProductsButton).toBeVisible();
  });

  test('browse products button navigates to catalog', async ({ ordersPage, page }) => {
    await ordersPage.goto();
    await expect(ordersPage.emptyState).toBeVisible();

    await ordersPage.browseProductsButton.click();
    await page.waitForURL('/');
    expect(page.url()).toMatch(/\/$/);
  });
});
