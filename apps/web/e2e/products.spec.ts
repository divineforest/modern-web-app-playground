import { expect, test } from './fixtures/test-base.js';

test.describe('Products listing', () => {
  test('displays product cards on the home page', async ({ productsPage }) => {
    await productsPage.goto();

    await expect(productsPage.productCards.first()).toBeVisible();
    const count = await productsPage.getProductCount();
    expect(count).toBeGreaterThan(0);
  });

  test('each product card links to its detail page', async ({ productsPage }) => {
    await productsPage.goto();
    await expect(productsPage.productCards.first()).toBeVisible();

    const firstCard = productsPage.productCards.first();
    const link = firstCard.getByRole('link');
    const href = await link.getAttribute('href');
    expect(href).toMatch(/^\/products\/.+/);
  });

  test('clicking a product card navigates to product detail', async ({ productsPage, page }) => {
    await productsPage.goto();
    await expect(productsPage.productCards.first()).toBeVisible();

    await productsPage.clickProduct(0);

    await page.waitForURL(/\/products\/.+/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('pagination is visible when there are multiple pages', async ({ productsPage }) => {
    await productsPage.goto();
    await expect(productsPage.productCards.first()).toBeVisible();

    const count = await productsPage.getProductCount();
    if (count >= 20) {
      await expect(productsPage.pagination).toBeVisible();
    }
  });
});
