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
    this.firstNameInput = page.getByLabel('First Name');
    this.lastNameInput = page.getByLabel('Last Name');
    this.emailInput = page.getByLabel('Email', { exact: true });
    this.passwordInput = page.getByLabel('Password', { exact: true });
    this.confirmPasswordInput = page.getByLabel('Confirm Password');
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
