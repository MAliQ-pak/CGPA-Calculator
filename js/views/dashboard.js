import { store } from '../store.js';
import { overallTotals, history, maxGP, fmt, fmtCredits } from '../calc.js';
import { el, icon } from '../ui.js';
import { gpaChart } from '../chart.js';
import { requestOpen } from './semesters.js';
import { openShareDialog } from './share.js';

export function renderDashboard(root, { navigate }) {
  const data = store.data;
  const totals = overallTotals(data);
  const rows = history(data);
  const max = maxGP(data);
  const firstName = (store.user.name || '').split(' ')[0];

  const greeting = el('div', { class: 'page-intro' },
    el('h2', {}, firstName ? `${timeGreeting()}, ${firstName}` : timeGreeting()),
    el('p', {}, [
      [data.program.name, data.profile.university].filter(Boolean).join(' · '),
      rows.length ? 'Here’s where your grades stand.' : data.semesters.length ? 'Enter your marks to see your CGPA.' : 'Let’s add your first semester.',
    ].filter(Boolean).join(' — ')),
  );

  if (!data.semesters.length && totals.cgpa === null) {
    root.append(greeting, el('section', { class: 'card empty-state' },
      el('div', { class: 'empty-icon' }, icon('book', 28)),
      el('h3', {}, 'No grades yet'),
      el('p', {}, 'Add a semester and enter your marks or grades. Your CGPA and progress show up here straight away.'),
      el('div', { class: 'btn-row center' },
        el('button', { type: 'button', class: 'btn btn-primary', onclick: () => navigate('semesters/new') }, icon('plus', 18), 'Add a semester'),
        el('a', { href: '#/semesters', class: 'btn btn-ghost' }, 'I already have a CGPA'),
      ),
    ));
    return;
  }

  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  const delta = last && prev ? last.cgpa - prev.cgpa : null;
  const best = rows.reduce((b, r) => (!b || r.gpa > b.gpa ? r : b), null);

  // Hero: CGPA with a ring meter.
  const pct = totals.cgpa === null ? 0 : Math.max(0, Math.min(1, totals.cgpa / max));
  const R = 52;
  const C = 2 * Math.PI * R;
  const ring = el('div', {
    class: 'ring',
    html: `<svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
      <circle cx="60" cy="60" r="${R}" class="ring-track"/>
      <circle cx="60" cy="60" r="${R}" class="ring-fill" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}" transform="rotate(-90 60 60)"/>
    </svg>`,
  });
  ring.append(el('span', { class: 'ring-label' }, icon('trend', 30)));
  ring.setAttribute('title', `${fmt(totals.cgpa)} out of ${fmt(max)}`);

  const hero = el('section', { class: 'card hero' },
    el('div', { class: 'hero-text' },
      el('span', { class: 'eyebrow' }, 'Cumulative GPA'),
      el('div', { class: 'hero-value' }, fmt(totals.cgpa), el('span', { class: 'hero-max' }, ` / ${fmt(max)}`)),
      delta !== null
        ? el('span', { class: `delta ${delta >= 0.005 ? 'up' : delta <= -0.005 ? 'down' : 'flat'}` },
            icon(delta >= 0.005 ? 'up' : delta <= -0.005 ? 'down' : 'chevron', 16),
            Math.abs(delta) < 0.005 ? `No change after ${last.name}` : `${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(2)} after ${last.name}`)
        : el('span', { class: 'hero-sub' }, `${fmtCredits(totals.credits)} credit hours counted`),
      totals.cgpa === null ? null : el('div', { class: 'hero-actions' },
        el('button', { type: 'button', class: 'btn btn-primary btn-small', onclick: openShareDialog }, icon('share', 16), 'Share my result'),
        el('a', { href: '#/report', class: 'btn btn-ghost btn-small' }, icon('download', 16), 'PDF summary'),
      ),
    ),
    ring,
  );

  const stats = el('section', { class: 'stats' },
    stat('Credit hours', fmtCredits(totals.credits)),
    stat('Semesters', String(data.semesters.length)),
    stat('Latest GPA', last ? fmt(last.gpa) : '–', last ? last.name : 'No grades yet'),
    stat('Best GPA', best ? fmt(best.gpa) : '–', best ? best.name : ''),
  );

  let chart = null;
  const trend = el('section', { class: 'card' },
    el('div', { class: 'card-head' },
      el('div', {}, el('h3', {}, 'Progress'), el('p', { class: 'card-sub' }, 'GPA each semester and your CGPA after it')),
    ),
  );
  if (rows.length) {
    chart = gpaChart(rows, max);
    trend.append(chart, el('details', { class: 'table-view' },
      el('summary', {}, 'Show as table'),
      el('table', { class: 'data-table' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Semester'), el('th', { class: 'num' }, 'Credits'), el('th', { class: 'num' }, 'GPA'), el('th', { class: 'num' }, 'CGPA after'))),
        el('tbody', {}, rows.map((r) => el('tr', {}, el('td', {}, r.name), el('td', { class: 'num' }, fmtCredits(r.credits)), el('td', { class: 'num' }, fmt(r.gpa)), el('td', { class: 'num' }, fmt(r.cgpa))))),
      ),
    ));
  } else {
    trend.append(el('p', { class: 'muted pad' }, 'Enter marks in a semester to see your progress here.'));
  }

  const list = el('section', { class: 'card' },
    el('div', { class: 'card-head' },
      el('h3', {}, 'Semesters'),
      el('a', { href: '#/semesters', class: 'link' }, 'Edit'),
    ),
    el('ul', { class: 'sem-list' },
      data.semesters.map((s) => {
        const r = rows.find((x) => x.id === s.id);
        return el('li', {},
          el('a', { href: `#/semesters`, onclick: () => requestOpen(s.id) },
            el('span', { class: 'sem-list-name' }, s.name),
            el('span', { class: 'muted' }, r ? `${fmtCredits(r.credits)} cr` : 'No grades yet'),
            el('span', { class: 'pill' }, r ? fmt(r.gpa) : '–'),
            icon('chevron', 18),
          ),
        );
      }),
    ),
  );

  root.append(greeting, el('div', { class: 'dash-grid' }, el('div', { class: 'dash-main' }, hero, stats, trend), el('div', { class: 'dash-side' }, list)));
  return () => chart && chart.dispose();
}

function stat(label, value, sub) {
  return el('div', { class: 'stat' },
    el('span', { class: 'stat-label' }, label),
    el('span', { class: 'stat-value' }, value),
    sub ? el('span', { class: 'stat-sub' }, sub) : null,
  );
}

function timeGreeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
