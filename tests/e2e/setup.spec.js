import { test, expect, signUp, saved, seedUser, ALI, setupDone, DEFAULT_SCALE } from './fixtures.js';

test('default setup finishes in one click and is not shown again', async ({ page }) => {
  await seedUser(page, ALI);
  await page.getByRole('button', { name: /Use the default setup/ }).click();
  await expect(page.locator('.empty-state h3')).toHaveText('No grades yet');
  const d = await saved(page, 'g1');
  expect(d.profile.setupDone).toBe(true);
  expect(d.program.name).toBe('BSCS');
  expect(d.program.semesters).toHaveLength(8);
  await page.reload();
  await expect(page.locator('.shell')).toBeVisible();
  await expect(page.locator('.setup-card')).toHaveCount(0);
});

test('custom BSCS setup: edited courses fill the created semesters', async ({ page }) => {
  await signUp(page, { name: 'Sara Ahmed', email: 'sara@example.com', password: 'secret1' });
  await page.getByRole('button', { name: /Set it up my way/ }).click();
  await page.fill('input[autocomplete=organization]', 'FAST');
  await page.locator('.setup-card select').selectOption('3');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('tab')).toHaveCount(8);
  await page.getByRole('tab', { name: /Sem 3/ }).click();
  await page.locator('.program-row input[type=text]').first().fill('Computer Organization');
  await page.locator('.program-panel').getByRole('button', { name: 'Add course' }).click();
  await page.locator('.program-row input[type=text]').last().fill('Technical Writing');
  await page.locator('.program-row input[type=number]').last().fill('2');
  await page.getByRole('button', { name: 'Looks good' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: /enter my past semesters/ }).click();
  await page.getByRole('button', { name: 'Finish setup' }).click();

  await expect(page.locator('.sem-card')).toHaveCount(3);
  const d = await saved(page, 'u0');
  expect(d.profile).toMatchObject({ setupDone: true, university: 'FAST', currentSemester: '3' });
  const names = d.semesters[2].courses.map((c) => c.name);
  expect(names[0]).toBe('Computer Organization');
  expect(names).toContain('Technical Writing');
  expect(d.program.semesters[2].courses.find((c) => c.name === 'Technical Writing').credits).toBe('2');
  await page.getByRole('link', { name: 'Dashboard' }).first().click();
  await expect(page.locator('.page-intro p')).toContainText('BSCS · FAST');
});

test('starting from an existing CGPA', async ({ page }) => {
  await seedUser(page, ALI);
  await page.getByRole('button', { name: /Set it up my way/ }).click();
  await page.locator('.setup-card select').selectOption('5');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Looks good' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: /I know my CGPA so far/ }).click();
  await page.getByRole('button', { name: 'Finish setup' }).click();
  await expect(page.locator('.setup-card .form-error')).toContainText('Enter a CGPA');
  await page.fill('input[placeholder="e.g. 3.20"]', '3.2');
  await page.fill('input[placeholder="e.g. 36"]', '68');
  await page.getByRole('button', { name: 'Finish setup' }).click();
  const d = await saved(page, 'g1');
  expect(d.prior).toEqual({ cgpa: '3.2', credits: '68' });
  expect(d.semesters.map((s) => s.name)).toEqual(['Semester 5']);
});

test('a custom program starts empty and fills semester 1', async ({ page }) => {
  await seedUser(page, ALI);
  await page.getByRole('button', { name: /Set it up my way/ }).click();
  await page.getByRole('radio', { name: /Another program/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('.setup-card .form-error')).toHaveText('Enter your program’s name.');
  await page.fill('input[placeholder^="e.g. BBA"]', 'BBA');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('.setup-card h1')).toHaveText('Your BBA courses');
  for (const [name, credits] of [['Principles of Management', '3'], ['Microeconomics', '3']]) {
    await page.locator('.program-panel').getByRole('button', { name: 'Add course' }).click();
    await page.locator('.program-row input[type=text]').last().fill(name);
    await page.locator('.program-row input[type=number]').last().fill(credits);
  }
  await page.getByRole('button', { name: 'Looks good' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('.setup-card h1')).toHaveText('You’re all set');
  await page.getByRole('button', { name: 'Finish setup' }).click();
  const names = await page.locator('.sem-card.open [data-field="name"]').evaluateAll((els) => els.map((e) => e.value));
  expect(names).toEqual(['Principles of Management', 'Microeconomics']);
});

test('running setup again keeps existing semesters', async ({ page }) => {
  const data = setupDone({ semesters: [{ id: 'a', name: 'Semester 1', courses: [{ id: 'c', name: 'ITC', credits: '3', marks: '85', grade: '' }] }] });
  await seedUser(page, ALI, data);
  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'Run setup again' }).click();
  await expect(page.locator('.setup-progress')).toContainText('Step 1 of 4');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Looks good' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('.setup-card')).toContainText('You already have 1 semester');
  await page.getByRole('button', { name: 'Finish setup' }).click();
  const d = await saved(page, 'g1');
  expect(d.semesters).toHaveLength(1);
  expect(d.semesters[0].courses[0].marks).toBe('85');
});

test('an account from before setup existed keeps its grades and scale', async ({ page }) => {
  const scale = [{ min: 85, grade: 'A', gp: 4 }, { min: 0, grade: 'F', gp: 0 }];
  await seedUser(page, ALI, { scale, semesters: [{ id: 'a', name: 'Semester 1', courses: [{ id: 'c', name: 'ITC', credits: '3', marks: '85', grade: '' }] }], prior: {}, target: {} });
  await page.getByRole('button', { name: /Use the default setup/ }).click();
  await expect(page.locator('.hero-value')).toContainText('4.00');
  const d = await saved(page, 'g1');
  expect(d.semesters).toHaveLength(1);
  expect(d.scale[0].min).toBe(85);
  expect(d.profile.setupDone).toBe(true);
});

test('grades saved by the first version are offered for import before setup', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('cgpa-calculator:v1', JSON.stringify({ semesters: [{ id: 'a', name: 'Semester 1', courses: [{ id: 'c', name: 'ITC', credits: '3', marks: '85', grade: '' }, { id: 'd', name: 'FOP', credits: '4', marks: '72', grade: '' }] }] })));
  await signUp(page, { name: 'Sara', email: 'sara@example.com', password: 'secret1' });
  await expect(page.locator('dialog')).toContainText('1 semester saved from the earlier version');
  await page.getByRole('button', { name: 'Add to my account' }).click();
  await page.getByRole('button', { name: /Use the default setup/ }).click();
  await expect(page.locator('.hero-value')).toContainText('3.71');
  await saved(page, 'u0');
  await page.reload();
  await expect(page.locator('.hero-value')).toContainText('3.71');
  await expect(page.locator('dialog')).toHaveCount(0);
});

test('restoring an old backup keeps the setup and program', async ({ page }) => {
  await seedUser(page, ALI, setupDone({ scale: DEFAULT_SCALE }));
  await page.goto('/#/settings');
  await page.locator('input[type=file]').setInputFiles({ name: 'old.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ semesters: [{ name: 'Semester 9', courses: [] }] })) });
  await page.locator('dialog .btn-danger').click();
  await expect(page.locator('.toast')).toContainText('Backup restored');
  const d = await saved(page, 'g1');
  expect(d.profile.setupDone).toBe(true);
  expect(d.program.semesters).toHaveLength(8);
  expect(d.semesters[0].name).toBe('Semester 9');
});
