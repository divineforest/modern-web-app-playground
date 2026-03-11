import { expect, test, testUser } from './fixtures/test-base.js';

test.describe('Authentication', () => {
  test('user can register a new account via the registration form', async ({
    registerPage,
    page,
  }) => {
    const user = testUser();
    await registerPage.goto();
    await registerPage.register(user);

    await page.waitForURL('/');
    // Verify the user is shown as logged-in in the header
    await expect(page.getByText(`${user.firstName} ${user.lastName}`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  });

  test('user can log in to an existing account', async ({ apiHelper, loginPage, page }) => {
    const user = testUser();
    await apiHelper.registerUser(user);

    await loginPage.goto();
    await loginPage.login(user.email, user.password);

    await page.waitForURL('/');
    await expect(page.getByText(`${user.firstName} ${user.lastName}`)).toBeVisible();
  });

  test('user can log out', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    await authenticatedPage.getByRole('button', { name: 'Logout' }).click();

    await expect(authenticatedPage.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(authenticatedPage.getByRole('button', { name: 'Logout' })).not.toBeVisible();
  });

  test('wrong password shows error alert', async ({ apiHelper, loginPage }) => {
    const user = testUser();
    await apiHelper.registerUser(user);

    await loginPage.goto();
    await loginPage.login(user.email, 'wrongpassword');

    await expect(loginPage.errorAlert).toBeVisible();
  });

  test('duplicate email registration shows error', async ({ apiHelper, registerPage }) => {
    const user = testUser();
    await apiHelper.registerUser(user);

    await registerPage.goto();
    await registerPage.register(user);

    await expect(registerPage.errorAlert).toBeVisible();
  });

  test('protected page redirects unauthenticated user to login with returnTo', async ({ page }) => {
    await page.goto('/orders');
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('returnTo=%2Forders');
  });

  test('login with returnTo redirects to original destination', async ({
    apiHelper,
    loginPage,
    page,
  }) => {
    const user = testUser();
    await apiHelper.registerUser(user);

    await page.goto('/login?returnTo=%2Forders');
    await loginPage.login(user.email, user.password);

    await page.waitForURL('/orders');
  });

  test('password mismatch on registration shows error', async ({ registerPage }) => {
    await registerPage.goto();
    await registerPage.firstNameInput.fill('Test');
    await registerPage.lastNameInput.fill('User');
    await registerPage.emailInput.fill('mismatch@example.com');
    await registerPage.passwordInput.fill('Password123!');
    await registerPage.confirmPasswordInput.fill('DifferentPassword!');
    await registerPage.submitButton.click();

    await expect(registerPage.errorAlert).toBeVisible();
    await expect(registerPage.errorAlert).toContainText(/passwords do not match/i);
  });
});
