import { test, expect, seedUser, ALI, setupDone } from './fixtures.js';

const data = setupDone({
  profile: { setupDone: true, university: 'FAST', currentSemester: '2' },
  semesters: [
    { id: 's1', name: 'Semester 1', courses: [{ id: 'calc1', name: 'Calculus', credits: '3', marks: '45', grade: '' }, { id: 'itc', name: 'ITC', credits: '3', marks: '85', grade: '' }] },
    { id: 's2', name: 'Semester 2', courses: [
      { id: 'calc2', name: 'Calculus', credits: '3', marks: '72', grade: '', retakeOf: 'calc1' },
      { id: 'oop', name: 'OOP', credits: '4', marks: '65', grade: '' },
      { id: 'urdu', name: 'Urdu', credits: '2', marks: '', grade: '' },
    ] },
  ],
});

test('the result card previews, follows the options and downloads as a PNG', async ({ page }) => {
  await seedUser(page, ALI, data);
  await page.getByRole('button', { name: 'Share my result' }).click();
  const dialog = page.locator('dialog');
  const canvas = dialog.locator('canvas');
  await expect(canvas).toBeVisible();
  expect(await canvas.evaluate((c) => [c.width, c.height])).toEqual([1080, 1350]);

  const image = () => canvas.evaluate((c) => c.toDataURL());
  const withName = await image();
  await dialog.getByLabel('Show my name').uncheck();
  await expect.poll(image).not.toBe(withName);
  const noName = await image();
  await dialog.getByLabel('Show semester GPAs').uncheck();
  await expect.poll(image).not.toBe(noName);

  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download image' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('gradepoint-result.png');
  const head = await file.createReadStream().then((s) => new Promise((resolve) => s.once('data', (b) => resolve(b.subarray(0, 8)))));
  expect([...head]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG signature
});

test('the PDF summary lists every semester with GPAs and retake notes, and prints', async ({ page }) => {
  await seedUser(page, ALI, data);
  await page.getByRole('link', { name: 'PDF summary' }).click();
  await expect(page.locator('.page-title')).toHaveText('PDF summary');
  const sheet = page.locator('.report-sheet');
  await expect(sheet.locator('h1')).toHaveText('Academic summary');
  await expect(sheet.locator('.report-who')).toHaveText('Ali Raza · BSCS · FAST');
  await expect(sheet.locator('.report-stat').first()).toContainText('3.45'); // 34.5 / 10 with the retake
  const semHeads = sheet.locator('.report-sem-head');
  await expect(semHeads.nth(0)).toContainText('GPA 2.00 · 6 credit hours · CGPA after 2.00');
  await expect(semHeads.nth(1)).toContainText('GPA 3.21 · 7 credit hours · CGPA after 3.45'); // (10.5 + 12) / 7
  await expect(sheet.locator('tr.struck')).toContainText('Not counted in CGPA (repeated)');
  await expect(sheet.locator('tr', { hasText: 'Urdu' })).toContainText('In progress');
  await expect(sheet.locator('.report-scale')).toContainText('the latest attempt counts');

  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed += 1; }; });
  await page.getByRole('button', { name: 'Save as PDF' }).click();
  expect(await page.evaluate(() => window.__printed)).toBe(1);

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.sidebar')).toBeHidden();
  await expect(page.locator('.report-toolbar')).toBeHidden();
  await expect(sheet).toBeVisible();
});

test('share buttons only appear once there is a CGPA', async ({ page }) => {
  await seedUser(page, ALI, setupDone({ semesters: [{ id: 's1', name: 'Semester 1', courses: [{ id: 'a', name: 'ITC', credits: '3', marks: '', grade: '' }] }] }));
  await expect(page.locator('.hero')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Share my result' })).toHaveCount(0);
});
