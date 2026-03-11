import type { Locator, Page } from '@playwright/test';

export class OrderConfirmationPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly orderNumber: Locator;
  readonly continueShoppingButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Order Confirmed!' });
    this.orderNumber = page.getByRole('heading', { name: /Order ORD-/ });
    this.continueShoppingButton = page.getByRole('link', { name: 'Continue Shopping' });
  }
}
