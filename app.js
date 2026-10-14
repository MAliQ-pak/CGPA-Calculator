'use strict';

const STORAGE_KEY = 'cgpa-calculator:v1';

const DEFAULT_SCALE = [
  { min: 80, grade: 'A', gp: 4.0 },
  { min: 70, grade: 'B+', gp: 3.5 },
  { min: 60, grade: 'B', gp: 3.0 },
  { min: 55, grade: 'C+', gp: 2.5 },
  { min: 50, grade: 'C', gp: 2.0 },
  { min: 0, grade: 'F', gp: 0.0 },
];

// BSCS curriculum from the original Python script: [course, credit hours].
const PRESETS = {
  1: [['ITC', 3], ['FOP', 4], ['English(1)', 3], ['Calculus', 3], ['Basic Electronics', 3], ['Islamic Studies', 2]],
  2: [['DLD', 4], ['OOP', 4], ['English(2)', 3], ['Probability & Statistics', 3], ['Urdu', 2], ['Pakistan Studies', 2]],
  3: [['CAO', 4], ['DSA', 4], ['English(3)', 3], ['Discrete Structures', 3], ['Differential Equations', 3]],
  4: [['DAA', 3], ['Theory of Automata', 3], ['Database Systems', 4], ['Linear Algebra', 3], ['University Elective II', 3]],
  5: [['Computer Networks', 4], ['Multi-variate Calculus', 3], ['Operating Systems', 4], ['ISE', 3], ['CS Elective 1', 3]],
  6: [['AI', 4], ['Compiler Construction', 3], ['Numerical Computing', 3], ['CS Elective 2', 3], ['Professional Practices', 3]],
  7: [['CS Elective 3', 3], ['CS Elective 4', 3], ['FYP 1', 3], ['University Elective III', 3], ['PDC', 3]],
  8: [['CS Elective 5', 3], ['University Elective IV', 3], ['FYP 2', 3], ['Information Security', 3]],
};

const $ = (id) => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2, 10);

let state = load();

// ---------- persistence ----------

function freshState() {
  return {
    scale: DEFAULT_SCALE.map((g) => ({ ...g })),
    semesters: [],
    prior: { cgpa: '', credits: '' },
    target: { cgpa: '', credits: '' },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) {
    // Storage blocked or corrupt data: start fresh.
  }
  return freshState();
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // Private mode or storage full: the app still works for this visit.
  }
}

// Accept anything shaped roughly right (old saves, imported files) and fill gaps.
function normalize(data) {
  const base = freshState();
  if (!data || typeof data !== 'object') return base;
  const str = (v) => (v === undefined || v === null ? '' : String(v));
  if (Array.isArray(data.scale) && data.scale.length) {
    base.scale = data.scale.map((g) => ({ min: Number(g.min), grade: str(g.grade), gp: Number(g.gp) }));
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

// ---------- calculations ----------

function maxGP() {
  return Math.max(0, ...state.scale.map((g) => g.gp).filter(Number.isFinite));
}

function sortedScale() {
  return state.scale
    .filter((g) => Number.isFinite(g.min) && Number.isFinite(g.gp) && g.grade)
    .slice()
    .sort((a, b) => b.min - a.min);
}

function gradeForMarks(marks) {
  return sortedScale().find((g) => marks >= g.min) || null;
}

function parseNum(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Returns { gp, grade, credits } when the course can be counted, or { error } / null.
function evaluateCourse(c) {
  const credits = parseNum(c.credits);
  const marks = parseNum(c.marks);
  if (marks !== null) {
    if (marks < 0 || marks > 100) return { error: 'Marks must be 0–100' };
    const g = gradeForMarks(marks);
    if (!g) return { error: 'No grade covers these marks' };
    if (credits === null || credits <= 0) return { grade: g.grade, error: 'Add credit hours' };
    return { gp: g.gp, grade: g.grade, credits };
  }
  if (c.grade) {
    const g = state.scale.find((s) => s.grade === c.grade);
    if (!g) return { error: 'Grade not in scale' };
    if (credits === null || credits <= 0) return { grade: g.grade, error: 'Add credit hours' };
    return { gp: g.gp, grade: g.grade, credits };
  }
  return null;
}

function semesterTotals(sem) {
  let points = 0;
  let credits = 0;
  for (const c of sem.courses) {
    const r = evaluateCourse(c);
    if (r && r.gp !== undefined) {
      points += r.gp * r.credits;
      credits += r.credits;
    }
  }
  return { points, credits, gpa: credits ? points / credits : null };
}

function overallTotals() {
  let points = 0;
  let credits = 0;
  const pc = parseNum(state.prior.cgpa);
  const pcr = parseNum(state.prior.credits);
  if (pc !== null && pcr !== null && pcr > 0 && pc >= 0 && pc <= maxGP()) {
    points += pc * pcr;
    credits += pcr;
  }
  for (const s of state.semesters) {
    const t = semesterTotals(s);
    points += t.points;
    credits += t.credits;
  }
  return { points, credits, cgpa: credits ? points / credits : null };
}

const fmt = (n) => (n === null ? '–' : n.toFixed(2));
const fmtCredits = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// ---------- rendering ----------

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? '' : v);
  }
  for (const child of children) {
    if (child !== null && child !== undefined) node.append(child);
  }
  return node;
}

