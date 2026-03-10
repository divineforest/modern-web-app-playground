import { expect, test } from './fixtures/test-base.js';

test.describe('Product detail', () => {
  test('displays product information', async ({ productsPage, page }) => {
    await productsPage.goto();
    await expect(productsPage.productCards.first()).toBeVisible();

    await productsPage.clickProduct(0);
    await page.waitForURL(/\/products\/.+/);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByTestId('add-to-cart-button')).toBeVisible();
    await expect(page.getByTestId('quantity-input')).toHaveText('1');
  });

  test('quantity controls work correctly', async ({ productsPage, productDetailPage, page }) => {
    await productsPage.goto();
    await expect(productsPage.productCards.first()).toBeVisible();
    await productsPage.clickProduct(0);
    await page.waitForURL(/\/products\/.+/);

    await expect(productDetailPage.quantityDisplay).toHaveText('1');

    await productDetailPage.setQuantity(3);
    await expect(productDetailPage.quantityDisplay).toHaveText('3');

    await productDetailPage.setQuantity(1);
    await expect(productDetailPage.quantityDisplay).toHaveText('1');
  });

  test('add to cart shows success message', async ({ productsPage, productDetailPage, page }) => {
    await productsPage.goto();
    await expect(productsPage.productCards.first()).toBeVisible();
    await productsPage.clickProduct(0);
    await page.waitForURL(/\/products\/.+/);

    await productDetailPage.addToCart();

    await expect(productDetailPage.successMessage).toBeVisible();
  });

  test('back button navigates to previous page', async ({
    productsPage,
    productDetailPage,
    page,
  }) => {
    await productsPage.goto();
    await expect(productsPage.productCards.first()).toBeVisible();
    await productsPage.clickProduct(0);
    await page.waitForURL(/\/products\/.+/);

    await productDetailPage.backButton.click();

    await page.waitForURL('/');
    await expect(productsPage.productCards.first()).toBeVisible();
  });
});
