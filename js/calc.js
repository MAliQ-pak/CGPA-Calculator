// Pure data helpers: the shape of a user's record and every GPA calculation.

export const DEFAULT_SCALE = [
  { min: 80, grade: 'A', gp: 4.0 },
  { min: 70, grade: 'B+', gp: 3.5 },
  { min: 60, grade: 'B', gp: 3.0 },
  { min: 55, grade: 'C+', gp: 2.5 },
  { min: 50, grade: 'C', gp: 2.0 },
  { min: 0, grade: 'F', gp: 0.0 },
];

// BSCS curriculum from the original Python script: [course, credit hours].
export const PRESETS = {
  1: [['ITC', 3], ['FOP', 4], ['English(1)', 3], ['Calculus', 3], ['Basic Electronics', 3], ['Islamic Studies', 2]],
  2: [['DLD', 4], ['OOP', 4], ['English(2)', 3], ['Probability & Statistics', 3], ['Urdu', 2], ['Pakistan Studies', 2]],
  3: [['CAO', 4], ['DSA', 4], ['English(3)', 3], ['Discrete Structures', 3], ['Differential Equations', 3]],
  4: [['DAA', 3], ['Theory of Automata', 3], ['Database Systems', 4], ['Linear Algebra', 3], ['University Elective II', 3]],
  5: [['Computer Networks', 4], ['Multi-variate Calculus', 3], ['Operating Systems', 4], ['ISE', 3], ['CS Elective 1', 3]],
  6: [['AI', 4], ['Compiler Construction', 3], ['Numerical Computing', 3], ['CS Elective 2', 3], ['Professional Practices', 3]],
  7: [['CS Elective 3', 3], ['CS Elective 4', 3], ['FYP 1', 3], ['University Elective III', 3], ['PDC', 3]],
  8: [['CS Elective 5', 3], ['University Elective IV', 3], ['FYP 2', 3], ['Information Security', 3]],
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export function freshData() {
  return {
    scale: DEFAULT_SCALE.map((g) => ({ ...g })),
    semesters: [],
    prior: { cgpa: '', credits: '' },
    target: { cgpa: '', credits: '' },
  };
}

export function blankCourse() {
  return { id: uid(), name: '', credits: '3', marks: '', grade: '' };
}

export function presetCourses(n) {
  return PRESETS[n].map(([name, credits]) => ({ id: uid(), name, credits: String(credits), marks: '', grade: '' }));
}

// Accept anything shaped roughly right (old saves, imported files, the database) and fill gaps.
export function normalize(data) {
  const base = freshData();
  if (!data || typeof data !== 'object') return base;
  const str = (v) => (v === undefined || v === null ? '' : String(v));
  const num = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));
  if (Array.isArray(data.scale) && data.scale.length) {
    base.scale = data.scale.map((g) => ({ min: num(g.min), grade: str(g.grade), gp: num(g.gp) }));
  }
  if (Array.isArray(data.semesters)) {
    base.semesters = data.semesters.map((s, i) => ({
      id: str(s.id) || uid(),
      name: str(s.name) || `Semester ${i + 1}`,
      courses: Array.isArray(s.courses)
        ? s.courses.map((c) => ({
            id: str(c.id) || uid(),
            name: str(c.name),
            credits: str(c.credits),
            marks: str(c.marks),
            grade: str(c.grade),
          }))
        : [],
    }));
  }
  if (data.prior) base.prior = { cgpa: str(data.prior.cgpa), credits: str(data.prior.credits) };
  if (data.target) base.target = { cgpa: str(data.target.cgpa), credits: str(data.target.credits) };
  return base;
}

// NaN can't be stored as JSON, so the scale's empty cells are saved as null.
export function serialize(data) {
  return JSON.parse(JSON.stringify(data, (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? null : v)));
}

export function parseNum(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function sortedScale(data) {
  return data.scale
    .filter((g) => Number.isFinite(g.min) && Number.isFinite(g.gp) && g.grade.trim())
    .slice()
    .sort((a, b) => b.min - a.min);
}

export function maxGP(data) {
  return Math.max(0, ...data.scale.map((g) => g.gp).filter(Number.isFinite));
}

export function scaleProblem(data) {
  const grades = data.scale.map((g) => g.grade.trim());
  if (data.scale.some((g) => !Number.isFinite(g.min) || !Number.isFinite(g.gp) || !g.grade.trim())) {
    return 'Every row needs minimum marks, a grade and grade points.';
  }
  if (new Set(grades).size !== grades.length) return 'Grade names must be unique.';
  if (!data.scale.some((g) => g.min <= 0)) return 'Add a grade with minimum 0 so every mark gets a grade.';
  return '';
}

// Returns { gp, grade, credits } when the course counts, { grade?, error } when it's
// filled in wrongly, or null when it's still empty.
export function evaluateCourse(data, c) {
  const credits = parseNum(c.credits);
  const marks = parseNum(c.marks);
  let g;
  if (marks !== null) {
    if (marks < 0 || marks > 100) return { error: 'Marks must be 0–100' };
    g = sortedScale(data).find((s) => marks >= s.min);
    if (!g) return { error: 'No grade covers these marks' };
  } else if (c.grade) {
    g = data.scale.find((s) => s.grade === c.grade);
    if (!g) return { error: 'Grade not in scale' };
  } else {
    return null;
  }
  if (credits === null || credits <= 0) return { grade: g.grade, error: 'Add credit hours' };
  return { gp: g.gp, grade: g.grade, credits };
}

export function semesterTotals(data, sem) {
  let points = 0;
  let credits = 0;
  let pending = 0;
  for (const c of sem.courses) {
    const r = evaluateCourse(data, c);
    if (r && r.gp !== undefined) {
      points += r.gp * r.credits;
      credits += r.credits;
    } else {
      pending += 1;
    }
  }
  return { points, credits, pending, gpa: credits ? points / credits : null };
}

export function priorTotals(data) {
  const cgpa = parseNum(data.prior.cgpa);
  const credits = parseNum(data.prior.credits);
  if (cgpa === null || credits === null || credits <= 0 || cgpa < 0 || cgpa > maxGP(data)) {
    return { points: 0, credits: 0 };
  }
  return { points: cgpa * credits, credits };
}

export function overallTotals(data) {
  let { points, credits } = priorTotals(data);
  for (const s of data.semesters) {
    const t = semesterTotals(data, s);
    points += t.points;
    credits += t.credits;
  }
  return { points, credits, cgpa: credits ? points / credits : null };
}

// One entry per semester that has counted courses, with the CGPA after it.
export function history(data) {
  let { points, credits } = priorTotals(data);
  const rows = [];
  for (const s of data.semesters) {
    const t = semesterTotals(data, s);
    if (!t.credits) continue;
    points += t.points;
    credits += t.credits;
    rows.push({ id: s.id, name: s.name, gpa: t.gpa, credits: t.credits, cgpa: points / credits });
  }
  return rows;
}

// GPA needed over `next` credit hours to reach `target`.
export function requiredGPA(data, target, next) {
  const t = overallTotals(data);
  const max = maxGP(data);
  const needed = (target * (t.credits + next) - t.points) / next;
  const best = (t.points + max * next) / (t.credits + next);
  return { needed, best, max, reachable: needed <= max + 1e-9 };
}

export const fmt = (n, digits = 2) => (n === null || n === undefined || !Number.isFinite(n) ? '–' : n.toFixed(digits));
export const fmtCredits = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