function renderSemesters() {
  const root = $('semesters');
  root.replaceChildren();
  if (!state.semesters.length) {
    root.append(el('p', { class: 'empty' }, 'No semesters yet. Add a blank one or load a preset below.'));
    return;
  }
  state.semesters.forEach((sem, si) => {
    const totals = semesterTotals(sem);
    const body = el('tbody');
    sem.courses.forEach((c) => body.append(renderCourseRow(sem, c)));

    const card = el('article', { class: 'semester', dataset: { sem: sem.id } },
      el('div', { class: 'semester-head' },
        el('input', { class: 'semester-name', value: sem.name, 'aria-label': 'Semester name', dataset: { field: 'sem-name' } }),
        el('span', { class: 'semester-gpa', dataset: { role: 'sem-gpa' } }, `GPA ${fmt(totals.gpa)}`),
        el('div', { class: 'semester-actions' },
          el('button', { type: 'button', class: 'icon-btn', title: 'Move up', 'aria-label': 'Move semester up', dataset: { action: 'sem-up' }, disabled: si === 0 }, '↑'),
          el('button', { type: 'button', class: 'icon-btn', title: 'Move down', 'aria-label': 'Move semester down', dataset: { action: 'sem-down' }, disabled: si === state.semesters.length - 1 }, '↓'),
          el('button', { type: 'button', class: 'icon-btn danger', title: 'Delete semester', 'aria-label': 'Delete semester', dataset: { action: 'sem-delete' } }, '✕'),
        ),
      ),
      el('div', { class: 'table-scroll' },
        el('table', { class: 'courses' },
          el('thead', {}, el('tr', {},
            el('th', {}, 'Course'),
            el('th', {}, 'Credits'),
            el('th', {}, 'Marks'),
            el('th', {}, 'Grade'),
            el('th', {}, el('span', { class: 'sr-only' }, 'Remove')),
          )),
          body,
        ),
      ),
      el('div', { class: 'semester-foot' },
        el('button', { type: 'button', class: 'btn btn-small', dataset: { action: 'course-add' } }, '+ Course'),
        el('span', { class: 'muted', dataset: { role: 'sem-credits' } }, `${fmtCredits(totals.credits)} credit hours counted`),
      ),
    );
    root.append(card);
  });
}

