import { store, changed } from '../store.js';
import { overallTotals, requiredGPA, sortedScale, parseNum, maxGP, fmt, fmtCredits } from '../calc.js';
import { el, icon } from '../ui.js';

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

  render(false);
}
