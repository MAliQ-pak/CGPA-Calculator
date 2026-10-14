// Levels, XP, badges and the weekly streak. Pure functions of the user's data, so nothing can
// be "farmed": XP and badges always reflect what's actually entered.
import {
  semesterTotals, overallTotals, history, evaluateCourse, hasBreakdown, maxGP, parseNum,
  retakeTarget, programCredits,
} from './calc.js';

export const LEVELS = [
  { xp: 0, title: 'Fresher' },
  { xp: 100, title: 'Explorer' },
  { xp: 250, title: 'Learner' },
  { xp: 450, title: 'Achiever' },
  { xp: 700, title: 'Scholar' },
  { xp: 1000, title: 'High Flyer' },
  { xp: 1400, title: 'Ace' },
  { xp: 1900, title: 'Legend' },
];

export const XP = { course: 10, item: 3, semester: 40, badge: 25 };

// Facts about the data that the XP and badge rules read.
function facts(data) {
  const max = maxGP(data);
  const rows = history(data);
  const totals = overallTotals(data);
  let graded = 0;
  let items = 0;
  let completeSemesters = 0;
  let straightA = false;
  let usedBreakdown = false;
  let comeback = false;
  data.semesters.forEach((sem) => {
    let semGraded = 0;
    let allTop = sem.courses.length >= 3;
    for (const c of sem.courses) {
      const r = evaluateCourse(data, c);
      const ok = r && r.gp !== undefined;
      if (ok) semGraded += 1;
      if (!ok || r.gp < max) allTop = false;
      if (hasBreakdown(c)) {
        const marked = c.assessments.filter((a) => parseNum(a.obtained) !== null && parseNum(a.total) !== null).length;
        items += marked;
        if (marked) usedBreakdown = true;
      }
      const t = retakeTarget(data, c);
      if (t && ok) {
        const before = evaluateCourse(data, t.course);
        if (before && before.gp !== undefined && r.gp > before.gp) comeback = true;
      }
    }
    graded += semGraded;
    if (sem.courses.length >= 3 && semGraded === sem.courses.length) completeSemesters += 1;
    if (allTop) straightA = true;
  });
  const gpas = rows.map((r) => r.gpa);
  const programTotal = data.program.semesters.reduce((sum, s) => sum + programCredits(s), 0);
  const target = parseNum(data.target.cgpa);
  return {
    max, rows, totals, graded, items, completeSemesters, straightA, usedBreakdown, comeback, gpas, programTotal, target,
    streakBest: data.gamify.streak.best,
  };
}