function renderCourseRow(sem, c) {
  const r = evaluateCourse(c);
  const hasMarks = parseNum(c.marks) !== null;
  const select = el('select', { 'aria-label': 'Grade', dataset: { field: 'grade' }, disabled: hasMarks });
  select.append(el('option', { value: '' }, '—'));
  for (const g of sortedScale()) {
    select.append(el('option', { value: g.grade }, `${g.grade} (${g.gp.toFixed(2)})`));
  }
  select.value = hasMarks ? (r && r.grade) || '' : c.grade;

  return el('tr', { dataset: { course: c.id } },
    el('td', {}, el('input', { class: 'course-name', value: c.name, placeholder: 'Course name', 'aria-label': 'Course name', dataset: { field: 'name' } })),
    el('td', { 'data-label': 'Credits' }, el('input', { class: 'num', type: 'number', min: '0', step: '0.5', inputmode: 'decimal', value: c.credits, 'aria-label': 'Credit hours', dataset: { field: 'credits' } })),
    el('td', { 'data-label': 'Marks' }, el('input', { class: 'num', type: 'number', min: '0', max: '100', step: 'any', inputmode: 'decimal', value: c.marks, placeholder: '0–100', 'aria-label': 'Marks', dataset: { field: 'marks' } })),
    el('td', { 'data-label': 'Grade' },
      select,
      el('div', { class: 'row-error', dataset: { role: 'row-error' } }, (r && r.error) || ''),
    ),
    el('td', {}, el('button', { type: 'button', class: 'icon-btn danger', title: 'Remove course', 'aria-label': 'Remove course', dataset: { action: 'course-delete' } }, '✕')),
  );
}

// Update numbers in place so typing never loses focus.
function refreshComputed() {
  for (const sem of state.semesters) {
    const card = document.querySelector(`[data-sem="${sem.id}"]`);
    if (!card) continue;
    const t = semesterTotals(sem);
    card.querySelector('[data-role="sem-gpa"]').textContent = `GPA ${fmt(t.gpa)}`;
    card.querySelector('[data-role="sem-credits"]').textContent = `${fmtCredits(t.credits)} credit hours counted`;
    for (const c of sem.courses) {
      const row = card.querySelector(`[data-course="${c.id}"]`);
      if (!row) continue;
      const r = evaluateCourse(c);
      const hasMarks = parseNum(c.marks) !== null;
      const select = row.querySelector('[data-field="grade"]');
      select.disabled = hasMarks;
      select.value = hasMarks ? (r && r.grade) || '' : c.grade;
      row.querySelector('[data-role="row-error"]').textContent = (r && r.error) || '';
    }
  }
  renderSummary();
  renderTarget();
}

function renderSummary() {
  const t = overallTotals();
  $('cgpa').textContent = fmt(t.cgpa);
  $('total-credits').textContent = fmtCredits(t.credits);
  $('semester-count').textContent = String(state.semesters.length);

  const pc = parseNum(state.prior.cgpa);
  $('prior-cgpa').setCustomValidity(pc !== null && (pc < 0 || pc > maxGP()) ? `CGPA must be 0–${maxGP()}` : '');
  $('prior-cgpa').max = String(maxGP());
}

function renderTarget() {
  const out = $('target-result');
  out.className = 'result';
  const target = parseNum(state.target.cgpa);
  const next = parseNum(state.target.credits);
  $('target-cgpa').max = String(maxGP());
  if (target === null || next === null) {
    out.textContent = '';
    return;
  }
  if (next <= 0 || target < 0 || target > maxGP()) {
    out.textContent = `Enter a target from 0 to ${maxGP().toFixed(2)} and at least 1 credit hour.`;
    out.classList.add('bad');
    return;
  }
  const t = overallTotals();
  const needed = (target * (t.credits + next) - t.points) / next;
  if (needed > maxGP() + 1e-9) {
    const best = (t.points + maxGP() * next) / (t.credits + next);
    out.textContent = `Out of reach in ${fmtCredits(next)} credit hours: even a perfect ${maxGP().toFixed(2)} gets you to ${best.toFixed(2)}.`;
    out.classList.add('bad');
  } else if (needed <= 0) {
    out.textContent = `You're already set: you'd stay at or above ${target.toFixed(2)} whatever you score.`;
    out.classList.add('good');
  } else {
    out.textContent = `You need a GPA of at least ${needed.toFixed(2)} over the next ${fmtCredits(next)} credit hours.`;
    out.classList.add(needed > maxGP() * 0.875 ? 'warn' : 'good');
  }
}

