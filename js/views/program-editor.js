// Editor for the user's program: a course list (name + credit hours) for each semester.
// Used by the setup wizard and the Program & courses page.
import { uid, programCredits, fmtCredits } from '../calc.js';
import { el, icon, confirmDialog } from '../ui.js';

export function programEditor(program, { onChange, showName = true }) {
  let current = 0;
  const root = el('div', { class: 'program-editor' });
  const tabs = el('div', { class: 'program-tabs', role: 'tablist', 'aria-label': 'Semesters' });
  const panel = el('div', { class: 'program-panel', role: 'tabpanel' });

  if (showName) {
    const name = el('input', { type: 'text', value: program.name, placeholder: 'e.g. BSCS, BBA, BS Electrical Engineering' });
    name.addEventListener('input', () => {
      program.name = name.value;
      onChange();
    });
    root.append(el('label', { class: 'field program-name' }, el('span', {}, 'Degree program'), name));
  }
  root.append(tabs, panel);

  function renderTabs() {
    tabs.replaceChildren(
      ...program.semesters.map((s, i) => {
        const tab = el('button', {
          type: 'button',
          role: 'tab',
          class: 'program-tab',
          'aria-selected': String(i === current),
          tabindex: i === current ? '0' : '-1',
        }, `Sem ${i + 1}`, el('span', { class: 'tab-count' }, String(s.courses.length)));
        tab.addEventListener('click', () => select(i));
        tab.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + program.semesters.length) % program.semesters.length;
            select(next);
            tabs.children[next].focus();
          }
        });
        return tab;
      }),
      el('button', { type: 'button', class: 'program-tab add', 'aria-label': 'Add a semester to the program', onclick: addSemester }, icon('plus', 16), 'Semester'),
    );
  }

  function renderPanel() {
    const sem = program.semesters[current];
    const rows = el('div', { class: 'program-rows' });
    const total = el('span', { class: 'muted small' });
    const updateTotal = () => {
      total.textContent = `${sem.courses.length} course${sem.courses.length === 1 ? '' : 's'} · ${fmtCredits(programCredits(sem))} credit hours`;
      const count = tabs.children[current] && tabs.children[current].querySelector('.tab-count');
      if (count) count.textContent = String(sem.courses.length);
    };

    const row = (c) => {
      const name = el('input', { type: 'text', value: c.name, placeholder: 'Course name', 'aria-label': 'Course name' });
      const credits = el('input', { type: 'number', min: '0', step: '0.5', inputmode: 'decimal', value: c.credits, 'aria-label': 'Credit hours' });
      const node = el('div', { class: 'program-row' },
        name,
        el('div', { class: 'credits-input' }, credits, el('span', { 'aria-hidden': 'true' }, 'cr')),
        el('button', { type: 'button', class: 'icon-btn', 'aria-label': `Remove ${c.name || 'course'}`, onclick: () => {
          sem.courses.splice(sem.courses.indexOf(c), 1);
          node.remove();
          updateTotal();
          onChange();
          if (!sem.courses.length) rows.append(emptyNote());
        } }, icon('x', 18)),
      );
      name.addEventListener('input', () => { c.name = name.value; onChange(); });
      credits.addEventListener('input', () => { c.credits = credits.value; updateTotal(); onChange(); });
      return node;
    };
    const emptyNote = () => el('p', { class: 'program-empty muted small' }, 'No courses yet. Add the courses you take this semester.');

    if (sem.courses.length) sem.courses.forEach((c) => rows.append(row(c)));
    else rows.append(emptyNote());

    const add = el('button', { type: 'button', class: 'btn btn-ghost btn-small', onclick: () => {
      const c = { id: uid(), name: '', credits: '3' };
      sem.courses.push(c);
      const empty = rows.querySelector('.program-empty');
      if (empty) empty.remove();
      const r = row(c);
      rows.append(r);
      r.querySelector('input').focus();
      updateTotal();
      onChange();
    } }, icon('plus', 16), 'Add course');

    const remove = program.semesters.length > 1
      ? el('button', { type: 'button', class: 'btn btn-ghost btn-small danger-text', onclick: removeSemester }, icon('trash', 16), `Remove Sem ${current + 1}`)
      : null;

    updateTotal();
    panel.replaceChildren(
      el('div', { class: 'program-panel-head' }, el('strong', {}, `Semester ${current + 1}`), total),
      rows,
      el('div', { class: 'program-panel-foot' }, add, remove),
    );
  }

  function select(i) {
    current = i;
    renderTabs();
    renderPanel();
  }

  function addSemester() {
    program.semesters.push({ id: uid(), courses: [] });
    onChange();
    select(program.semesters.length - 1);
    panel.querySelector('.btn').focus();
  }

  async function removeSemester() {
    const sem = program.semesters[current];
    if (sem.courses.length && !(await confirmDialog({
      title: `Remove Semester ${current + 1} from your program?`,
      message: `Its ${sem.courses.length} course${sem.courses.length === 1 ? '' : 's'} will be removed from the program. Semesters you've already added keep their courses and marks.`,
      confirmText: 'Remove',
      danger: true,
    }))) return;
    program.semesters.splice(current, 1);
    onChange();
    select(Math.min(current, program.semesters.length - 1));
  }

  select(0);
  return root;
}
