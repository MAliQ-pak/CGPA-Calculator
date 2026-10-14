// Shared setup for the end-to-end tests: every page loads tests/mock-firebase.js in place of
// js/firebase.js, so accounts and saved data live in the test browser's localStorage.
import { test as base, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const MOCK = readFileSync(new URL('../mock-firebase.js', import.meta.url), 'utf8');

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route('**/js/firebase.js', (route) => route.fulfill({ contentType: 'text/javascript', body: MOCK }));
    await context.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
    await use(context);
  },
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/net::|Failed to load resource/.test(m.text())) errors.push(m.text());
    });
    await use(page);
    expect(errors, 'no errors in the browser console').toEqual([]);
  },
});

export { expect };

export const DEFAULT_SCALE = [
  { min: 80, grade: 'A', gp: 4 }, { min: 70, grade: 'B+', gp: 3.5 }, { min: 60, grade: 'B', gp: 3 },
  { min: 55, grade: 'C+', gp: 2.5 }, { min: 50, grade: 'C', gp: 2 }, { min: 0, grade: 'F', gp: 0 },
];

// Signs a user in (without going through the sign-in screen) and optionally gives them saved data.
export async function seedUser(page, user, data) {
  await page.goto('/');
  await page.evaluate(([u, d]) => {
    localStorage.setItem('mock:current', JSON.stringify(u));
    if (d) localStorage.setItem(`mock:data:${u.uid}`, JSON.stringify(d));
    else localStorage.removeItem(`mock:data:${u.uid}`);
  }, [user, data || null]);
  await page.reload();
}

export const ALI = { uid: 'g1', name: 'Ali Raza', email: 'ali@gmail.com', photo: '', provider: 'google.com' };

export function setupDone(extra = {}) {
  return { profile: { setupDone: true, university: '', currentSemester: '1' }, scale: DEFAULT_SCALE, semesters: [], prior: {}, target: {}, ...extra };
}

// Waits for autosave to finish, then returns what was saved for `uid`.
export async function saved(page, uid) {
  await expect(page.locator('.save-status')).toHaveClass(/is-saved/);
  await page.waitForTimeout(250);
  await expect(page.locator('.save-status')).toHaveClass(/is-saved/);
  return page.evaluate((u) => JSON.parse(localStorage.getItem(`mock:data:${u}`)), uid);
}

export async function signUp(page, { name, email, password }) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.fill('input[name=name]', name);
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', password);
  await page.getByRole('button', { name: 'Create account' }).click();
}
