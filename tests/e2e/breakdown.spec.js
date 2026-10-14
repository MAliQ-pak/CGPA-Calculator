import { test, expect, saved, seedUser, ALI, setupDone } from './fixtures.js';

const data = setupDone({ semesters: [{ id: 's1', name: 'Semester 1', courses: [
  { id: 'a', name: 'ITC', credits: '3', marks: '', grade: '' },
  { id: 'b', name: 'FOP', credits: '4', marks: '72', grade: '' },
] }] });

test('track a course with a marks breakdown until it becomes the course marks', async ({ page }) => {
  await seedUser(page, ALI, data);
  await page.goto('/#/semesters');
  const card = page.locator('.sem-card.open');
  await card.getByRole('button', { name: 'Marks breakdown for ITC' }).click();
  const panel = card.locator('.breakdown');
  await panel.getByRole('button', { name: 'Use a common split' }).click();
  await expect(panel.locator('.bd-row')).toHaveCount(5);

  const row = (i) => panel.locator('.bd-row').nth(i);
  const fill = async (i, got, outOf) => {
    await row(i).getByLabel('Marks obtained').fill(got);
    await row(i).getByLabel('Out of').fill(outOf);
  };
  // Assignments 10%: 18/20 → 9, Quizzes 10%: 8/10 → 8, Mid-term 1 15%: 21/30 → 10.5
  await fill(0, '18', '20');
  await fill(1, '8', '10');
  await fill(2, '21', '30');
  await expect(panel.locator('.bd-progress')).toContainText('27.5 of 35% earned so far');
  await expect(panel.locator('.bd-progress')).toContainText('79% average, on pace for a B+');
  // A needs 80: (80 − 27.5) / 65 = 80.8% → 81%
  await expect(panel.locator('.need', { hasText: /^A\d/ })).toContainText('81%');
  await expect(panel.locator('.need', { hasText: /^C\d/ })).toContainText('35%'); // (50 − 27.5) / 65
  // Not finished yet: ITC doesn't count, so the semester GPA is FOP's alone
  await expect(card.locator('[data-role="gpa"]')).toHaveText('GPA 3.50');
  await expect(card.locator('.course-row').first().locator('[data-field="marks"]')).toBeDisabled();

  // Mid-term 2 15%: 27/30 → 13.5, Final 50%: 41/50 → 41 → total 82 → A
  await fill(3, '27', '30');
  await fill(4, '41', '50');
  await expect(panel.locator('.bd-total')).toContainText('82 / 100');
  await expect(card.locator('.course-row').first().locator('[data-field="marks"]')).toHaveValue('82');
  await expect(card.locator('[data-role="gpa"]')).toHaveText('GPA 3.71'); // (3×4 + 4×3.5) / 7

  const d = await saved(page, 'g1');
  expect(d.semesters[0].courses[0].assessments).toHaveLength(5);
  await page.reload();
  await expect(page.locator('.sem-card.open [data-role="gpa"]')).toHaveText('GPA 3.71');
});

test('breakdown problems are explained and removing it brings back typed marks', async ({ page }) => {
  await seedUser(page, ALI, data);
  await page.goto('/#/semesters');
  const card = page.locator('.sem-card.open');
  await card.getByRole('button', { name: 'Marks breakdown for FOP' }).click();
  const panel = card.locator('.breakdown');
  await panel.getByRole('button', { name: 'Add my own' }).click();
  const row = panel.locator('.bd-row').first();
  await row.getByLabel('Item name').fill('Final');
  await row.getByLabel('Weight (% of course)').fill('60');
  await expect(panel.locator('.bd-warn')).toContainText('Weights add up to 60%');
  await row.getByLabel('Marks obtained').fill('70');
  await row.getByLabel('Out of').fill('60');
  await expect(panel.locator('.bd-warn')).toContainText('Final: marks must be between 0 and 60');
  await expect(card.locator('.row-error').nth(1)).toContainText('Final: marks must be between 0 and 60');

  await row.getByRole('button', { name: 'Remove Final' }).click();
  await expect(panel.getByRole('button', { name: 'Use a common split' })).toBeVisible();
  const marks = card.locator('.course-row').nth(1).locator('[data-field="marks"]');
  await expect(marks).toBeEnabled();
  await expect(marks).toHaveValue('72');
  const d = await saved(page, 'g1');
  expect('assessments' in d.semesters[0].courses[1]).toBe(false);
});
