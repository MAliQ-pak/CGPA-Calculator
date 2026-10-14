import { test, expect, saved, seedUser, ALI, setupDone } from './fixtures.js';

const data = setupDone({ semesters: [
  { id: 's1', name: 'Semester 1', courses: [{ id: 'a', name: 'ITC', credits: '3', marks: '85', grade: '' }, { id: 'b', name: 'FOP', credits: '4', marks: '72', grade: '' }] }, // 26 / 7
  { id: 's2', name: 'Semester 2', courses: [
    { id: 'c', name: 'DLD', credits: '4', marks: '', grade: '', assessments: [{ id: 'x', name: 'Mid', weight: '40', obtained: '30', total: '40' }, { id: 'y', name: 'Final', weight: '60', obtained: '', total: '' }] }, // 75% so far → B+
    { id: 'd', name: 'Urdu', credits: '2', marks: '', grade: '' },
    { id: 'e', name: 'OOP', credits: '4', marks: '65', grade: '' }, // B: 12 / 4
  ] },
] });

test('what-if grades show the resulting GPA and CGPA without saving anything', async ({ page }) => {
  await seedUser(page, ALI, data);
  await page.goto('/#/planner');
  const card = page.locator('.whatif');
  await expect(card.getByLabel('Semester')).toHaveValue('s2'); // the semester with courses still open
  await expect(card.locator('.whatif-row', { hasText: 'DLD' })).toContainText('On pace for B+');
  await expect(card.locator('.whatif-row', { hasText: 'Urdu' })).toContainText('No grade yet');
  await expect(card.locator('.whatif-stat').first()).toContainText('3.00'); // only OOP counts now
  await expect(card.locator('.whatif-stat').nth(1)).toContainText('3.45'); // (26 + 12) / 11

  await card.getByLabel('What-if grade for DLD').selectOption('A');
  await card.getByLabel('What-if grade for Urdu').selectOption('B+');
  // Semester: (16 + 7 + 12) / 10 = 3.50; CGPA: (26 + 35) / 17 = 3.59
  await expect(card.locator('.whatif-stat').first()).toContainText('3.50');
  await expect(card.locator('.whatif-stat').first()).toContainText('+0.50');
  await expect(card.locator('.whatif-stat').nth(1)).toContainText('3.59');
  await expect(card.locator('.whatif-stat').nth(1)).toContainText('+0.13'); // vs 3.45

  await card.getByLabel('What-if grade for OOP').selectOption('C');
  await expect(card.locator('.whatif-stat').first()).toContainText('3.10'); // (16 + 7 + 8) / 10

  await card.getByRole('button', { name: 'Reset' }).click();
  await card.getByRole('button', { name: 'Use on-pace grades' }).click();
  await expect(card.getByLabel('What-if grade for DLD')).toHaveValue('B+');
  await expect(card.locator('.whatif-stat').first()).toContainText('3.25'); // (14 + 12) / 8

  const d = await page.evaluate(() => JSON.parse(localStorage.getItem('mock:data:g1')));
  expect(d.semesters[1].courses[1].grade).toBe('', 'what-if grades are never saved');
  await page.goto('/#/dashboard');
  await expect(page.locator('.hero-value')).toContainText('3.45');
});

test('what-if needs a semester first', async ({ page }) => {
  await seedUser(page, ALI, setupDone());
  await page.goto('/#/planner');
  await expect(page.locator('.whatif')).toContainText('Add a semester first');
});
