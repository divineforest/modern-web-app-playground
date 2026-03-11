import { expect, test } from './fixtures/test-base.js';

test.describe('Product Search', () => {
  test('header search bar is visible on all pages', async ({ page }) => {
    for (const path of ['/', '/cart', '/login']) {
      await page.goto(path);
      await expect(page.getByPlaceholder('Search products...')).toBeVisible();
    }
  });

  test('submitting search query navigates to search results page', async ({
    searchResultsPage,
    page,
  }) => {
    await page.goto('/');
    await searchResultsPage.search('mug');

    await page.waitForURL(/\/search\?q=mug/);
    expect(page.url()).toContain('/search?q=mug&sort=relevance');
  });

  test('search results display matching products', async ({ searchResultsPage }) => {
    await searchResultsPage.goto({ q: 'mug', sort: 'relevance' });

    await expect(searchResultsPage.resultsHeading).toBeVisible();
    await expect(searchResultsPage.resultsHeading).toContainText('mug');
    await expect(searchResultsPage.resultCount).toBeVisible();
    await expect(searchResultsPage.productCards.first()).toBeVisible();
  });

  test('sorting controls update URL and re-fetch results', async ({ searchResultsPage, page }) => {
    await searchResultsPage.goto({ q: 'mug', sort: 'relevance' });

    await searchResultsPage.sortBy('price_asc');
    expect(page.url()).toContain('sort=price_asc');
    expect(page.url()).toContain('page=1');

    await searchResultsPage.sortBy('price_desc');
    expect(page.url()).toContain('sort=price_desc');

    await searchResultsPage.sortBy('relevance');
    expect(page.url()).toContain('sort=relevance');
  });

  test('pagination works correctly', async ({ searchResultsPage, page }) => {
    await searchResultsPage.goto({ q: 'mug', sort: 'relevance' });

    const paginationButtons = searchResultsPage.pagination.getByRole('button');
    const hasMultiplePages = (await paginationButtons.count()) > 3;
    test.skip(!hasMultiplePages, 'Not enough results to trigger pagination');

    await page.getByRole('button', { name: 'Go to page 2' }).click();
    await page.waitForURL(/page=2/);
    expect(page.url()).toContain('page=2');

    await page.getByRole('button', { name: 'Go to page 1' }).click();
    await page.waitForURL(/page=1/);
    expect(page.url()).toContain('page=1');
  });

  test('query too short shows validation error', async ({ searchResultsPage }) => {
    await searchResultsPage.goto({ q: 'a', sort: 'relevance' });

    await expect(searchResultsPage.validationError).toBeVisible();
    await expect(searchResultsPage.productCards).not.toBeVisible();
  });

  test('no results shows empty state message', async ({ searchResultsPage }) => {
    await searchResultsPage.goto({ q: 'nonexistentproduct12345', sort: 'relevance' });

    await expect(searchResultsPage.emptyState).toBeVisible();
    await expect(searchResultsPage.productCards).not.toBeVisible();
  });

  test('empty query shows empty state with instructions', async ({ searchResultsPage }) => {
    await searchResultsPage.goto();

    await expect(searchResultsPage.emptyQueryHeading).toBeVisible();
    await expect(searchResultsPage.emptyQueryMessage).toBeVisible();
    await expect(searchResultsPage.productCards).not.toBeVisible();
  });

  test('product cards link to product detail page', async ({ searchResultsPage, page }) => {
    await searchResultsPage.goto({ q: 'mug', sort: 'relevance' });

    const firstCard = searchResultsPage.productCards.first();
    await expect(firstCard).toBeVisible();
    const productName = await firstCard.getByRole('heading').textContent();

    await firstCard.click();
    await page.waitForURL(/\/products\//);
    expect(page.url()).toMatch(/\/products\/[^/]+/);

    // Verify we landed on the correct product
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(productName ?? '');
  });

  test('search from search results page works', async ({ searchResultsPage, page }) => {
    await searchResultsPage.goto({ q: 'mug', sort: 'relevance' });

    await searchResultsPage.search('ceramic');

    await page.waitForURL(/\/search\?q=ceramic/);
    expect(page.url()).toContain('/search?q=ceramic&sort=relevance');
    await expect(searchResultsPage.resultsHeading).toContainText('ceramic');
  });

  test('result count displays correctly', async ({ searchResultsPage }) => {
    await searchResultsPage.goto({ q: 'mug', sort: 'relevance' });

    await expect(searchResultsPage.resultCount).toBeVisible();
  });

  test('sorting buttons highlight active sort', async ({ searchResultsPage }) => {
    await searchResultsPage.goto({ q: 'mug', sort: 'price_asc' });

    await expect(searchResultsPage.sortPriceAsc).toHaveAttribute('aria-pressed', 'true');
    await expect(searchResultsPage.sortRelevance).toHaveAttribute('aria-pressed', 'false');
    await expect(searchResultsPage.sortPriceDesc).toHaveAttribute('aria-pressed', 'false');
  });
});
