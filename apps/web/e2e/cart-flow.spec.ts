import { expect, test } from './fixtures/test-base.js';

test.describe('Cart flow', () => {
  test('empty cart shows empty state', async ({ cartPage }) => {
    await cartPage.goto();
    await expect(cartPage.emptyState).toBeVisible();
    await expect(cartPage.continueShoppingLink).toBeVisible();
  });

  test('continue shopping link navigates to products', async ({ cartPage, page }) => {
    await cartPage.goto();
    await expect(cartPage.emptyState).toBeVisible();

    await cartPage.continueShoppingLink.click();
    await page.waitForURL('/');
  });

  test('add product to cart and verify cart page', async ({ productsPage, cartPage, page }) => {
    await productsPage.goto();
    await expect(productsPage.productCards.first()).toBeVisible();

    await productsPage.clickProduct(0);
    await page.waitForURL(/\/products\/.+/);

    await page.getByTestId('add-to-cart-button').click();
    await expect(page.getByText('Added to cart!')).toBeVisible();

    await cartPage.goto();
    await expect(cartPage.cartItems).toHaveCount(1);
  });

  test('add multiple quantities and verify in cart', async ({
    productsPage,
    productDetailPage,
    cartPage,
    page,
  }) => {
    await productsPage.goto();
    await expect(productsPage.productCards.first()).toBeVisible();
    await productsPage.clickProduct(0);
    await page.waitForURL(/\/products\/.+/);

    await productDetailPage.setQuantity(3);
    await productDetailPage.addToCart();
    await expect(productDetailPage.successMessage).toBeVisible();

    await cartPage.goto();
    await expect(cartPage.cartItems).toHaveCount(1);
    expect(await cartPage.getItemQuantity(0)).toBe(3);
  });

  test('remove item from cart', async ({ productsPage, cartPage, page }) => {
    await productsPage.goto();
    await expect(productsPage.productCards.first()).toBeVisible();
    await productsPage.clickProduct(0);
    await page.waitForURL(/\/products\/.+/);

    await page.getByTestId('add-to-cart-button').click();
    await expect(page.getByText('Added to cart!')).toBeVisible();

    await cartPage.goto();
    await expect(cartPage.cartItems).toHaveCount(1);

    await cartPage.removeItem(0);
    await expect(cartPage.emptyState).toBeVisible();
  });
});
