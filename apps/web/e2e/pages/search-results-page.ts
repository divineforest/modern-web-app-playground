import type { Locator, Page } from '@playwright/test';

export class SearchResultsPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly resultsHeading: Locator;
  readonly resultCount: Locator;
  readonly productCards: Locator;
  readonly validationError: Locator;
  readonly emptyState: Locator;
  readonly emptyQueryHeading: Locator;
  readonly emptyQueryMessage: Locator;
  readonly sortRelevance: Locator;
  readonly sortPriceAsc: Locator;
  readonly sortPriceDesc: Locator;
  readonly pagination: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByPlaceholder('Search products...');
    this.resultsHeading = page.getByRole('heading', { name: /Search results for:/ });
    this.resultCount = page.getByText(/\d+ results? found/);
    this.productCards = page.getByTestId('product-card');
    this.validationError = page.getByText(/Search query must be at least 2 characters/);
    this.emptyState = page.getByText(/No products match your search/);
    this.emptyQueryHeading = page.getByRole('heading', { name: 'Search Products' });
    this.emptyQueryMessage = page.getByText(/Enter a search query to find products/);
    this.sortRelevance = page.getByRole('button', { name: 'Relevance' });
    this.sortPriceAsc = page.getByRole('button', { name: 'Price: Low to High' });
    this.sortPriceDesc = page.getByRole('button', { name: 'Price: High to Low' });
    this.pagination = page.getByRole('navigation');
  }

  async goto(params?: { q?: string; sort?: string; page?: number }) {
    const sp = new URLSearchParams();
    if (params?.q) sp.set('q', params.q);
    if (params?.sort) sp.set('sort', params.sort);
    if (params?.page) sp.set('page', String(params.page));
    const qs = sp.toString();
    await this.page.goto(qs ? `/search?${qs}` : '/search');
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
  }

  async sortBy(sort: 'relevance' | 'price_asc' | 'price_desc') {
    const buttons = {
      relevance: this.sortRelevance,
      price_asc: this.sortPriceAsc,
      price_desc: this.sortPriceDesc,
    };
    await buttons[sort].click();
    await this.page.waitForURL(new RegExp(`sort=${sort}`));
  }
}
