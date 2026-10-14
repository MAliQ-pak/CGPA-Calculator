import { store, changed } from '../store.js';
import {
  uid, blankCourse, programCourses, programCredits, evaluateCourse, semesterTotals, overallTotals,
  sortedScale, parseNum, maxGP, fmt, fmtCredits,
} from '../calc.js';
import { el, icon, openDialog, confirmDialog, toast } from '../ui.js';

const expanded = new Set();
let openNext = null;

// Lets other pages open a particular semester when they link here.
export function requestOpen(id) {
  openNext = id;
}

export function renderSemesters(root) {
  const data = store.data;

  if (openNext) {
    expanded.add(openNext);
  } else if (!expanded.size && data.semesters.length) {
    expanded.add(data.semesters[data.semesters.length - 1].id);
  }

  const summary = el('div', { class: 'sem-summary' });
  const list = el('div', { class: 'sem-cards' });

  const addButton = el('button', { type: 'button', class: 'btn btn-primary', onclick: addSemesterDialog }, icon('plus', 18), 'Add semester');

  root.append(
    el('div', { class: 'page-intro row' },
      el('div', {},
        el('h2', {}, 'Your semesters'),
        el('p', {}, 'Enter marks out of 100, or pick a grade if you only know that. Rename courses, change credit hours or add courses right in the list. Changes save automatically.'),
      ),
      addButton,
    ),
    summary,
    priorCard(),
    list,
  );

  function renderSummary() {
    const t = overallTotals(data);
    summary.replaceChildren(
      el('div', { class: 'summary-item' }, el('span', {}, 'CGPA'), el('strong', {}, fmt(t.cgpa))),
      el('div', { class: 'summary-item' }, el('span', {}, 'Credit hours'), el('strong', {}, fmtCredits(t.credits))),
    );
  }

  function renderList() {
    list.replaceChildren();
    if (!data.semesters.length) {
      list.append(el('div', { class: 'card empty-state' },
        el('div', { class: 'empty-icon' }, icon('semesters', 28)),
        el('h3', {}, 'No semesters yet'),
        el('p', {}, 'Start with a BSCS preset or a blank semester for any course list.'),
        el('button', { type: 'button', class: 'btn btn-primary', onclick: addSemesterDialog }, icon('plus', 18), 'Add semester'),
      ));
      return;
    }
    data.semesters.forEach((s, i) => list.append(semesterCard(s, i)));
  }

  function semesterCard(sem, index) {
    const isOpen = expanded.has(sem.id);
    const t = semesterTotals(data, sem);
    const bodyId = `sem-body-${sem.id}`;

    const toggle = el('button', { type: 'button', class: 'sem-toggle', 'aria-expanded': String(isOpen), 'aria-controls': bodyId },
      icon('chevron', 18),
      el('span', { class: 'sem-title' }, sem.name || 'Untitled semester'),
      el('span', { class: 'sem-meta', dataset: { role: 'meta' } }, metaText(t, sem)),
      el('span', { class: 'pill', dataset: { role: 'gpa' } }, `GPA ${fmt(t.gpa)}`),
    );
    toggle.addEventListener('click', () => {
      if (expanded.has(sem.id)) expanded.delete(sem.id);
      else expanded.add(sem.id);
      renderList();
    });

    const card = el('article', { class: `card sem-card${isOpen ? ' open' : ''}`, dataset: { sem: sem.id } }, toggle);
    if (!isOpen) return card;

    const rows = el('div', { class: 'course-rows' });
    sem.courses.forEach((c) => rows.append(courseRow(sem, c)));

    const body = el('div', { class: 'sem-body', id: bodyId },
      el('div', { class: 'sem-name-row' },
        el('label', { class: 'field inline' },
          el('span', {}, 'Semester name'),
          el('input', { type: 'text', value: sem.name, dataset: { field: 'sem-name' } }),
        ),
      ),
      el('div', { class: 'course-head', 'aria-hidden': 'true' },
        el('span', {}, 'Course'), el('span', {}, 'Credits'), el('span', {}, 'Marks'), el('span', {}, 'Grade'), el('span', {}),
      ),
      rows,
      el('div', { class: 'sem-foot' },
        el('button', { type: 'button', class: 'btn btn-ghost btn-small', dataset: { action: 'course-add' } }, icon('plus', 16), 'Add course'),
        el('div', { class: 'sem-tools' },
          el('button', { type: 'button', class: 'icon-btn', title: 'Move up', 'aria-label': 'Move semester up', dataset: { action: 'up' }, disabled: index === 0 }, icon('up', 18)),
          el('button', { type: 'button', class: 'icon-btn', title: 'Move down', 'aria-label': 'Move semester down', dataset: { action: 'down' }, disabled: index === data.semesters.length - 1 }, icon('down', 18)),
          el('button', { type: 'button', class: 'btn btn-ghost btn-small danger-text', dataset: { action: 'delete' } }, icon('trash', 16), 'Delete semester'),
        ),
      ),
    );
    card.append(body);

    body.addEventListener('input', (e) => {
      const field = e.target.dataset.field;
      if (!field) return;
      if (field === 'sem-name') {
        sem.name = e.target.value;
        toggle.querySelector('.sem-title').textContent = sem.name || 'Untitled semester';
      } else {
        const row = e.target.closest('[data-course]');
        const c = row && sem.courses.find((x) => x.id === row.dataset.course);
        if (!c) return;
        c[field] = e.target.value;
        refreshRow(row, c);
      }
      changed();
      refreshTotals(card, sem);
    });

    body.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const idx = data.semesters.indexOf(sem);
      switch (btn.dataset.action) {
        case 'course-add': {
          const c = blankCourse();
          sem.courses.push(c);
          changed();
          const row = courseRow(sem, c);
          rows.append(row);
          row.querySelector('[data-field="name"]').focus();
          refreshTotals(card, sem);
          break;
        }
        case 'course-remove': {
          const row = btn.closest('[data-course]');
          const c = sem.courses.find((x) => x.id === row.dataset.course);
          const pos = sem.courses.indexOf(c);
          sem.courses.splice(pos, 1);
          changed();
          row.remove();
          refreshTotals(card, sem);
          if (c.name || c.marks || c.grade) {
            undoToast(`Removed ${c.name || 'course'}`, () => {
              sem.courses.splice(pos, 0, c);
              changed();
              renderList();
              renderSummary();
            });
          }
          break;
        }
        case 'up':
        case 'down': {
          const to = btn.dataset.action === 'up' ? idx - 1 : idx + 1;
          if (to < 0 || to >= data.semesters.length) return;
          [data.semesters[idx], data.semesters[to]] = [data.semesters[to], data.semesters[idx]];
          changed();
          renderList();
          const moved = list.querySelector(`[data-sem="${sem.id}"] [data-action="${btn.dataset.action}"]`);
          if (moved && !moved.disabled) moved.focus();
          break;
        }
        case 'delete': {
          const filled = sem.courses.some((c) => c.marks !== '' || c.grade !== '');
          if (filled && !(await confirmDialog({ title: `Delete ${sem.name || 'this semester'}?`, message: 'This removes the semester and all its courses from your account.', confirmText: 'Delete', danger: true }))) return;
          data.semesters.splice(idx, 1);
          expanded.delete(sem.id);
          changed();
          renderList();
          renderSummary();
          toast(`Deleted ${sem.name || 'semester'}`);
          break;
        }
      }
    });

    return card;
  }

  function courseRow(sem, c) {
    const select = el('select', { 'aria-label': 'Grade', dataset: { field: 'grade' } });
    select.append(el('option', { value: '' }, '—'));
    for (const g of sortedScale(data)) select.append(el('option', { value: g.grade }, `${g.grade} · ${Number(g.gp.toFixed(2))}`));
    const row = el('div', { class: 'course-row', dataset: { course: c.id } },
      el('label', { class: 'cell cell-name' },
        el('span', { class: 'cell-label' }, 'Course'),
        el('input', { type: 'text', value: c.name, placeholder: 'Course name', dataset: { field: 'name' } }),
      ),
      el('label', { class: 'cell' },
        el('span', { class: 'cell-label' }, 'Credits'),
        el('input', { type: 'number', min: '0', step: '0.5', inputmode: 'decimal', value: c.credits, dataset: { field: 'credits' } }),
      ),
      el('label', { class: 'cell' },
        el('span', { class: 'cell-label' }, 'Marks'),
        el('input', { type: 'number', min: '0', max: '100', step: 'any', inputmode: 'decimal', value: c.marks, placeholder: '0–100', dataset: { field: 'marks' } }),
      ),
      el('label', { class: 'cell' }, el('span', { class: 'cell-label' }, 'Grade'), select),
      el('button', { type: 'button', class: 'icon-btn remove', title: 'Remove course', 'aria-label': `Remove ${c.name || 'course'}`, dataset: { action: 'course-remove' } }, icon('x', 18)),
      el('p', { class: 'row-error', dataset: { role: 'error' } }),
    );
    refreshRow(row, c);
    return row;
  }

  function refreshRow(row, c) {
    const r = evaluateCourse(data, c);
    const hasMarks = parseNum(c.marks) !== null;
    const select = row.querySelector('[data-field="grade"]');
    select.disabled = hasMarks;
    select.value = hasMarks ? (r && r.grade) || '' : c.grade;
    select.title = hasMarks ? 'Worked out from your marks' : '';
    row.querySelector('[data-field="marks"]').classList.toggle('invalid', Boolean(r && r.error && hasMarks && r.error.startsWith('Marks')));
    row.querySelector('[data-role="error"]').textContent = (r && r.error) || '';
    row.classList.toggle('has-error', Boolean(r && r.error));
  }

  function refreshTotals(card, sem) {
    const t = semesterTotals(data, sem);
    card.querySelector('[data-role="gpa"]').textContent = `GPA ${fmt(t.gpa)}`;
    card.querySelector('[data-role="meta"]').textContent = metaText(t, sem);
    renderSummary();
  }

  function addSemesterDialog() {
    openDialog({
      title: 'Add a semester',
      wide: true,
      build: (close) => {
        const used = new Set(data.semesters.map((s) => s.name));
        const pick = (courses, name) => {
          const sem = { id: uid(), name, courses };
          data.semesters.push(sem);
          expanded.clear();
          expanded.add(sem.id);
          changed();
          close();
          renderList();
          renderSummary();
          const card = list.querySelector(`[data-sem="${sem.id}"]`);
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
          const target = card.querySelector('[data-field="marks"]');
          const firstName = card.querySelector('[data-field="name"]');
          (courses[0] && courses[0].name ? target : firstName).focus({ preventScroll: true });
        };
        return el('div', {},
          el('button', { type: 'button', class: 'option-card', onclick: () => pick([blankCourse(), blankCourse(), blankCourse()], `Semester ${data.semesters.length + 1}`) },
            el('span', { class: 'option-icon' }, icon('plus', 22)),
            el('span', {}, el('strong', {}, 'Blank semester'), el('span', { class: 'muted' }, 'Type in your own courses and credit hours')),
          ),
          el('div', { class: 'dialog-section-row' },
            el('h3', { class: 'dialog-section' }, `From your program${data.program.name ? ` (${data.program.name})` : ''}`),
            el('a', { href: '#/program', class: 'link small', onclick: () => close() }, 'Edit courses'),
          ),
          el('p', { class: 'muted small' }, 'Courses and credit hours are filled in from your program. You can still edit them after.'),
          el('div', { class: 'preset-grid' },
            data.program.semesters.map((ps, i) => {
              const name = `Semester ${i + 1}`;
              const empty = !ps.courses.length;
              return el('button', { type: 'button', class: `preset${used.has(name) ? ' used' : ''}`, onclick: () => pick(empty ? [blankCourse()] : programCourses(data, i), name) },
                el('strong', {}, name),
                el('span', { class: 'muted' }, empty ? 'No courses yet' : `${ps.courses.length} courses · ${fmtCredits(programCredits(ps))} cr`),
                used.has(name) ? el('span', { class: 'tag' }, 'Added') : null,
              );
            }),
          ),
        );
      },
    });
  }

  function priorCard() {
    const p = data.prior;
    const open = Boolean(p.cgpa || p.credits);
    const max = maxGP(data);
    const cgpa = el('input', { type: 'number', min: '0', max: String(max), step: '0.01', inputmode: 'decimal', value: p.cgpa, placeholder: 'e.g. 3.20' });
    const credits = el('input', { type: 'number', min: '0', step: '1', inputmode: 'numeric', value: p.credits, placeholder: 'e.g. 36' });
    const note = el('p', { class: 'row-error' });
    const update = () => {
      p.cgpa = cgpa.value;
      p.credits = credits.value;
      const v = parseNum(p.cgpa);
      note.textContent = v !== null && (v < 0 || v > max) ? `CGPA must be between 0 and ${fmt(max)}.` : '';
      changed();
      renderSummary();
    };
    cgpa.addEventListener('input', update);
    credits.addEventListener('input', update);
    return el('details', { class: 'card prior', open },
      el('summary', {},
        el('span', {}, el('strong', {}, 'Starting from an existing CGPA?'), el('span', { class: 'muted' }, ' Skip entering old semesters')),
        icon('down', 18),
      ),
      el('div', { class: 'prior-body' },
        el('p', { class: 'muted small' }, 'Enter your CGPA and credit hours before the semesters listed below. They’re combined into your overall CGPA.'),
        el('div', { class: 'field-grid' },
          el('label', { class: 'field' }, el('span', {}, 'CGPA so far'), cgpa),
          el('label', { class: 'field' }, el('span', {}, 'Credit hours completed'), credits),
        ),
        note,
      ),
    );
  }

  renderSummary();
  renderList();

  if (openNext) {
    const card = list.querySelector(`[data-sem="${openNext}"]`);
    if (card) card.scrollIntoView({ block: 'start' });
    openNext = null;
  }
  if (location.hash.endsWith('/new')) {
    history.replaceState(null, '', '#/semesters');
    addSemesterDialog();
  }
}

function metaText(t, sem) {
  const parts = [`${sem.courses.length} course${sem.courses.length === 1 ? '' : 's'}`, `${fmtCredits(t.credits)} cr counted`];
  if (t.pending && sem.courses.length) parts.push(`${t.pending} to fill`);
  return parts.join(' · ');
}

function undoToast(message, undo) {
  let host = document.getElementById('toasts');
  if (!host) {
    host = el('div', { id: 'toasts', class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(host);
  }
  const node = el('div', { class: 'toast' }, el('span', {}, message));
  const btn = el('button', { type: 'button', class: 'toast-action' }, 'Undo');
  btn.addEventListener('click', () => {
    undo();
    node.remove();
  });
  node.append(btn);
  host.append(node);
  setTimeout(() => node.remove(), 6000);
}
