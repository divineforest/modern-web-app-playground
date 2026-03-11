import type { Locator, Page } from '@playwright/test';
import type { TestUser } from '../helpers/api-helper.js';

export class RegisterPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly errorAlert: Locator;
  readonly loginLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Create your account' });
    this.firstNameInput = page.locator('input[autocomplete=given-name]');
    this.lastNameInput = page.locator('input[autocomplete=family-name]');
    this.emailInput = page.locator('input[type=email]');
    this.passwordInput = page.locator('input[autocomplete=new-password]').first();
    this.confirmPasswordInput = page.locator('input[autocomplete=new-password]').last();
    this.submitButton = page.getByRole('button', { name: 'Register' });
    this.errorAlert = page.getByRole('alert');
    this.loginLink = page.getByRole('link', { name: 'Login here' });
  }

  async goto() {
    await this.page.goto('/register');
  }

  async register(user: Pick<TestUser, 'firstName' | 'lastName' | 'email' | 'password'>) {
    await this.firstNameInput.fill(user.firstName);
    await this.lastNameInput.fill(user.lastName);
    await this.emailInput.fill(user.email);
    await this.passwordInput.fill(user.password);
    await this.confirmPasswordInput.fill(user.password);
    await this.submitButton.click();
  }
}
