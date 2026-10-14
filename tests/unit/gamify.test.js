import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshData, normalize } from '../../js/calc.js';
import { progress, badgeStatus, newBadges, levelFor, recordVisit, weekKey, XP, BADGES } from '../../js/gamify.js';

const course = (id, credits, marks, extra = {}) => ({ id, name: id, credits: String(credits), marks: String(marks), grade: '', ...extra });
const done = (data) => new Set(badgeStatus(data).filter((b) => b.done).map((b) => b.id));

test('levels follow the XP thresholds', () => {
  assert.deepEqual([levelFor(0).title, levelFor(99).title, levelFor(100).title, levelFor(1899).title, levelFor(5000).title], ['Fresher', 'Fresher', 'Explorer', 'Ace', 'Legend']);
  assert.equal(levelFor(120).next, 250);
  assert.equal(levelFor(120).nextTitle, 'Learner');
  assert.equal(levelFor(9999).next, null);
});

test('a brand-new account has no badges and no XP', () => {
  const d = freshData();
  assert.equal(done(d).size, 0);
  assert.equal(progress(d).xp, 0);
  assert.equal(BADGES.length, 16);
});

test('XP counts graded courses, marked breakdown items, complete semesters and badges', () => {
  const d = freshData();
  d.profile.setupDone = true;
  d.semesters = [{ id: 's1', name: 'S1', courses: [
    course('a', 3, 85), course('b', 3, 72), course('c', 3, 55), // (12 + 10.5 + 7.5) / 9 = 3.33
    course('d', 3, '', { assessments: [{ id: 'x', name: 'Mid', weight: '40', obtained: '30', total: '40' }, { id: 'y', name: 'Final', weight: '60', obtained: '', total: '' }] }),
  ] }];
  const p = progress(d);
  // 3 graded courses, 1 marked item, semester not complete (d pending)
  assert.deepEqual(p.parts, { courses: 3, items: 1, semesters: 0 });
  const earned = ['setup', 'first-semester', 'first-grade', 'detail-detective'];
  assert.deepEqual([...done(d)].sort(), earned.sort());
  assert.equal(p.xp, 3 * XP.course + 1 * XP.item + earned.length * XP.badge);
});

test('habit and milestone badges', () => {
  const d = freshData();
  d.semesters = [
    { id: 's1', name: 'S1', courses: [course('calc1', 3, 45), course('b', 3, 62), course('c', 3, 70)] }, // 0, 3, 3.5 → 2.17
    { id: 's2', name: 'S2', courses: [course('calc2', 3, 85, { retakeOf: 'calc1' }), course('e', 3, 82), course('f', 3, 90)] }, // all A
  ];
  let b = done(d);
  for (const id of ['semester-sealed', 'rising', 'comeback', 'personal-best', 'club-35', 'straight-a']) assert.ok(b.has(id), id);
  assert.ok(!b.has('goal-setter'));
  d.target = { cgpa: '3.9', credits: '' };
  b = done(d);
  assert.ok(b.has('goal-setter'));
  assert.ok(!b.has('bullseye'), 'CGPA is below 3.9');
  d.target.cgpa = '3.0';
  assert.ok(done(d).has('bullseye'));
  d.program.shareCode = 'K7P2QX';
  assert.ok(done(d).has('team-player'));
});

test('credit milestones report progress toward the program total (129 for default BSCS)', () => {
  const d = freshData();
  d.semesters = [{ id: 's1', name: 'S1', courses: [course('a', 30, 85), course('b', 30, 85)] }];
  const halfway = badgeStatus(d).find((x) => x.id === 'halfway');
  assert.equal(halfway.done, false);
  assert.deepEqual(halfway.progress, [60, 64.5]);
  d.semesters[0].courses.push(course('c', 10, 85));
  assert.equal(badgeStatus(d).find((x) => x.id === 'halfway').done, true);
  assert.equal(badgeStatus(d).find((x) => x.id === 'finish-line').done, false);
});

test('newBadges lists only badges not yet recorded', () => {
  const d = freshData();
  d.profile.setupDone = true;
  assert.deepEqual(newBadges(d), ['setup']);
  d.gamify.badges.setup = '2026-10-14';
  assert.deepEqual(newBadges(d), []);
});

test('weekly streak: consecutive weeks add up, a gap resets, best is kept', () => {
  const d = freshData();
  const day = (s) => new Date(`${s}T12:00:00`);
  assert.equal(weekKey(day('2026-10-14')), '2026-W42');
  assert.equal(weekKey(day('2027-01-01')), '2026-W53');
  assert.ok(recordVisit(d, day('2026-10-05')));
  assert.ok(!recordVisit(d, day('2026-10-07')), 'same week');
  recordVisit(d, day('2026-10-13'));
  recordVisit(d, day('2026-10-20'));
  recordVisit(d, day('2026-10-27'));
  assert.deepEqual(d.gamify.streak, { week: '2026-W44', count: 4, best: 4 });
  assert.ok(done(d).has('regular'));
  recordVisit(d, day('2026-11-17'));
  assert.equal(d.gamify.streak.count, 1);
  assert.equal(d.gamify.streak.best, 4);
});

test('gamify settings survive normalize', () => {
  const n = normalize({ gamify: { enabled: false, initialized: true, badges: { setup: '2026-10-14' }, streak: { week: '2026-W42', count: 2, best: 3 } } });
  assert.deepEqual(n.gamify, { enabled: false, initialized: true, badges: { setup: '2026-10-14' }, streak: { week: '2026-W42', count: 2, best: 3 } });
  assert.equal(normalize({}).gamify.enabled, true);
});
