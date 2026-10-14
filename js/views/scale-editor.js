// Editor for a grading scale (min marks → grade → grade points). Works on `holder.scale`
// so callers can pass the live data or a draft. Used by Settings and the setup wizard.
import { DEFAULT_SCALE, scaleProblem } from '../calc.js';
import { el, icon, confirmDialog } from '../ui.js';

export function scaleEditor(holder, { onChange }) {
  const body = el('div', { class: 'scale-rows' });
  const problem = el('p', { class: 'row-error' });

  function render() {
    body.replaceChildren(el('div', { class: 'scale-row scale-head', 'aria-hidden': 'true' },
      el('span', {}, 'Min marks'), el('span', {}, 'Grade'), el('span', {}, 'Points'), el('span', {}),
    ));
    holder.scale.forEach((g, i) => {
      body.append(el('div', { class: 'scale-row', dataset: { index: String(i) } },
        el('input', { type: 'number', min: '0', max: '100', step: 'any', value: Number.isFinite(g.min) ? g.min : '', 'aria-label': 'Minimum marks', dataset: { field: 'min' } }),
        el('input', { type: 'text', value: g.grade, 'aria-label': 'Grade', dataset: { field: 'grade' } }),
        el('input', { type: 'number', min: '0', step: '0.01', value: Number.isFinite(g.gp) ? g.gp : '', 'aria-label': 'Grade points', dataset: { field: 'gp' } }),
        el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Remove grade', dataset: { action: 'remove' }, disabled: holder.scale.length <= 1 }, icon('x', 18)),
      ));
    });
    problem.textContent = scaleProblem(holder);
  }

  body.addEventListener('input', (e) => {
    const row = e.target.closest('[data-index]');
    if (!row) return;
    const g = holder.scale[Number(row.dataset.index)];
    const f = e.target.dataset.field;
    g[f] = f === 'grade' ? e.target.value : e.target.value === '' ? NaN : Number(e.target.value);
    problem.textContent = scaleProblem(holder);
    onChange();
  });
  body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action="remove"]');
    if (!b) return;
    holder.scale.splice(Number(b.closest('[data-index]').dataset.index), 1);
    onChange();
    render();
  });

  render();
  return el('div', { class: 'scale-editor' },
    body,
    problem,
    el('div', { class: 'btn-row' },
      el('button', { type: 'button', class: 'btn btn-ghost btn-small', onclick: () => {
        holder.scale.push({ min: NaN, grade: '', gp: NaN });
        onChange();
        render();
        body.querySelector('.scale-row:last-child input').focus();
      } }, icon('plus', 16), 'Add grade'),
      el('button', { type: 'button', class: 'btn btn-ghost btn-small', onclick: async () => {
        if (!(await confirmDialog({ title: 'Reset grading scale?', message: 'The scale goes back to the default (A 80+, B+ 70+, B 60+, C+ 55+, C 50+, F below 50).', confirmText: 'Reset' }))) return;
        holder.scale = DEFAULT_SCALE.map((g) => ({ ...g }));
        onChange();
        render();
      } }, 'Reset to default'),
    ),
  );
}
