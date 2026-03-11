import type { Locator, Page } from '@playwright/test';

export interface ShippingAddress {
  fullName: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  countryCode: string;
}

export class CheckoutPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly fullNameInput: Locator;
  readonly addressLine1Input: Locator;
  readonly cityInput: Locator;
  readonly postalCodeInput: Locator;
  readonly countryCodeInput: Locator;
  readonly billingSameAsShippingCheckbox: Locator;
  readonly placeOrderButton: Locator;
  readonly errorAlert: Locator;
  readonly orderSummaryHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Checkout', level: 1 });
    // Billing fields are disabled by default; shipping fields come first in DOM
    this.fullNameInput = page.getByLabel('Full Name').first();
    this.addressLine1Input = page.getByLabel('Address Line 1').first();
    this.cityInput = page.getByLabel('City').first();
    this.postalCodeInput = page.getByLabel('Postal Code').first();
    this.countryCodeInput = page.getByLabel('Country Code').first();
    this.billingSameAsShippingCheckbox = page.getByLabel('Same as shipping address');
    this.placeOrderButton = page.getByRole('button', { name: 'Place Order' });
    this.errorAlert = page.getByRole('alert');
    this.orderSummaryHeading = page.getByRole('heading', { name: 'Order Summary' });
  }

  async goto() {
    await this.page.goto('/checkout');
  }

  async fillShippingAddress(address: ShippingAddress) {
    await this.fullNameInput.fill(address.fullName);
    await this.addressLine1Input.fill(address.addressLine1);
    await this.cityInput.fill(address.city);
    await this.postalCodeInput.fill(address.postalCode);
    await this.countryCodeInput.fill(address.countryCode);
  }

  async placeOrder() {
    await this.placeOrderButton.click();
  }
}
