import { test, expect, seedUser, ALI, setupDone } from './fixtures.js';

test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

const data = setupDone({ semesters: [{ id: 's1', name: 'Semester 1', courses: [{ id: 'a', name: 'ITC', credits: '3', marks: '85', grade: '' }, { id: 'b', name: 'FOP', credits: '4', marks: '72', grade: '' }] }] });

for (const route of ['dashboard', 'semesters', 'planner', 'settings', 'program', 'report', 'achievements']) {
  test(`${route} fits a phone screen`, async ({ page }) => {
    await seedUser(page, ALI, data);
    await page.goto(`/#/${route}`);
    await expect(page.locator('.tab-bar')).toBeVisible();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
}

test('sign-in and setup fit a phone screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.auth-card')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await seedUser(page, ALI);
  await page.getByRole('button', { name: /Set it up my way/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('tab')).toHaveCount(8);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('tapping the chart shows a tooltip and tapping elsewhere hides it', async ({ page }) => {
  await seedUser(page, ALI, data);
  await page.locator('.chart .hit').first().dispatchEvent('pointerdown');
  await expect(page.locator('.chart-tip')).toBeVisible();
  await page.locator('.page-intro').tap();
  await expect(page.locator('.chart-tip')).toBeHidden();
});
