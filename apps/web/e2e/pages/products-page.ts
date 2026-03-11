import type { Locator, Page } from '@playwright/test';

export class ProductsPage {
  readonly page: Page;
  readonly productCards: Locator;
  readonly pagination: Locator;
  readonly loadingIndicator: Locator;
  readonly emptyMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.productCards = page.getByTestId('product-card');
    this.pagination = page.getByRole('navigation', { name: 'pagination navigation' });
    this.loadingIndicator = page.getByRole('progressbar');
    this.emptyMessage = page.getByText('No products available at the moment.');
  }

  async goto() {
    await this.page.goto('/');
  }

  async clickProduct(index: number) {
    await this.productCards.nth(index).click();
  }

  async getProductCount() {
    return this.productCards.count();
  }

  async goToPage(pageNumber: number) {
    await this.pagination.getByRole('button', { name: `Go to page ${pageNumber}` }).click();
  }

  /** Navigate to products listing, then click the first product card. */
  async gotoFirstProduct() {
    await this.goto();
    await this.productCards.first().waitFor({ state: 'visible' });
    await this.clickProduct(0);
    await this.page.waitForURL(/\/products\/.+/);
  }
}
