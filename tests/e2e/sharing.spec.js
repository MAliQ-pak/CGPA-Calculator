import { test, expect, saved, seedUser, signUp, ALI, setupDone } from './fixtures.js';

const SARA = { uid: 'f1', name: 'Sara Ahmed', email: 'sara@x.com', photo: '', provider: 'google.com' };
const CODE = 'K7P2QX';
const SHARED = {
  name: 'BSCS', university: 'FAST', ownerName: 'Ali', createdBy: 'g1',
  semesters: [{ courses: [{ name: 'Programming Fundamentals', credits: '4' }, { name: 'Calculus I', credits: '3' }] }, { courses: [{ name: 'OOP', credits: '4' }] }],
};
const putShared = (page) => page.evaluate(([c, p]) => localStorage.setItem(`mock:programs:${c}`, JSON.stringify(p)), [CODE, SHARED]);
const sharedNow = (page, code) => page.evaluate((c) => JSON.parse(localStorage.getItem(`mock:programs:${c}`)), code);

test('sharing a program creates a code, keeps it up to date, and can be stopped', async ({ page }) => {
  await seedUser(page, ALI, setupDone({ profile: { setupDone: true, university: 'FAST', currentSemester: '1' } }));
  await page.goto('/#/program');
  await page.reload();
  await page.getByRole('button', { name: 'Create a share code' }).click();
  const code = (await page.locator('.share-code').textContent()).trim();
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  expect((await saved(page, 'g1')).program.shareCode).toBe(code);

  let shared = await sharedNow(page, code);
  expect(shared).toMatchObject({ name: 'BSCS', university: 'FAST', ownerName: 'Ali', createdBy: 'g1' });
  expect(shared.semesters).toHaveLength(8);
  expect(Object.keys(shared.semesters[0].courses[0]).sort()).toEqual(['credits', 'name']);

  await page.locator('.program-row input[type=text]').first().fill('Intro to Computing');
  await expect.poll(async () => (await sharedNow(page, code)).semesters[0].courses[0].name, { timeout: 5000 }).toBe('Intro to Computing');

  await page.getByRole('button', { name: 'Stop sharing' }).click();
  await page.locator('dialog').getByRole('button', { name: 'Stop sharing' }).click();
  await expect(page.getByRole('button', { name: 'Create a share code' })).toBeVisible();
  expect(await sharedNow(page, code)).toBeNull();
  expect((await saved(page, 'g1')).program.shareCode).toBeUndefined();
});

test('a new student opens a join link, signs up and copies the program in setup', async ({ page }) => {
  await page.goto('/');
  await putShared(page);
  await page.goto(`/#/join/${CODE.toLowerCase()}`);
  await page.reload();
  await expect(page.locator('.auth-card .notice')).toContainText(`code ${CODE}`);
  await signUp(page, { name: 'Sara Ahmed', email: 'sara@example.com', password: 'secret1' });

  await expect(page.locator('.setup-card h1')).toHaveText('Copy a friend’s program');
  await expect(page.locator('.code-form input')).toHaveValue(CODE);
  await expect(page.locator('.code-preview')).toContainText('BSCS · FAST');
  await expect(page.locator('.code-preview')).toContainText('2 semesters · 3 courses · 11 credit hours · shared by Ali');
  await page.getByRole('button', { name: 'Use these courses' }).click();

  await expect(page.getByRole('radio', { name: /BSCS · FAST/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('input[autocomplete=organization]')).toHaveValue('FAST');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.locator('.program-row input[type=text]').first()).toHaveValue('Programming Fundamentals');
  await page.getByRole('button', { name: 'Looks good' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Finish setup' }).click();

  const names = await page.locator('.sem-card.open [data-field="name"]').evaluateAll((els) => els.map((e) => e.value));
  expect(names).toEqual(['Programming Fundamentals', 'Calculus I']);
  const d = await saved(page, 'u0');
  expect(d.program.copiedFrom).toBe(CODE);
  expect(d.profile.university).toBe('FAST');
});

test('the setup wizard accepts a code typed in by hand', async ({ page }) => {
  await page.goto('/');
  await putShared(page);
  await seedUser(page, SARA);
  await page.getByRole('button', { name: /I have a code from a friend/ }).click();
  await page.locator('.code-form input').fill('k7p-2qx');
  await page.getByRole('button', { name: 'Find' }).click();
  await expect(page.locator('.code-preview')).toContainText('BSCS · FAST');
});

test('an existing student copies a program on the Program page; bad codes are explained', async ({ page }) => {
  await page.goto('/');
  await putShared(page);
  await seedUser(page, SARA, setupDone());
  await page.goto('/#/program');
  await page.reload();
  const input = page.locator('.code-form input');
  await input.fill('ABC');
  await page.getByRole('button', { name: 'Find' }).click();
  await expect(page.locator('.code-lookup .form-error')).toHaveText('Codes are 6 letters and numbers, like K7P2QX.');
  await input.fill('ZZZZZZ');
  await page.getByRole('button', { name: 'Find' }).click();
  await expect(page.locator('.code-lookup .form-error')).toHaveText('No program uses the code ZZZZZZ. Check it with your friend.');

  await input.fill(CODE);
  await page.getByRole('button', { name: 'Find' }).click();
  await page.locator('.code-preview').getByRole('button', { name: 'Use these courses' }).click();
  await page.locator('dialog').getByRole('button', { name: 'Use these courses' }).click();
  await expect(page.getByRole('tab')).toHaveCount(2);
  const d = await saved(page, 'f1');
  expect(d.program.semesters[1].courses[0].name).toBe('OOP');
  expect(d.program.copiedFrom).toBe(CODE);
});

test('a join link opened while signed in goes to the Program page', async ({ page }) => {
  await page.goto('/');
  await putShared(page);
  await seedUser(page, SARA, setupDone());
  await page.goto(`/#/join/${CODE}`);
  await expect(page.locator('.page-title')).toHaveText('Program & courses');
  await expect(page.locator('.code-preview')).toContainText('BSCS · FAST');
});

test('deleting an account also removes its shared program', async ({ page }) => {
  await signUp(page, { name: 'Ali', email: 'ali@example.com', password: 'secret1' });
  await page.getByRole('button', { name: /Use the default setup/ }).click();
  await page.goto('/#/program');
  await page.getByRole('button', { name: 'Create a share code' }).click();
  const code = (await page.locator('.share-code').textContent()).trim();
  await saved(page, 'u0');
  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'Delete account' }).click();
  await page.locator('dialog input[placeholder=DELETE]').fill('DELETE');
  await page.locator('dialog input[type=password]').fill('secret1');
  await page.locator('dialog').getByRole('button', { name: 'Delete forever' }).click();
  await expect(page.locator('.auth-card')).toBeVisible();
  expect(await sharedNow(page, code)).toBeNull();
});
