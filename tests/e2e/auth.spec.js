import { test, expect, signUp, saved } from './fixtures.js';

test('sign-up validates the form, then creates the account', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('.form-error')).toHaveText('Enter your name.');
  await page.fill('input[name=name]', 'Sara Ahmed');
  await page.fill('input[name=email]', 'sara@example.com');
  await page.fill('input[name=password]', '123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('.form-error')).toHaveText('Use a password of at least 6 characters.');
  await page.fill('input[name=password]', 'secret1');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('.setup-card h1')).toHaveText('Welcome, Sara!');
});

test('wrong password shows an error; the right one signs in to the same data', async ({ page }) => {
  await signUp(page, { name: 'Sara Ahmed', email: 'sara@example.com', password: 'secret1' });
  await page.getByRole('button', { name: /Use the default setup/ }).click();
  await expect(page.locator('.empty-state h3')).toHaveText('No grades yet');
  await saved(page, 'u0');

  await page.locator('.user-button').click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await page.fill('input[name=email]', 'sara@example.com');
  await page.fill('input[name=password]', 'wrong-one');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('.form-error')).toHaveText('Wrong email or password.');

  await page.fill('input[name=password]', 'secret1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('.page-title')).toHaveText('Dashboard');
  await expect(page.locator('.setup-card')).toHaveCount(0);
  await expect(page.locator('.user-button-name')).toHaveText('Sara Ahmed');
});

test('each account only sees its own data', async ({ page }) => {
  await signUp(page, { name: 'Sara', email: 'sara@example.com', password: 'secret1' });
  await page.getByRole('button', { name: /Set it up my way/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Looks good' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Finish setup' }).click();
  await expect(page.locator('.sem-card')).toHaveCount(1);
  await saved(page, 'u0');

  await page.locator('.user-button').click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await page.locator('.btn-google').click();
  await page.getByRole('button', { name: /Use the default setup/ }).click();
  await page.goto('/#/semesters');
  await expect(page.getByRole('heading', { name: 'No semesters yet' })).toBeVisible();
});

test('deleting an account removes its data and signs out', async ({ page }) => {
  await signUp(page, { name: 'Sara', email: 'sara@example.com', password: 'secret1' });
  await page.getByRole('button', { name: /Use the default setup/ }).click();
  await saved(page, 'u0');
  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'Delete account' }).click();
  const dialog = page.locator('dialog');
  const go = dialog.getByRole('button', { name: 'Delete forever' });
  await expect(go).toBeDisabled();
  await dialog.locator('input[placeholder=DELETE]').fill('DELETE');
  await dialog.locator('input[type=password]').fill('nope');
  await go.click();
  await expect(dialog.locator('.form-error')).toHaveText('Wrong password.');
  await dialog.locator('input[type=password]').fill('secret1');
  await go.click();
  await expect(page.locator('.auth-card')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('mock:data:u0'))).toBeNull();
});
