import { store, changed } from '../store.js';
import { overallTotals, requiredGPA, sortedScale, parseNum, maxGP, fmt, fmtCredits, whatIf, paceGrade, evaluateCourse, semesterTotals } from '../calc.js';
import { el, icon } from '../ui.js';

// What-if grades live only while the app is open; they are never saved.
const whatIfGrades = new Map(); // semesterId → { courseId: grade }
let whatIfSemester = null;

export function renderPlanner(root) {
  const data = store.data;
  const t = data.target;
  const max = maxGP(data);
  const totals = overallTotals(data);

  const target = el('input', { type: 'number', min: '0', max: String(max), step: '0.01', inputmode: 'decimal', value: t.cgpa, placeholder: 'e.g. 3.50' });
  const credits = el('input', { type: 'number', min: '1', step: '1', inputmode: 'numeric', value: t.credits, placeholder: 'e.g. 17' });
  const result = el('div', { class: 'plan-result', 'aria-live': 'polite' });
  const table = el('div', { class: 'plan-table' });

  // The lowest grade whose points meet the needed GPA, as a rough "average of" hint.
  const gradeFor = (gpa) => sortedScale(data).slice().reverse().find((g) => g.gp >= gpa - 1e-9);

  function render(persist) {
    t.cgpa = target.value;
    t.credits = credits.value;
    const goal = parseNum(t.cgpa);
    const next = parseNum(t.credits);
    result.replaceChildren();
    result.className = 'plan-result';

    if (goal === null || next === null) {
      result.append(el('p', { class: 'muted' }, 'Enter a target CGPA and how many credit hours you’re taking next to see the GPA you need.'));
    } else if (next <= 0 || goal < 0 || goal > max) {
      result.classList.add('bad');
      result.append(el('p', {}, `Enter a target from 0 to ${fmt(max)} and at least 1 credit hour.`));
    } else {
      const r = requiredGPA(data, goal, next);
      if (!r.reachable) {
        result.classList.add('bad');
        result.append(
          el('span', { class: 'plan-label' }, icon('alert', 18), 'Out of reach this time'),
          el('p', {}, `Even a perfect ${fmt(max)} over ${fmtCredits(next)} credit hours gets you to ${fmt(r.best)}. Try more credit hours, or aim for ${fmt(Math.floor(r.best * 100) / 100)} for now.`),
        );
      } else if (r.needed <= 0) {
        result.classList.add('good');
        result.append(
          el('span', { class: 'plan-label' }, icon('check', 18), 'Already there'),
          el('p', {}, `You’ll stay at or above ${fmt(goal)} whatever you score.`),
        );
      } else {
        const g = gradeFor(r.needed);
        result.classList.add(r.needed > max * 0.875 ? 'warn' : 'good');
        result.append(
          el('span', { class: 'plan-label' }, 'You need a GPA of at least'),
          el('div', { class: 'plan-value' }, fmt(r.needed)),
          el('p', {}, `over your next ${fmtCredits(next)} credit hours${g ? ` — roughly ${/^[AEFHILMNORSX]/i.test(g.grade) ? 'an' : 'a'} ${g.grade} average` : ''}.`),
        );
      }
    }
    renderTable(next);
    if (persist) changed();
  }

  function renderTable(next) {
    table.replaceChildren();
    tableCard.hidden = next === null || next <= 0;
    if (tableCard.hidden) return;
    const goals = [2.5, 3.0, 3.3, 3.5, 3.7, 4.0].filter((g) => g <= max);
    table.append(
      el('h3', {}, `Other targets over ${fmtCredits(next)} credit hours`),
      el('table', { class: 'data-table' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Target CGPA'), el('th', { class: 'num' }, 'GPA needed'))),
        el('tbody', {}, goals.map((g) => {
          const r = requiredGPA(data, g, next);
          const text = !r.reachable ? 'Out of reach' : r.needed <= 0 ? 'Already there' : fmt(r.needed);
          return el('tr', { class: !r.reachable ? 'is-bad' : '' }, el('td', {}, fmt(g)), el('td', { class: 'num' }, text));
        })),
      ),
    );
  }

  target.addEventListener('input', () => render(true));
  credits.addEventListener('input', () => render(true));
  const tableCard = el('section', { class: 'card' }, table);

  root.append(
    el('div', { class: 'page-intro' },
      el('h2', {}, 'Plan your next semester'),
      el('p', {}, totals.cgpa === null
        ? 'You haven’t entered any grades yet, so this plans from a fresh start. Add your semesters for an exact answer.'
        : `Your CGPA is ${fmt(totals.cgpa)} over ${fmtCredits(totals.credits)} credit hours. Find out what it takes to reach your goal.`),
    ),
    el('div', { class: 'plan-grid' },
      el('section', { class: 'card' },
        el('div', { class: 'field-grid' },
          el('label', { class: 'field' }, el('span', {}, 'Target CGPA'), target),
          el('label', { class: 'field' }, el('span', {}, 'Upcoming credit hours'), credits),
        ),
        result,
      ),
      tableCard,
    ),
  );

  root.append(whatIfCard(data));
  render(false);
}

function whatIfCard(data) {
  const card = el('section', { class: 'card whatif' });
  const head = el('div', { class: 'card-head' }, el('div', {},
    el('h3', {}, 'What if…'),
    el('p', { class: 'card-sub' }, 'Try grades for a semester’s courses and see where your GPA and CGPA would land. Nothing here is saved.')));

  if (!data.semesters.length) {
    card.append(head, el('p', { class: 'muted' }, 'Add a semester first, then come back to try out grades.'));
    return card;
  }

  // Default to the latest semester that still has courses without a grade.
  if (!data.semesters.some((x) => x.id === whatIfSemester)) {
    const open = [...data.semesters].reverse().find((x) => semesterTotals(data, x).pending > 0);
    whatIfSemester = (open || data.semesters[data.semesters.length - 1]).id;
  }

  const select = el('select', { 'aria-label': 'Semester' });
  data.semesters.forEach((x) => select.append(el('option', { value: x.id }, x.name || 'Untitled semester')));
  select.value = whatIfSemester;
  select.addEventListener('change', () => {
    whatIfSemester = select.value;
    draw();
  });

  const rows = el('div', { class: 'whatif-rows' });
  const results = el('div', { class: 'whatif-results', 'aria-live': 'polite' });
  const tools = el('div', { class: 'btn-row' });
  const scale = sortedScale(data);

  function overrides() {
    if (!whatIfGrades.has(whatIfSemester)) whatIfGrades.set(whatIfSemester, {});
    return whatIfGrades.get(whatIfSemester);
  }

  function draw() {
    const sem = data.semesters.find((x) => x.id === whatIfSemester);
    const o = overrides();
    rows.replaceChildren(el('div', { class: 'whatif-row whatif-head', 'aria-hidden': 'true' },
      el('span', {}, 'Course'), el('span', {}, 'Now'), el('span', {}, 'What if')));
    let paceAvailable = false;
    for (const c of sem.courses) {
      const r = evaluateCourse(data, c);
      const pace = r && r.gp !== undefined ? null : paceGrade(data, c);
      if (pace) paceAvailable = true;
      const now = r && r.gp !== undefined ? r.grade : pace ? `On pace for ${pace.grade}` : 'No grade yet';
      const pick = el('select', { 'aria-label': `What-if grade for ${c.name || 'course'}` });
      pick.append(el('option', { value: '' }, r && r.gp !== undefined ? `Keep ${r.grade}` : 'Not counted'));
      for (const g of scale) pick.append(el('option', { value: g.grade }, `${g.grade} · ${Number(g.gp.toFixed(2))}`));
      pick.value = o[c.id] || '';
      pick.classList.toggle('changed', Boolean(o[c.id]));
      pick.addEventListener('change', () => {
        if (pick.value) o[c.id] = pick.value;
        else delete o[c.id];
        pick.classList.toggle('changed', Boolean(pick.value));
        drawResults();
      });
      rows.append(el('div', { class: 'whatif-row' },
        el('span', { class: 'whatif-name' }, el('strong', {}, c.name || 'Untitled course'), el('span', { class: 'muted small' }, ` · ${c.credits || 0} cr`)),
        el('span', { class: `whatif-now${r && r.gp !== undefined ? '' : ' muted'}` }, now),
        pick,
      ));
    }
    if (!sem.courses.length) rows.append(el('p', { class: 'muted' }, 'This semester has no courses yet.'));

    tools.replaceChildren(
      paceAvailable ? el('button', { type: 'button', class: 'btn btn-ghost btn-small', onclick: () => {
        for (const c of sem.courses) {
          const r = evaluateCourse(data, c);
          const pace = r && r.gp !== undefined ? null : paceGrade(data, c);
          if (pace) o[c.id] = pace.grade;
        }
        draw();
      } }, 'Use on-pace grades') : null,
      el('button', { type: 'button', class: 'btn btn-ghost btn-small', onclick: () => {
        whatIfGrades.set(whatIfSemester, {});
        draw();
      } }, 'Reset'),
    );
    drawResults();
  }

  function drawResults() {
    const sem = data.semesters.find((x) => x.id === whatIfSemester);
    const actualSem = semesterTotals(data, sem);
    const actual = overallTotals(data);
    const next = whatIf(data, whatIfSemester, overrides());
    const box = (label, value, base) => {
      const delta = value !== null && base !== null ? value - base : null;
      const shown = delta === null || Math.abs(delta) < 0.005 ? null : delta;
      return el('div', { class: 'whatif-stat' },
        el('span', { class: 'stat-label' }, label),
        el('span', { class: 'stat-value' }, fmt(value)),
        el('span', { class: 'stat-sub' }, base === null ? 'No grades yet' : `Now ${fmt(base)}`,
          shown !== null ? el('span', { class: `delta-inline ${shown > 0 ? 'up' : 'down'}` }, ` ${shown > 0 ? '+' : '−'}${Math.abs(shown).toFixed(2)}`) : null),
      );
    };
    results.replaceChildren(
      box(`${sem.name || 'Semester'} GPA`, next.semester.gpa, actualSem.gpa),
      box('CGPA', next.overall.cgpa, actual.cgpa),
    );
  }

  card.append(head,
    el('label', { class: 'field narrow' }, el('span', {}, 'Semester'), select),
    rows, tools, results);
  draw();
  return card;
}
