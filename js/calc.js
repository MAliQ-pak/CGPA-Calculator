// Pure data helpers: the shape of a user's record and every GPA calculation.

export const DEFAULT_SCALE = [
  { min: 80, grade: 'A', gp: 4.0 },
  { min: 70, grade: 'B+', gp: 3.5 },
  { min: 60, grade: 'B', gp: 3.0 },
  { min: 55, grade: 'C+', gp: 2.5 },
  { min: 50, grade: 'C', gp: 2.0 },
  { min: 0, grade: 'F', gp: 0.0 },
];

// Default program: the BSCS curriculum from the original Python script, [course, credit hours].
export const DEFAULT_PROGRAM_NAME = 'BSCS';
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

// A program is the user's own list of courses per semester, used to fill new semesters.
export function defaultProgram() {
  return {
    name: DEFAULT_PROGRAM_NAME,
    semesters: Object.keys(PRESETS).map((n) => ({
      id: uid(),
      courses: PRESETS[n].map(([name, credits]) => ({ id: uid(), name, credits: String(credits) })),
    })),
  };
}

export function emptyProgram(name = '') {
  return { name, semesters: [{ id: uid(), courses: [] }] };
}

export function freshData() {
  return {
    profile: { setupDone: false, university: '', currentSemester: '1' },
    program: defaultProgram(),
    scale: DEFAULT_SCALE.map((g) => ({ ...g })),
    semesters: [],
    prior: { cgpa: '', credits: '' },
    target: { cgpa: '', credits: '' },
    retakePolicy: 'latest', // which attempt of a repeated course counts: 'latest' | 'best'
  };
}

export function blankCourse() {
  return { id: uid(), name: '', credits: '3', marks: '', grade: '' };
}

// Fresh, unmarked copies of the courses in semester `index` (0-based) of the user's program.
export function programCourses(data, index) {
  const sem = data.program.semesters[index];
  return sem ? sem.courses.map((c) => ({ id: uid(), name: c.name, credits: c.credits, marks: '', grade: '' })) : [];
}

export function programCredits(sem) {
  return sem.courses.reduce((sum, c) => sum + (parseNum(c.credits) || 0), 0);
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
            ...(c.retakeOf ? { retakeOf: str(c.retakeOf) } : {}),
            ...(Array.isArray(c.assessments) && c.assessments.length
              ? { assessments: c.assessments.map((a) => ({ id: str(a.id) || uid(), name: str(a.name), weight: str(a.weight), obtained: str(a.obtained), total: str(a.total) })) }
              : {}),
          }))
        : [],
    }));
  }
  if (data.profile) {
    base.profile = {
      setupDone: Boolean(data.profile.setupDone),
      university: str(data.profile.university),
      currentSemester: str(data.profile.currentSemester) || '1',
    };
  }
  if (data.program && Array.isArray(data.program.semesters)) {
    base.program = {
      name: str(data.program.name),
      ...(data.program.shareCode ? { shareCode: str(data.program.shareCode) } : {}),
      ...(data.program.copiedFrom ? { copiedFrom: str(data.program.copiedFrom) } : {}),
      semesters: data.program.semesters.map((s) => ({
        id: str(s.id) || uid(),
        courses: Array.isArray(s.courses) ? s.courses.map((c) => ({ id: str(c.id) || uid(), name: str(c.name), credits: str(c.credits) })) : [],
      })),
    };
  }
  if (data.prior) base.prior = { cgpa: str(data.prior.cgpa), credits: str(data.prior.credits) };
  if (data.retakePolicy === 'best') base.retakePolicy = 'best';
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
  const marks = courseMarks(c);
  if (hasBreakdown(c)) {
    const problem = assessmentSummary(c).problem;
    if (problem) return { error: problem };
  }
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

// ---------- sharing a program with a code ----------

// No 0/O or 1/I, so codes are easy to read out and type.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const SHARE_CODE_LENGTH = 6;

export function newShareCode(random = Math.random) {
  let code = '';
  for (let i = 0; i < SHARE_CODE_LENGTH; i++) code += CODE_CHARS[Math.floor(random() * CODE_CHARS.length)];
  return code;
}

