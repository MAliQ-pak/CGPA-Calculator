// Printable summary of every semester ("Save as PDF" through the browser's print dialog).
import { store } from '../store.js';
import {
  overallTotals, history, semesterTotals, evaluateCourse, courseMarks, retakeInfo, priorTotals,
  sortedScale, fmt, fmtCredits,
} from '../calc.js';
import { el, icon } from '../ui.js';
import { logoMark } from './auth.js';

export function renderReport(root) {
  const data = store.data;
  const totals = overallTotals(data);
  const rows = history(data);
  const info = retakeInfo(data);
  const prior = priorTotals(data);
  const semName = (i) => data.semesters[i].name || `Semester ${i + 1}`;
  const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  const semesters = data.semesters.map((sem, si) => {
    const t = semesterTotals(data, sem);
    const after = rows.find((r) => r.id === sem.id);
    return el('section', { class: 'report-sem' },
      el('div', { class: 'report-sem-head' },
        el('h3', {}, semName(si)),
        el('span', {}, `GPA ${fmt(t.gpa)} · ${fmtCredits(t.credits)} credit hours${after ? ` · CGPA after ${fmt(after.cgpa)}` : ''}`),
      ),
      sem.courses.length
        ? el('table', { class: 'report-table' },
          el('thead', {}, el('tr', {}, el('th', {}, 'Course'), el('th', { class: 'num' }, 'Credits'), el('th', { class: 'num' }, 'Marks'), el('th', {}, 'Grade'), el('th', { class: 'num' }, 'Points'))),
          el('tbody', {}, sem.courses.map((c) => {
            const r = evaluateCourse(data, c);
            const counted = r && r.gp !== undefined;
            const marks = courseMarks(c);
            const i = info.get(c.id) || {};
            const notes = [
              i.retakeOf ? `Retake of ${i.retakeOf.course.name || 'a course'} (${semName(i.retakeOf.semIndex)})` : '',
              i.notCounted ? 'Not counted in CGPA (repeated)' : '',
              !counted ? 'In progress' : '',
            ].filter(Boolean).join(' · ');
            return el('tr', { class: i.notCounted ? 'struck' : '' },
              el('td', {}, c.name || 'Untitled course', notes ? el('div', { class: 'report-note' }, notes) : null),
              el('td', { class: 'num' }, c.credits || '–'),
              el('td', { class: 'num' }, marks === null ? '–' : String(marks)),
              el('td', {}, counted ? r.grade : '–'),
              el('td', { class: 'num' }, counted ? fmt(r.gp * r.credits) : '–'),
            );
          })))
        : el('p', { class: 'report-note' }, 'No courses.'),
    );
  });

  const scale = sortedScale(data);
  const sheet = el('article', { class: 'report-sheet' },
    el('header', { class: 'report-head' },
      el('div', { class: 'report-brand' }, logoMark(36), el('span', {}, 'GradePoint')),
      el('span', { class: 'report-date' }, `Generated ${today}`),
    ),
    el('h1', {}, 'Academic summary'),
    el('p', { class: 'report-who' }, [store.user.name, data.program.name, data.profile.university].filter(Boolean).join(' · ')),
    el('div', { class: 'report-stats' },
      stat('CGPA', fmt(totals.cgpa)),
      stat('Credit hours counted', fmtCredits(totals.credits)),
      stat('Semesters', String(data.semesters.length)),
    ),
    prior.credits ? el('p', { class: 'report-note' }, `Includes an earlier record of CGPA ${data.prior.cgpa} over ${data.prior.credits} credit hours.`) : null,
    ...semesters,
    el('section', { class: 'report-sem report-scale' },
      el('h3', {}, 'Grading scale'),
      el('p', { class: 'report-note' }, scale.map((g) => `${g.grade} ${g.min}+ = ${Number(g.gp.toFixed(2))}`).join(' · ')),
      el('p', { class: 'report-note' }, `Repeated courses: ${data.retakePolicy === 'best' ? 'the best attempt' : 'the latest attempt'} counts toward CGPA.`),
    ),
    el('footer', { class: 'report-foot' }, 'Unofficial summary calculated by GradePoint from the grades entered. Not an official transcript.'),
  );

  root.append(
    el('div', { class: 'report-toolbar no-print' },
      el('a', { href: '#/dashboard', class: 'back-link' }, el('span', { class: 'flip' }, icon('chevron', 16)), 'Dashboard'),
      el('div', { class: 'btn-row' },
        el('button', { type: 'button', class: 'btn btn-primary', onclick: () => window.print() }, icon('download', 18), 'Save as PDF'),
      ),
    ),
    el('p', { class: 'muted small no-print report-hint' }, 'In the print window, choose “Save as PDF” as the printer.'),
    sheet,
  );
  document.title = 'Academic summary · GradePoint';
}

function stat(label, value) {
  return el('div', { class: 'report-stat' }, el('span', {}, label), el('strong', {}, value));
}
