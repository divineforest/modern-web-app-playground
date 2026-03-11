import { expect, test } from './fixtures/test-base.js';

const TEST_ADDRESS = {
  fullName: 'Test Buyer',
  addressLine1: '123 Main Street',
  city: 'New York',
  postalCode: '10001',
  countryCode: 'US',
};

test.describe('Checkout flow', () => {
  test('checkout page redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/checkout');
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('returnTo=%2Fcheckout');
  });

  test('empty cart redirects authenticated user back to cart', async ({
    authenticatedPage: _auth,
    page,
  }) => {
    // Authenticated user with no cart items navigates to checkout
    await page.goto('/checkout');
    await page.waitForURL('/cart');
  });

  test('authenticated user can complete end-to-end checkout', async ({
    authenticatedPage: _auth,
    productsPage,
    productDetailPage,
    cartPage,
    checkoutPage,
    orderConfirmationPage,
    ordersPage,
    page,
  }) => {
    // Step 1: Add a product to cart
    await productsPage.goto();
    await expect(productsPage.productCards.first()).toBeVisible();
    const productName = await productsPage.productCards.first().getByRole('heading').textContent();

    await productsPage.gotoFirstProduct();
    await productDetailPage.addToCart();
    await expect(productDetailPage.successMessage).toBeVisible();

    // Step 2: Verify cart contains the item
    await cartPage.goto();
    await expect(cartPage.cartItems).toHaveCount(1);
    await expect(cartPage.cartItems.first()).toContainText(productName ?? '');

    // Step 3: Navigate to checkout and fill shipping address
    await checkoutPage.goto();
    await expect(checkoutPage.heading).toBeVisible();
    await expect(checkoutPage.orderSummaryHeading).toBeVisible();
    // Product name should appear in the order summary on the right panel
    await expect(page.getByText(productName ?? '', { exact: false })).toBeVisible();

    await checkoutPage.fillShippingAddress(TEST_ADDRESS);

    // Step 4: Place the order
    await checkoutPage.placeOrder();

    // Step 5: Verify order confirmation
    await page.waitForURL(/\/orders\/.+\/confirmation/);
    await expect(orderConfirmationPage.heading).toBeVisible();
    await expect(orderConfirmationPage.orderNumber).toBeVisible();

    // Step 6: Verify order appears in order history
    await ordersPage.goto();
    await expect(ordersPage.pageTitle).toBeVisible();
    const orderCount = await ordersPage.getOrderCount();
    expect(orderCount).toBeGreaterThan(0);
  });

  test('cart is cleared after successful checkout', async ({
    authenticatedPage: _auth,
    productsPage,
    productDetailPage,
    checkoutPage,
    cartPage,
    page,
  }) => {
    await productsPage.gotoFirstProduct();
    await productDetailPage.addToCart();
    await expect(productDetailPage.successMessage).toBeVisible();

    await checkoutPage.goto();
    await checkoutPage.fillShippingAddress(TEST_ADDRESS);
    await checkoutPage.placeOrder();

    await page.waitForURL(/\/orders\/.+\/confirmation/);

    // Cart should now be empty
    await cartPage.goto();
    await expect(cartPage.emptyState).toBeVisible();
  });
});