// Accepts what people actually type or paste: lowercase, spaces, dashes, or a whole join link.
export function cleanShareCode(input) {
  const text = String(input || '').trim();
  const fromLink = /#\/join\/([^/?#]+)/i.exec(text);
  const code = (fromLink ? fromLink[1] : text).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return code.length === SHARE_CODE_LENGTH && [...code].every((ch) => CODE_CHARS.includes(ch)) ? code : '';
}

// What gets stored for friends: names and credit hours only, never marks.
export function sharedProgramPayload(data, ownerName) {
  return {
    name: data.program.name.trim().slice(0, 80) || DEFAULT_PROGRAM_NAME,
    university: (data.profile.university || '').trim().slice(0, 120),
    ownerName: (ownerName || '').trim().split(/\s+/)[0].slice(0, 60),
    semesters: data.program.semesters.slice(0, 16).map((s) => ({
      courses: s.courses.slice(0, 30).map((c) => ({ name: c.name.slice(0, 120), credits: c.credits.slice(0, 6) })),
    })),
  };
}

export function programFromShared(shared, code) {
  return {
    name: String(shared.name || DEFAULT_PROGRAM_NAME),
    copiedFrom: code,
    semesters: (Array.isArray(shared.semesters) ? shared.semesters : []).map((s) => ({
      id: uid(),
      courses: (Array.isArray(s.courses) ? s.courses : []).map((c) => ({ id: uid(), name: String(c.name || ''), credits: String(c.credits ?? '') })),
    })),
  };
}

// ---------- marks breakdown (quizzes, mids, final…) ----------

// A typical split to start from; every university differs, so it's fully editable.
export const COMMON_SPLIT = [['Assignments', 10], ['Quizzes', 10], ['Mid-term 1', 15], ['Mid-term 2', 15], ['Final exam', 50]];

export function hasBreakdown(c) {
  return Array.isArray(c.assessments) && c.assessments.length > 0;
}

// Weights are percentages of the course; each item's obtained/total is scaled to its weight.
export function assessmentSummary(c) {
  const items = c.assessments || [];
  let weightTotal = 0;
  let gradedWeight = 0;
  let earned = 0;
  let graded = 0;
  let problem = '';
  for (const a of items) {
    const w = parseNum(a.weight);
    const got = parseNum(a.obtained);
    const out = parseNum(a.total);
    if (w !== null && w > 0) weightTotal += w;
    if (w === null || w <= 0 || got === null || out === null || out <= 0) continue;
    if (got < 0 || got > out) {
      problem = `${a.name || 'An item'}: marks must be between 0 and ${out}`;
      continue;
    }
    graded += 1;
    gradedWeight += w;
    earned += (w * got) / out;
  }
  if (!problem && weightTotal > 100.001) problem = `Weights add up to ${round2(weightTotal)}%, more than 100%`;
  const complete = !problem && items.length > 0 && graded === items.length && Math.abs(weightTotal - 100) < 0.001;
  return {
    weightTotal: round2(weightTotal),
    gradedWeight: round2(gradedWeight),
    earned: round2(earned),
    remaining: round2(Math.max(0, 100 - gradedWeight)),
    percentSoFar: gradedWeight > 0 ? (earned / gradedWeight) * 100 : null,
    complete,
    problem,
  };
}

// The marks a course counts with: its breakdown total once complete, otherwise what was typed.
export function courseMarks(c) {
  if (!hasBreakdown(c)) return parseNum(c.marks);
  const s = assessmentSummary(c);
  return s.complete ? s.earned : null;
}

// Percentage needed on the remaining work to finish with at least `min` marks.
export function neededPercent(summary, min) {
  if (summary.earned >= min - 1e-9) return { status: 'secured' };
  if (summary.remaining <= 0) return { status: 'impossible' };
  const pct = ((min - summary.earned) / summary.remaining) * 100;
  return pct > 100 + 1e-9 ? { status: 'impossible' } : { status: 'needed', pct };
}

