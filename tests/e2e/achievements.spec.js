import { test, expect, saved, seedUser, signUp, ALI, setupDone } from './fixtures.js';

const graded = setupDone({ semesters: [{ id: 's1', name: 'Semester 1', courses: [
  { id: 'a', name: 'ITC', credits: '3', marks: '85', grade: '' },
  { id: 'b', name: 'FOP', credits: '4', marks: '72', grade: '' },
  { id: 'c', name: 'Calculus', credits: '3', marks: '', grade: '' },
] }] });

test('a new student earns the first badge when setup finishes', async ({ page }) => {
  await signUp(page, { name: 'Sara Ahmed', email: 'sara@example.com', password: 'secret1' });
  await page.getByRole('button', { name: /Use the default setup/ }).click();
  await expect(page.locator('.toast', { hasText: 'Badge unlocked: All set' })).toBeVisible();
  const card = page.locator('.progress-card');
  await expect(card.locator('.level-title')).toContainText('Fresher · 25 XP');
  await expect(card.locator('.badge-strip')).toContainText('1 of 16 badges');
  await expect(card.locator('.next-badge')).toContainText('Next:');
  const d = await saved(page, 'u0');
  expect(Object.keys(d.gamify.badges)).toEqual(['setup']);
  expect(d.gamify.initialized).toBe(true);
});

test('existing accounts get earned badges quietly, then new ones are celebrated', async ({ page }) => {
  await seedUser(page, ALI, graded);
  await expect(page.locator('.progress-card')).toBeVisible();
  await page.waitForTimeout(900);
  await expect(page.locator('.toast')).toHaveCount(0); // no flood on first load
  // setup, first semester, first grade and 3.5 club (ITC A + FOP B+ = 3.71) = 4 badges; 2 graded courses
  // → 2×10 + 4×25 = 120 XP
  await expect(page.locator('.progress-card .level-title')).toContainText('Explorer · 120 XP');

  await page.goto('/#/semesters');
  await page.locator('.sem-card.open [data-field="marks"]').nth(2).fill('81');
  // Semester now complete (+40, +10) and earns "Semester sealed" (+25) → 195 XP
  await expect(page.locator('.toast', { hasText: 'Badge unlocked: Semester sealed' })).toBeVisible();
  await page.goto('/#/achievements');
  await expect(page.locator('.level-title')).toContainText('Explorer · 195 XP');
  await expect(page.locator('.badge-tile.earned', { hasText: 'Semester sealed' })).toContainText('Unlocked');
  await expect(page.locator('.badge-tile:not(.earned)', { hasText: 'Halfway there' })).toContainText('10 / 65');
});

test('achievements can be turned off without losing badges', async ({ page }) => {
  await seedUser(page, ALI, graded);
  await page.goto('/#/settings');
  await page.getByLabel(/Show achievements/).uncheck();
  await page.goto('/#/dashboard');
  await expect(page.locator('.hero')).toBeVisible();
  await expect(page.locator('.progress-card')).toHaveCount(0);

  await page.goto('/#/planner');
  await page.fill('.plan-grid input >> nth=0', '3.5'); // earns "Goal setter" quietly
  const d = await saved(page, 'g1');
  expect(d.gamify.enabled).toBe(false);
  expect(d.gamify.badges['goal-setter']).toBeTruthy();
  await expect(page.locator('.toast')).toHaveCount(0);

  await page.goto('/#/achievements');
  await page.getByRole('button', { name: 'Turn on achievements' }).click();
  await expect(page.locator('.badge-tile.earned', { hasText: 'Goal setter' })).toBeVisible();
});

test('opening the app in consecutive weeks builds a streak', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-14T12:00:00'));
  const d = graded;
  const earned = { setup: '2026-10-01', 'first-semester': '2026-10-01', 'first-grade': '2026-10-01', 'club-35': '2026-10-01' };
  d.gamify = { enabled: true, initialized: true, badges: earned, streak: { week: '2026-W41', count: 3, best: 3 } };
  await seedUser(page, ALI, d);
  await expect(page.locator('.toast', { hasText: 'Badge unlocked: Regular' })).toBeVisible();
  await page.goto('/#/achievements');
  await expect(page.locator('.ach-stat').nth(1)).toContainText('4');
  const s = await saved(page, 'g1');
  expect(s.gamify.streak).toEqual({ week: '2026-W42', count: 4, best: 4 });
});
