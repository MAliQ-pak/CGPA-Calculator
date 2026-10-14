import { test, expect, saved, seedUser, ALI, setupDone } from './fixtures.js';

test('editing the program changes new semesters but not existing ones', async ({ page }) => {
  await seedUser(page, ALI, setupDone());
  await page.goto('/#/settings');
  await page.getByRole('link', { name: 'Edit courses' }).click();
  await expect(page.locator('.nav-link[data-route=settings]').first()).toHaveAttribute('aria-current', 'page');

  await page.getByRole('tab', { name: /Sem 4/ }).click();
  await page.locator('.program-panel').getByRole('button', { name: 'Add course' }).click();
  await page.locator('.program-row input[type=text]').last().fill('Cloud Computing');
  await page.getByRole('button', { name: 'Add a semester to the program' }).click();
  await expect(page.getByRole('tab')).toHaveCount(9);

  await page.goto('/#/semesters');
  await page.getByRole('button', { name: 'Add semester' }).first().click();
  await expect(page.locator('.preset')).toHaveCount(9);
  await expect(page.locator('.preset', { hasText: 'Semester 4' })).toContainText('6 courses');
  await page.locator('.preset', { hasText: 'Semester 4' }).click();
  const names = await page.locator('.sem-card.open [data-field="name"]').evaluateAll((els) => els.map((e) => e.value));
  expect(names).toContain('Cloud Computing');

  await page.locator('.sem-card.open [data-field="name"]').first().fill('DAA (renamed)');
  const d = await saved(page, 'g1');
  expect(d.semesters[0].courses[0].name).toBe('DAA (renamed)');
  expect(d.program.semesters[3].courses[0].name).toBe('DAA');
});

test('the program can be reset to the default', async ({ page }) => {
  await seedUser(page, ALI, setupDone({ program: { name: 'BBA', semesters: [{ id: 'x', courses: [] }] } }));
  await page.goto('/#/program');
  await expect(page.getByRole('tab')).toHaveCount(1);
  await page.getByRole('button', { name: 'Reset to default' }).click();
  await page.locator('dialog').getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByRole('tab')).toHaveCount(8);
  const d = await saved(page, 'g1');
  expect(d.program.name).toBe('BSCS');
});