const round2 = (n) => Math.round(n * 100) / 100;

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

// ---------- repeated courses ----------

// Where every course lives: id → { course, semIndex }.
function courseLocations(data) {
  const map = new Map();
  data.semesters.forEach((sem, semIndex) => sem.courses.forEach((course) => map.set(course.id, { course, semIndex })));
  return map;
}

// The earlier course this one retakes, if the link is valid (it must be in an earlier semester).
export function retakeTarget(data, course, where = courseLocations(data)) {
  if (!course.retakeOf) return null;
  const self = where.get(course.id);
  const target = where.get(course.retakeOf);
  if (!self || !target || target.semIndex >= self.semIndex) return null;
  return target;
}

// All attempts of one course share the id of the first attempt.
function attemptGroup(data, course, where) {
  let current = course;
  for (let i = 0; i < 50; i++) {
    const t = retakeTarget(data, current, where);
    if (!t) return current.id;
    current = t.course;
  }
  return current.id;
}

// Walks the semesters in order, counting one attempt per repeated course (the latest, or the
// best when retakePolicy is 'best'). Calls onSemester after each semester with running totals.
function cgpaWalk(data, onSemester) {
  let { points, credits } = priorTotals(data);
  const where = courseLocations(data);
  const kept = new Map(); // group → { gp, credits, id }
  const counted = new Set();
  const graded = new Set();
  data.semesters.forEach((sem, semIndex) => {
    for (const c of sem.courses) {
      const r = evaluateCourse(data, c);
      if (!r || r.gp === undefined) continue;
      graded.add(c.id);
      const group = attemptGroup(data, c, where);
      const prev = kept.get(group);
      if (prev) {
        if (data.retakePolicy === 'best' && r.gp < prev.gp) continue;
        points -= prev.gp * prev.credits;
        credits -= prev.credits;
        counted.delete(prev.id);
      }
      kept.set(group, { gp: r.gp, credits: r.credits, id: c.id });
      points += r.gp * r.credits;
      credits += r.credits;
      counted.add(c.id);
    }
    if (onSemester) onSemester(sem, semIndex, points, credits);
  });
  return { points, credits, counted, graded, where };
}

export function overallTotals(data) {
  const { points, credits } = cgpaWalk(data);
  return { points, credits, cgpa: credits ? points / credits : null };
}

// One entry per semester that has counted courses, with the CGPA after it.
export function history(data) {
  const rows = [];
  cgpaWalk(data, (sem, semIndex, points, credits) => {
    const t = semesterTotals(data, sem);
    if (!t.credits) return;
    rows.push({ id: sem.id, name: sem.name, gpa: t.gpa, credits: t.credits, cgpa: points / credits });
  });
  return rows;
}

// For the Semesters page: how each course in a retake chain is treated.
// id → { retakeOf?: {course, semIndex}, notCounted?: true, replacedBy?: {course, semIndex} }
export function retakeInfo(data) {
  const { counted, graded, where } = cgpaWalk(data);
  const info = new Map();
  const groups = new Map();
  for (const [id, loc] of where) {
    const t = retakeTarget(data, loc.course, where);
    if (t) info.set(id, { ...(info.get(id) || {}), retakeOf: t });
    const g = attemptGroup(data, loc.course, where);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(id);
  }
  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    const winner = ids.find((id) => counted.has(id));
    for (const id of ids) {
      if (!graded.has(id) || counted.has(id)) continue;
      info.set(id, { ...(info.get(id) || {}), notCounted: true, replacedBy: winner ? where.get(winner) : null });
    }
  }
  return info;
}

// Earlier courses with the same name, to suggest marking a course as a retake.
export function sameNameEarlier(data, course) {
  const name = course.name.trim().toLowerCase();
  if (!name) return null;
  const where = courseLocations(data);
  const self = where.get(course.id);
  if (!self) return null;
  for (let i = self.semIndex - 1; i >= 0; i--) {
    const match = data.semesters[i].courses.find((c) => c.name.trim().toLowerCase() === name);
    if (match) return { course: match, semIndex: i };
  }
  return null;
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