function renderScale() {
  const body = $('scale-body');
  body.replaceChildren();
  state.scale.forEach((g, i) => {
    body.append(el('tr', { dataset: { index: String(i) } },
      el('td', {}, el('input', { class: 'num', type: 'number', min: '0', max: '100', step: 'any', value: Number.isFinite(g.min) ? g.min : '', 'aria-label': 'Minimum marks', dataset: { field: 'min' } })),
      el('td', {}, el('input', { class: 'grade-input', value: g.grade, 'aria-label': 'Grade letter', dataset: { field: 'grade' } })),
      el('td', {}, el('input', { class: 'num', type: 'number', min: '0', step: '0.01', value: Number.isFinite(g.gp) ? g.gp : '', 'aria-label': 'Grade points', dataset: { field: 'gp' } })),
      el('td', {}, el('button', { type: 'button', class: 'icon-btn danger', title: 'Remove grade', 'aria-label': 'Remove grade', dataset: { action: 'grade-delete' }, disabled: state.scale.length <= 1 }, '✕')),
    ));
  });
  validateScale();
}

function validateScale() {
  const grades = state.scale.map((g) => g.grade.trim());
  let msg = '';
  if (state.scale.some((g) => !Number.isFinite(g.min) || !Number.isFinite(g.gp) || !g.grade.trim())) {
    msg = 'Every row needs minimum marks, a grade and grade points.';
  } else if (new Set(grades).size !== grades.length) {
    msg = 'Grade names must be unique.';
  } else if (!state.scale.some((g) => g.min <= 0)) {
    msg = 'Add a grade with minimum 0 so every mark gets a grade.';
  }
  $('scale-error').textContent = msg;
}

function renderPresetOptions() {
  const select = $('preset-select');
  for (const n of Object.keys(PRESETS)) {
    select.append(el('option', { value: n }, `Semester ${n}`));
  }
}

function renderAll() {
  renderSemesters();
  renderScale();
  $('prior-cgpa').value = state.prior.cgpa;
  $('prior-credits').value = state.prior.credits;
  $('target-cgpa').value = state.target.cgpa;
  $('target-credits').value = state.target.credits;
  renderSummary();
  renderTarget();
}

// ---------- actions ----------

function findSem(node) {
  const card = node.closest('[data-sem]');
  return card && state.semesters.find((s) => s.id === card.dataset.sem);
}

function findCourse(sem, node) {
  const row = node.closest('[data-course]');
  return row && sem.courses.find((c) => c.id === row.dataset.course);
}

function blankCourse() {
  return { id: uid(), name: '', credits: '3', marks: '', grade: '' };
}

function addSemester(courses, name) {
  state.semesters.push({
    id: uid(),
    name: name || `Semester ${state.semesters.length + 1}`,
    courses,
  });
  save();
  renderSemesters();
  renderSummary();
  renderTarget();
  const cards = document.querySelectorAll('.semester');
  const last = cards[cards.length - 1];
  if (last) {
    last.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const firstEmpty = last.querySelector('[data-field="name"][value=""], [data-field="marks"]');
    if (firstEmpty) firstEmpty.focus({ preventScroll: true });
  }
}

$('add-blank').addEventListener('click', () => {
  addSemester([blankCourse(), blankCourse(), blankCourse()]);
});

$('add-preset').addEventListener('click', () => {
  const n = $('preset-select').value;
  const courses = PRESETS[n].map(([name, credits]) => ({ id: uid(), name, credits: String(credits), marks: '', grade: '' }));
  addSemester(courses, `Semester ${n}`);
});

$('semesters').addEventListener('input', (e) => {
  const sem = findSem(e.target);
  if (!sem) return;
  const field = e.target.dataset.field;
  if (field === 'sem-name') {
    sem.name = e.target.value;
  } else {
    const c = findCourse(sem, e.target);
    if (!c || !(field in c)) return;
    c[field] = e.target.value;
  }
  save();
  refreshComputed();
});

