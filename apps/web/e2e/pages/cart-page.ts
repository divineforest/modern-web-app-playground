import type { Locator, Page } from '@playwright/test';

export class CartPage {
  readonly page: Page;
  readonly cartItems: Locator;
  readonly emptyState: Locator;
  readonly clearCartButton: Locator;
  readonly continueShoppingLink: Locator;
  readonly cartSummaryItemCount: Locator;
  readonly loadingIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.cartItems = page.getByTestId('cart-item');
    this.emptyState = page.getByText('Your cart is empty');
    this.clearCartButton = page.getByTestId('clear-cart-button');
    this.continueShoppingLink = page.getByRole('link', { name: /continue shopping/i });
    this.cartSummaryItemCount = page.getByText(/^Items:/).locator('..');
    this.loadingIndicator = page.getByRole('progressbar');
  }

  async goto() {
    await this.page.goto('/cart');
  }

  async getItemCount() {
    return this.cartItems.count();
  }

  async removeItem(index: number) {
    await this.cartItems
      .nth(index)
      .locator('button', { has: this.page.locator('[data-testid="DeleteIcon"]') })
      .click();
  }

  async increaseItemQuantity(index: number) {
    const item = this.cartItems.nth(index);
    await item
      .getByRole('button')
      .filter({ has: this.page.locator('[data-testid="AddIcon"]') })
      .click();
  }

  async decreaseItemQuantity(index: number) {
    const item = this.cartItems.nth(index);
    await item
      .getByRole('button')
      .filter({ has: this.page.locator('[data-testid="RemoveIcon"]') })
      .click();
  }

  async getItemQuantity(index: number) {
    const text = await this.cartItems.nth(index).getByTestId('cart-item-quantity').textContent();
    return Number(text);
  }

  async clearCart() {
    await this.clearCartButton.click();
  }
}
