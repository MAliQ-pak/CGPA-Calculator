// Program & courses: edit the course list used to fill in new semesters.
import { store, changed } from '../store.js';
import { defaultProgram, programCredits, fmtCredits } from '../calc.js';
import { el, icon, confirmDialog, toast } from '../ui.js';
import { programEditor } from './program-editor.js';

export function renderProgram(root) {
  const holder = el('section', { class: 'card' });
  const summary = el('p', { class: 'muted' });

  const updateSummary = () => {
    const p = store.data.program;
    const credits = p.semesters.reduce((sum, s) => sum + programCredits(s), 0);
    summary.textContent = `${p.semesters.length} semester${p.semesters.length === 1 ? '' : 's'} · ${fmtCredits(credits)} credit hours in total`;
  };

  const mount = () => {
    holder.replaceChildren(programEditor(store.data.program, {
      onChange: () => {
        changed();
        updateSummary();
      },
    }));
    updateSummary();
  };

  root.append(
    el('a', { href: '#/settings', class: 'back-link' }, el('span', { class: 'flip' }, icon('chevron', 16)), 'Settings'),
    el('div', { class: 'page-intro row' },
      el('div', {},
        el('h2', {}, 'Program & courses'),
        el('p', {}, 'The courses for each semester of your degree. When you add a semester, its courses are filled in from here.'),
        summary,
      ),
      el('button', { type: 'button', class: 'btn btn-ghost', onclick: async () => {
        if (!(await confirmDialog({
          title: 'Reset to the default program?',
          message: 'Your program goes back to BSCS with its default courses. Semesters you’ve already added keep their courses and marks.',
          confirmText: 'Reset',
          danger: true,
        }))) return;
        store.data.program = defaultProgram();
        changed();
        mount();
        toast('Program reset to the default', 'success');
      } }, 'Reset to default'),
    ),
    el('div', { class: 'notice' }, icon('book', 18),
      el('span', {}, 'Changes apply to semesters you add from now on. To change a semester you’ve already added, edit its courses on the ', el('a', { href: '#/semesters' }, 'Semesters'), ' page.')),
    holder,
  );
  mount();
}
