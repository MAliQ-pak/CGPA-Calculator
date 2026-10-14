import { test, expect, saved, seedUser, ALI, setupDone } from './fixtures.js';

const sem1 = { id: 's1', name: 'Semester 1', courses: [
  { id: 'a', name: 'ITC', credits: '3', marks: '85', grade: '' },
  { id: 'b', name: 'FOP', credits: '4', marks: '72', grade: '' },
] }; // (3×4.0 + 4×3.5) / 7 = 3.71

test('entering marks updates semester GPA, CGPA and the save status', async ({ page }) => {
  await seedUser(page, ALI, setupDone({ semesters: [sem1] }));
  await page.goto('/#/semesters');
  await page.getByRole('button', { name: 'Add semester' }).first().click();
  await expect(page.locator('.preset.used')).toHaveCount(1);
  await page.locator('.preset', { hasText: 'Semester 2' }).click();

  const card = page.locator('.sem-card.open');
  const marks = card.locator('[data-field="marks"]');
  for (const [i, m] of ['80', '65', '58', '90'].entries()) await marks.nth(i).fill(m);
  await card.locator('[data-field="grade"]').nth(4).selectOption('B');
  // 4×4 + 4×3 + 3×2.5 + 3×4 + 2×3 = 53.5 over 16 credits
  await expect(card.locator('[data-role="gpa"]')).toHaveText('GPA 3.34');
  await expect(card.locator('[data-role="meta"]')).toHaveText('6 courses · 16 cr counted · 1 to fill');
  await expect(page.locator('.sem-summary')).toContainText('3.46'); // 79.5 / 23

  await marks.nth(1).fill('120');
  await expect(card.locator('.row-error').nth(1)).toHaveText('Marks must be 0–100');
  await expect(card.locator('[data-role="gpa"]')).toHaveText('GPA 3.46'); // the invalid course drops out: 41.5 / 12
  await marks.nth(1).fill('65');

  const d = await saved(page, 'g1');
  expect(d.semesters[1].courses[0].marks).toBe('80');
  await page.reload();
  await expect(page.locator('.sem-summary')).toContainText('3.46');
});

test('courses inside a semester can be renamed, added and removed with undo', async ({ page }) => {
  await seedUser(page, ALI, setupDone({ semesters: [sem1] }));
  await page.goto('/#/semesters');
  const card = page.locator('.sem-card.open');
  await card.locator('[data-field="name"]').first().fill('Intro to Computing');
  await card.getByRole('button', { name: 'Add course' }).click();
  await card.locator('[data-field="name"]').last().fill('Physics');
  await card.locator('[data-field="marks"]').last().fill('61');
  await expect(card.locator('[data-role="gpa"]')).toHaveText('GPA 3.50'); // (12 + 14 + 9) / 10

  await card.getByRole('button', { name: 'Remove Physics' }).click();
  await expect(card.locator('[data-role="gpa"]')).toHaveText('GPA 3.71');
  await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.sem-card.open [data-role="gpa"]')).toHaveText('GPA 3.50');
  const d = await saved(page, 'g1');
  expect(d.semesters[0].courses.map((c) => c.name)).toEqual(['Intro to Computing', 'FOP', 'Physics']);
});

test('dashboard shows CGPA, change since last semester and a chart with tooltips', async ({ page }) => {
  const sem2 = { id: 's2', name: 'Semester 2', courses: [{ id: 'c', name: 'DLD', credits: '4', marks: '65', grade: '' }] };
  await seedUser(page, ALI, setupDone({ semesters: [sem1, sem2] }));
  await expect(page.locator('.hero-value')).toContainText('3.45'); // (26 + 12) / 11
  await expect(page.locator('.delta')).toHaveText('−0.26 after Semester 2');
  await page.locator('.chart .hit').nth(1).hover();
  await expect(page.locator('.chart-tip')).toContainText('Semester GPA3.00');
  await page.getByText('Show as table').click();
  await expect(page.locator('.data-table tbody tr')).toHaveCount(2);
});

test('planner works out the GPA needed for a target', async ({ page }) => {
  await seedUser(page, ALI, setupDone({ semesters: [sem1] })); // 26 points over 7 credits
  await page.goto('/#/planner');
  await page.fill('.plan-grid input >> nth=0', '3.6');
  await page.fill('.plan-grid input >> nth=1', '18');
  // (3.6 × 25 − 26) / 18 = 3.56
  await expect(page.locator('.plan-value')).toHaveText('3.56');
  await expect(page.locator('.plan-result')).toContainText('roughly an A average');
  await page.fill('.plan-grid input >> nth=0', '4');
  await page.fill('.plan-grid input >> nth=1', '1');
  await expect(page.locator('.plan-result')).toContainText('Out of reach'); // (4 × 8 − 26) / 1 = 6
});

test('grading scale changes apply to grades', async ({ page }) => {
  await seedUser(page, ALI, setupDone({ semesters: [sem1] }));
  await page.goto('/#/settings');
  await page.locator('.scale-row [data-field="min"]').first().fill('86'); // 85 is now a B+
  await page.goto('/#/dashboard');
  await expect(page.locator('.hero-value')).toContainText('3.50');
});