$('semesters').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const sem = findSem(btn);
  if (!sem) return;
  const idx = state.semesters.indexOf(sem);
  switch (btn.dataset.action) {
    case 'course-add': {
      sem.courses.push(blankCourse());
      save();
      renderSemesters();
      const rows = document.querySelectorAll(`[data-sem="${sem.id}"] [data-course]`);
      rows[rows.length - 1].querySelector('[data-field="name"]').focus();
      break;
    }
    case 'course-delete': {
      const c = findCourse(sem, btn);
      sem.courses = sem.courses.filter((x) => x !== c);
      save();
      renderSemesters();
      break;
    }
    case 'sem-delete': {
      const filled = sem.courses.some((c) => c.marks !== '' || c.grade !== '');
      if (filled && !confirm(`Delete "${sem.name}" and all its courses?`)) return;
      state.semesters.splice(idx, 1);
      save();
      renderSemesters();
      break;
    }
    case 'sem-up':
    case 'sem-down': {
      const to = btn.dataset.action === 'sem-up' ? idx - 1 : idx + 1;
      if (to < 0 || to >= state.semesters.length) return;
      [state.semesters[idx], state.semesters[to]] = [state.semesters[to], state.semesters[idx]];
      save();
      renderSemesters();
      break;
    }
  }
  renderSummary();
  renderTarget();
});

for (const [id, group, key] of [
  ['prior-cgpa', 'prior', 'cgpa'],
  ['prior-credits', 'prior', 'credits'],
  ['target-cgpa', 'target', 'cgpa'],
  ['target-credits', 'target', 'credits'],
]) {
  $(id).addEventListener('input', (e) => {
    state[group][key] = e.target.value;
    save();
    renderSummary();
    renderTarget();
  });
}

$('scale-body').addEventListener('input', (e) => {
  const row = e.target.closest('[data-index]');
  if (!row) return;
  const g = state.scale[Number(row.dataset.index)];
  const field = e.target.dataset.field;
  if (field === 'grade') {
    g.grade = e.target.value;
  } else {
    g[field] = e.target.value === '' ? NaN : Number(e.target.value);
  }
  save();
  validateScale();
  // Grade options changed, so rebuild the course tables (scale inputs keep focus).
  renderSemesters();
  renderSummary();
  renderTarget();
});

$('scale-body').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="grade-delete"]');
  if (!btn || state.scale.length <= 1) return;
  state.scale.splice(Number(btn.closest('[data-index]').dataset.index), 1);
  save();
  renderAll();
});

$('add-grade').addEventListener('click', () => {
  state.scale.push({ min: NaN, grade: '', gp: NaN });
  save();
  renderScale();
  const inputs = $('scale-body').querySelectorAll('[data-field="min"]');
  inputs[inputs.length - 1].focus();
});

$('reset-scale').addEventListener('click', () => {
  if (!confirm('Replace your grading scale with the default one?')) return;
  state.scale = DEFAULT_SCALE.map((g) => ({ ...g }));
  save();
  renderAll();
});

$('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `cgpa-backup-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  $('data-status').textContent = 'Backup downloaded.';
});

$('import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || !Array.isArray(data.semesters)) throw new Error('not a backup');
    if (state.semesters.length && !confirm('Replace your current data with this backup?')) return;
    state = normalize(data);
    save();
    renderAll();
    $('data-status').textContent = `Imported ${state.semesters.length} semester(s).`;
  } catch (err) {
    $('data-status').textContent = "That file isn't a CGPA Calculator backup.";
  }
});

$('reset-all').addEventListener('click', () => {
  if (!confirm('Clear all semesters, your earlier record and your grading scale? This cannot be undone.')) return;
  state = freshState();
  save();
  renderAll();
  $('data-status').textContent = 'Cleared.';
});

renderPresetOptions();
renderAll();
