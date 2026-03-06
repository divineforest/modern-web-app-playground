import type { Locator, Page } from '@playwright/test';

export class OrdersPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly emptyState: Locator;
  readonly browseProductsButton: Locator;
  readonly orderAccordions: Locator;
  readonly loadingIndicator: Locator;
  readonly errorAlert: Locator;
  readonly retryButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.getByRole('heading', { name: 'My Orders' });
    this.emptyState = page.getByText("You haven't placed any orders yet");
    this.browseProductsButton = page.getByRole('link', { name: /browse products/i });
    this.orderAccordions = page.locator('[role="button"][aria-expanded]');
    this.loadingIndicator = page.getByRole('progressbar');
    this.errorAlert = page.getByRole('alert');
    this.retryButton = page.getByRole('button', { name: /retry/i });
  }

  async goto() {
    await this.page.goto('/orders');
  }

  async getOrderCount() {
    return this.orderAccordions.count();
  }

  async expandOrder(index: number) {
    await this.orderAccordions.nth(index).click();
  }
}
