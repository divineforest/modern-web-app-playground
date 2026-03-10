import { expect, test } from '@playwright/test';

test.describe('Product Search', () => {
  test('header search bar is visible on all pages', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByPlaceholder('Search products...')).toBeVisible();

    await page.goto('/cart');
    await expect(page.getByPlaceholder('Search products...')).toBeVisible();

    await page.goto('/login');
    await expect(page.getByPlaceholder('Search products...')).toBeVisible();
  });

  test('submitting search query navigates to search results page', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.getByPlaceholder('Search products...');
    await searchInput.fill('shirt');
    await searchInput.press('Enter');

    await page.waitForURL(/\/search\?q=shirt/);
    expect(page.url()).toContain('/search?q=shirt&sort=relevance');
  });

  test('search results display matching products', async ({ page }) => {
    await page.goto('/search?q=shirt&sort=relevance');

    await expect(page.getByRole('heading', { name: /Search results for:/ })).toBeVisible();
    await expect(page.getByText(/results found/)).toBeVisible();

    const productCards = page.getByTestId('product-card');
    await expect(productCards.first()).toBeVisible();
  });

  test('sorting controls update URL and re-fetch results', async ({ page }) => {
    await page.goto('/search?q=shirt&sort=relevance');

    await page.getByRole('button', { name: 'Price: Low to High' }).click();
    await page.waitForURL(/\/search\?q=shirt&sort=price_asc/);
    expect(page.url()).toContain('sort=price_asc');
    expect(page.url()).toContain('page=1');

    await page.getByRole('button', { name: 'Price: High to Low' }).click();
    await page.waitForURL(/\/search\?q=shirt&sort=price_desc/);
    expect(page.url()).toContain('sort=price_desc');

    await page.getByRole('button', { name: 'Relevance' }).click();
    await page.waitForURL(/\/search\?q=shirt&sort=relevance/);
    expect(page.url()).toContain('sort=relevance');
  });

  test('pagination works correctly', async ({ page }) => {
    await page.goto('/search?q=shirt&sort=relevance');

    const paginationButtons = page.getByRole('navigation').getByRole('button');
    const hasMultiplePages = (await paginationButtons.count()) > 3;

    if (hasMultiplePages) {
      await page.getByRole('button', { name: 'Go to page 2' }).click();
      await page.waitForURL(/page=2/);
      expect(page.url()).toContain('page=2');

      await page.getByRole('button', { name: 'Go to page 1' }).click();
      await page.waitForURL(/page=1/);
      expect(page.url()).toContain('page=1');
    }
  });

  test('query too short shows validation error', async ({ page }) => {
    await page.goto('/search?q=a&sort=relevance');

    await expect(page.getByText(/Search query must be at least 2 characters/)).toBeVisible();
    await expect(page.getByTestId('product-card')).not.toBeVisible();
  });

  test('no results shows empty state message', async ({ page }) => {
    await page.goto('/search?q=nonexistentproduct12345&sort=relevance');

    await expect(
      page.getByText(/No products match your search. Try different keywords./)
    ).toBeVisible();
    await expect(page.getByTestId('product-card')).not.toBeVisible();
  });

  test('empty query shows empty state with instructions', async ({ page }) => {
    await page.goto('/search');

    await expect(page.getByRole('heading', { name: 'Search Products' })).toBeVisible();
    await expect(page.getByText(/Enter a search query to find products/)).toBeVisible();
    await expect(page.getByTestId('product-card')).not.toBeVisible();
  });

  test('product cards link to product detail page', async ({ page }) => {
    await page.goto('/search?q=shirt&sort=relevance');

    const firstCard = page.getByTestId('product-card').first();
    await expect(firstCard).toBeVisible();

    await firstCard.click();
    await page.waitForURL(/\/products\//);
    expect(page.url()).toMatch(/\/products\/[^/]+/);
  });

  test('search from search results page works', async ({ page }) => {
    await page.goto('/search?q=shirt&sort=relevance');

    const searchInput = page.getByPlaceholder('Search products...');
    await searchInput.clear();
    await searchInput.fill('pants');
    await searchInput.press('Enter');

    await page.waitForURL(/\/search\?q=pants/);
    expect(page.url()).toContain('/search?q=pants&sort=relevance');
    await expect(page.getByRole('heading', { name: /Search results for:.*pants/ })).toBeVisible();
  });

  test('result count displays correctly', async ({ page }) => {
    await page.goto('/search?q=shirt&sort=relevance');

    const resultText = page.getByText(/\d+ results? found/);
    await expect(resultText).toBeVisible();
  });

  test('sorting buttons highlight active sort', async ({ page }) => {
    await page.goto('/search?q=shirt&sort=price_asc');

    const priceAscButton = page.getByRole('button', { name: 'Price: Low to High' });
    await expect(priceAscButton).toHaveClass(/MuiButton-contained/);

    const relevanceButton = page.getByRole('button', { name: 'Relevance' });
    await expect(relevanceButton).toHaveClass(/MuiButton-outlined/);
  });
});