// Each badge: check(f, data) → { done, progress?: [current, goal] }. Hints say how to earn it.
// category picks the badge's colour: habit (terracotta), improve (teal), milestone (gold).
export const BADGES = [
  { id: 'setup', category: 'habit', title: 'All set', hint: 'Finish setting up your account.', check: (f, d) => ({ done: d.profile.setupDone }) },
  { id: 'first-semester', category: 'habit', title: 'First steps', hint: 'Add your first semester.', check: (f, d) => ({ done: d.semesters.length > 0 }) },
  { id: 'first-grade', category: 'habit', title: 'On the board', hint: 'Enter marks or a grade for any course.', check: (f) => ({ done: f.graded > 0 }) },
  { id: 'semester-sealed', category: 'habit', title: 'Semester sealed', hint: 'Fill in every course of a semester.', check: (f) => ({ done: f.completeSemesters > 0 }) },
  { id: 'detail-detective', category: 'habit', title: 'Detail detective', hint: 'Track a quiz, mid or assignment in a marks breakdown.', check: (f) => ({ done: f.usedBreakdown }) },
  { id: 'goal-setter', category: 'habit', title: 'Goal setter', hint: 'Set a target CGPA in the Planner.', check: (f) => ({ done: f.target !== null && f.target > 0 }) },
  { id: 'bullseye', category: 'milestone', title: 'Bullseye', hint: 'Reach the target CGPA you set in the Planner.', check: (f) => ({ done: f.target !== null && f.totals.cgpa !== null && f.totals.cgpa + 1e-9 >= f.target }) },
  { id: 'rising', category: 'improve', title: 'On the rise', hint: 'Get a higher GPA than the semester before.', check: (f) => ({ done: f.gpas.some((g, i) => i > 0 && g > f.gpas[i - 1] + 1e-9) }) },
  { id: 'comeback', category: 'improve', title: 'Comeback', hint: 'Improve a grade by retaking a course.', check: (f) => ({ done: f.comeback }) },
  { id: 'personal-best', category: 'improve', title: 'Personal best', hint: 'Make your latest semester your best one yet.', check: (f) => ({ done: f.gpas.length >= 2 && f.gpas[f.gpas.length - 1] >= Math.max(...f.gpas) - 1e-9 && f.gpas[f.gpas.length - 1] > Math.min(...f.gpas) + 1e-9 }) },
  { id: 'club-35', category: 'milestone', title: '3.5 club', hint: 'Score a semester GPA of 3.5 or more.', check: (f) => ({ done: f.gpas.some((g) => g + 1e-9 >= f.max * 0.875) }) },
  { id: 'straight-a', category: 'milestone', title: 'Straight A’s', hint: 'Top grade in every course of a semester.', check: (f) => ({ done: f.straightA }) },
  { id: 'halfway', category: 'milestone', title: 'Halfway there', hint: 'Complete half of your program’s credit hours.', check: (f) => progressTo(f.totals.credits, f.programTotal / 2) },
  { id: 'finish-line', category: 'milestone', title: 'Finish line', hint: 'Complete all of your program’s credit hours.', check: (f) => progressTo(f.totals.credits, f.programTotal) },
  { id: 'team-player', category: 'habit', title: 'Team player', hint: 'Share your course list with a code, or use a friend’s.', check: (f, d) => ({ done: Boolean(d.program.shareCode || d.program.copiedFrom) }) },
  { id: 'regular', category: 'habit', title: 'Regular', hint: 'Check in 4 weeks in a row.', check: (f) => progressTo(f.streakBest, 4) },
];

function progressTo(current, goal) {
  if (!goal) return { done: false };
  return { done: current + 1e-9 >= goal, progress: [Math.min(current, goal), goal] };
}

export function badgeStatus(data) {
  const f = facts(data);
  return BADGES.map((b) => ({ ...b, ...b.check(f, data), earnedOn: data.gamify.badges[b.id] || '' }));
}

export function levelFor(xp) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].xp) i += 1;
  const next = LEVELS[i + 1] || null;
  return { level: i + 1, title: LEVELS[i].title, xp, floor: LEVELS[i].xp, next: next ? next.xp : null, nextTitle: next ? next.title : null };
}

// XP from what's entered, plus badges already recorded as earned.
export function progress(data) {
  const f = facts(data);
  const badges = badgeStatus(data);
  const earned = badges.filter((b) => b.done).length;
  const xp = f.graded * XP.course + f.items * XP.item + f.completeSemesters * XP.semester + earned * XP.badge;
  return { ...levelFor(xp), badges, earned, parts: { courses: f.graded, items: f.items, semesters: f.completeSemesters } };
}

// Badges that are done but not yet recorded. Returns their ids; the caller records them.
export function newBadges(data) {
  return badgeStatus(data).filter((b) => b.done && !data.gamify.badges[b.id]).map((b) => b.id);
}

// ISO week key like "2026-W42".
export function weekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// Updates the weekly streak for a visit on `date`. Returns true if anything changed.
export function recordVisit(data, date = new Date()) {
  const s = data.gamify.streak;
  const now = weekKey(date);
  if (s.week === now) return false;
  const lastWeek = weekKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() - 7));
  s.count = s.week === lastWeek ? s.count + 1 : 1;
  s.week = now;
  s.best = Math.max(s.best, s.count);
  return true;
}
