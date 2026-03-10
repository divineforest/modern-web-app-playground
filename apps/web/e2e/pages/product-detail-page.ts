import type { Locator, Page } from '@playwright/test';

export class ProductDetailPage {
  readonly page: Page;
  readonly productName: Locator;
  readonly price: Locator;
  readonly quantityDisplay: Locator;
  readonly addToCartButton: Locator;
  readonly increaseQuantityButton: Locator;
  readonly decreaseQuantityButton: Locator;
  readonly successMessage: Locator;
  readonly loadingIndicator: Locator;
  readonly backButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.productName = page.getByRole('heading', { level: 1 });
    this.price = page.locator('text=/\\$[\\d,.]+/').first();
    this.quantityDisplay = page.getByTestId('quantity-input');
    this.addToCartButton = page.getByTestId('add-to-cart-button');
    this.increaseQuantityButton = page.locator('button', {
      has: page.locator('[data-testid="AddIcon"]'),
    });
    this.decreaseQuantityButton = page.locator('button', {
      has: page.locator('[data-testid="RemoveIcon"]'),
    });
    this.successMessage = page.getByText('Added to cart!');
    this.loadingIndicator = page.getByRole('progressbar');
    this.backButton = page.getByRole('button', { name: /back/i });
  }

  async goto(slug: string) {
    await this.page.goto(`/products/${slug}`);
  }

  async setQuantity(target: number) {
    const current = Number(await this.quantityDisplay.textContent());
    const diff = target - current;
    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        await this.increaseQuantityButton.click();
      }
    } else if (diff < 0) {
      for (let i = 0; i < Math.abs(diff); i++) {
        await this.decreaseQuantityButton.click();
      }
    }
  }

  async addToCart() {
    await this.addToCartButton.click();
  }
}
