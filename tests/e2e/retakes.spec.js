import { test, expect, saved, seedUser, ALI, setupDone } from './fixtures.js';

const data = () => setupDone({ semesters: [
  { id: 's1', name: 'Semester 1', courses: [{ id: 'calc1', name: 'Calculus', credits: '3', marks: '45', grade: '' }, { id: 'itc', name: 'ITC', credits: '3', marks: '85', grade: '' }] },
  { id: 's2', name: 'Semester 2', courses: [{ id: 'calc2', name: 'Calculus', credits: '3', marks: '72', grade: '' }, { id: 'oop', name: 'OOP', credits: '4', marks: '65', grade: '' }] },
] });

test('a same-name course is suggested as a retake, and marking it updates CGPA', async ({ page }) => {
  await seedUser(page, ALI, data());
  await page.goto('/#/semesters');
  await expect(page.locator('.sem-summary')).toContainText('2.65'); // (0 + 12 + 10.5 + 12) / 13

  const row = page.locator('.sem-card.open .course-row').first();
  await expect(row.locator('.row-note')).toContainText('Taken before in Semester 1');
  await row.getByRole('button', { name: 'Mark as retake' }).click();
  await expect(row.locator('.retake-chip')).toHaveText('Retake of Calculus (Semester 1)');
  await expect(page.locator('.sem-summary')).toContainText('3.45'); // the F drops out: 34.5 / 10
  await expect(page.locator('.sem-summary')).toContainText('10');

  // Semester 1 keeps its GPA but shows the F isn't counted
  await page.locator('.sem-toggle', { hasText: 'Semester 1' }).click();
  const s1 = page.locator('.sem-card').first();
  await expect(s1.locator('[data-role="gpa"]')).toHaveText('GPA 2.00');
  await expect(s1.locator('.course-row').first().locator('.retake-off')).toContainText('Not counted in CGPA · the attempt in Semester 2 counts instead');

  const d = await saved(page, 'g1');
  expect(d.semesters[1].courses[0].retakeOf).toBe('calc1');
  await page.goto('/#/dashboard');
  await expect(page.locator('.hero-value')).toContainText('3.45');
});

test('the retake picker links any earlier course, and it can be undone', async ({ page }) => {
  const d0 = data();
  d0.semesters[1].courses[0].name = 'Calculus (repeat)';
  await seedUser(page, ALI, d0);
  await page.goto('/#/semesters');
  const row = page.locator('.sem-card.open .course-row').first();
  await expect(row.locator('.row-note')).toBeEmpty();
  await row.getByRole('button', { name: 'Is Calculus (repeat) a retake?' }).click();
  await page.locator('dialog .retake-option', { hasText: 'Calculus' }).click();
  await expect(row.locator('.retake-chip')).toContainText('Retake of Calculus');
  await expect(page.locator('.sem-summary')).toContainText('3.45');

  await row.getByRole('button', { name: 'Not a retake' }).click();
  await expect(row.locator('.retake-chip')).toHaveCount(0);
  await expect(page.locator('.sem-summary')).toContainText('2.65');
});

test('the first semester explains there is nothing to retake yet', async ({ page }) => {
  await seedUser(page, ALI, data());
  await page.goto('/#/semesters');
  await page.locator('.sem-toggle', { hasText: 'Semester 1' }).click();
  await page.locator('.sem-card').first().getByRole('button', { name: 'Is ITC a retake?' }).click();
  await expect(page.locator('dialog')).toContainText('Retakes link to a course in an earlier semester');
});

test('choosing "best attempt" in Settings keeps the better grade', async ({ page }) => {
  const d0 = data();
  d0.semesters[0].courses[0].marks = '62'; // first attempt: B (3.0)
  d0.semesters[1].courses[0].marks = '51'; // retake: C (2.0)
  d0.semesters[1].courses[0].retakeOf = 'calc1';
  await seedUser(page, ALI, d0);
  await expect(page.locator('.hero-value')).toContainText('3.00'); // latest attempt: (6 + 12 + 12) / 10
  await page.goto('/#/settings');
  await page.getByRole('radio', { name: /Best attempt counts/ }).click();
  const d = await saved(page, 'g1');
  expect(d.retakePolicy).toBe('best');
  await page.goto('/#/dashboard');
  await expect(page.locator('.hero-value')).toContainText('3.30'); // best attempt: (9 + 12 + 12) / 10
});
