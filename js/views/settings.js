import { store, changed, replaceData, flush, discardPending } from '../store.js';
import { DEFAULT_SCALE, scaleProblem, serialize } from '../calc.js';
import { el, icon, avatar, toast, openDialog, confirmDialog } from '../ui.js';
import { getTheme, setTheme } from '../theme.js';
import * as backend from '../firebase.js';

export function renderSettings(root, { refreshUser }) {
  root.append(
    el('div', { class: 'page-intro' }, el('h2', {}, 'Settings'), el('p', {}, 'Your profile, grading scale and data.')),
    profileSection(refreshUser),
    appearanceSection(),
    scaleSection(),
    dataSection(),
    accountSection(),
  );
}

function section(title, sub, ...children) {
  return el('section', { class: 'card settings-section' },
    el('div', { class: 'settings-head' }, el('h3', {}, title), sub ? el('p', { class: 'card-sub' }, sub) : null),
    ...children,
  );
}

function profileSection(refreshUser) {
  const u = store.user;
  const name = el('input', { type: 'text', value: u.name, autocomplete: 'name', placeholder: 'Your name' });
  const save = el('button', { type: 'submit', class: 'btn btn-primary btn-small', disabled: true }, 'Save');
  name.addEventListener('input', () => {
    save.disabled = !name.value.trim() || name.value.trim() === store.user.name;
  });
  const form = el('form', { class: 'inline-form' }, el('label', { class: 'field grow' }, el('span', {}, 'Name'), name), save);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    save.disabled = true;
    try {
      refreshUser(await backend.updateName(name.value.trim()));
      toast('Name updated', 'success');
    } catch (err) {
      toast(backend.friendlyError(err), 'error');
      save.disabled = false;
    }
  });
  return section('Profile', null,
    el('div', { class: 'profile-row' },
      avatar(u, 56),
      el('div', {},
        el('strong', {}, u.name || 'No name yet'),
        el('div', { class: 'muted' }, u.email),
        el('div', { class: 'muted small' }, u.provider === 'google.com' ? 'Signed in with Google' : 'Signed in with email'),
      ),
    ),
    form,
  );
}

function appearanceSection() {
  const current = getTheme();
  const group = el('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Theme' });
  for (const [value, label, ic] of [['system', 'System', 'monitor'], ['light', 'Light', 'sun'], ['dark', 'Dark', 'moon']]) {
    const b = el('button', { type: 'button', role: 'radio', 'aria-checked': String(value === current) }, icon(ic, 16), label);
    b.addEventListener('click', () => {
      setTheme(value);
      for (const x of group.children) x.setAttribute('aria-checked', String(x === b));
    });
    group.append(b);
  }
  return section('Appearance', 'Saved on this device.', group);
}

function scaleSection() {
  const data = store.data;
  const body = el('div', { class: 'scale-rows' });
  const problem = el('p', { class: 'row-error' });

  function render() {
    body.replaceChildren(el('div', { class: 'scale-row scale-head', 'aria-hidden': 'true' },
      el('span', {}, 'Min marks'), el('span', {}, 'Grade'), el('span', {}, 'Points'), el('span', {}),
    ));
    data.scale.forEach((g, i) => {
      const row = el('div', { class: 'scale-row', dataset: { index: String(i) } },
        el('input', { type: 'number', min: '0', max: '100', step: 'any', value: Number.isFinite(g.min) ? g.min : '', 'aria-label': 'Minimum marks', dataset: { field: 'min' } }),
        el('input', { type: 'text', value: g.grade, 'aria-label': 'Grade', dataset: { field: 'grade' } }),
        el('input', { type: 'number', min: '0', step: '0.01', value: Number.isFinite(g.gp) ? g.gp : '', 'aria-label': 'Grade points', dataset: { field: 'gp' } }),
        el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Remove grade', dataset: { action: 'remove' }, disabled: data.scale.length <= 1 }, icon('x', 18)),
      );
      body.append(row);
    });
    problem.textContent = scaleProblem(data);
  }

  body.addEventListener('input', (e) => {
    const row = e.target.closest('[data-index]');
    if (!row) return;
    const g = data.scale[Number(row.dataset.index)];
    const f = e.target.dataset.field;
    g[f] = f === 'grade' ? e.target.value : e.target.value === '' ? NaN : Number(e.target.value);
    problem.textContent = scaleProblem(data);
    changed();
  });
  body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action="remove"]');
    if (!b) return;
    data.scale.splice(Number(b.closest('[data-index]').dataset.index), 1);
    changed();
    render();
  });

  render();
  return section('Grading scale', 'Marks at or above the minimum get that grade. Match it to your university.',
    body, problem,
    el('div', { class: 'btn-row' },
      el('button', { type: 'button', class: 'btn btn-ghost btn-small', onclick: () => {
        data.scale.push({ min: NaN, grade: '', gp: NaN });
        changed();
        render();
        body.querySelector('.scale-row:last-child input').focus();
      } }, icon('plus', 16), 'Add grade'),
      el('button', { type: 'button', class: 'btn btn-ghost btn-small', onclick: async () => {
        if (!(await confirmDialog({ title: 'Reset grading scale?', message: 'Your scale goes back to the default (A 80+, B+ 70+, B 60+, C+ 55+, C 50+, F below 50).', confirmText: 'Reset' }))) return;
        data.scale = DEFAULT_SCALE.map((g) => ({ ...g }));
        changed();
        render();
      } }, 'Reset to default'),
    ),
  );
}

function dataSection() {
  const file = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  file.addEventListener('change', async () => {
    const f = file.files[0];
    file.value = '';
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text());
      const data = parsed && parsed.data && Array.isArray(parsed.data.semesters) ? parsed.data : parsed;
      if (!data || !Array.isArray(data.semesters)) throw new Error('not a backup');
      if (!(await confirmDialog({ title: 'Restore this backup?', message: `It has ${data.semesters.length} semester(s). Your current data in this account will be replaced.`, confirmText: 'Restore', danger: true }))) return;
      replaceData(data);
      toast('Backup restored', 'success');
      location.hash = '#/dashboard';
    } catch (e) {
      toast("That file isn't a GradePoint backup.", 'error');
    }
  });
  return section('Your data', 'Download a copy of everything, or restore one.',
    el('div', { class: 'btn-row' },
      el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => {
        const blob = new Blob([JSON.stringify({ app: 'GradePoint', exported: new Date().toISOString(), data: serialize(store.data) }, null, 2)], { type: 'application/json' });
        const a = el('a', { href: URL.createObjectURL(blob), download: `gradepoint-backup-${new Date().toISOString().slice(0, 10)}.json` });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      } }, icon('download', 18), 'Download backup'),
      el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => file.click() }, icon('upload', 18), 'Restore backup'),
      file,
    ),
  );
}

function accountSection() {
  return section('Account', null,
    el('div', { class: 'account-rows' },
      el('div', { class: 'account-row' },
        el('div', {}, el('strong', {}, 'Sign out'), el('p', { class: 'muted small' }, 'Your data stays saved in your account.')),
        el('button', { type: 'button', class: 'btn btn-ghost', onclick: async () => {
          await flush();
          await backend.signOutUser();
        } }, icon('logout', 18), 'Sign out'),
      ),
      el('div', { class: 'account-row' },
        el('div', {}, el('strong', {}, 'Delete account'), el('p', { class: 'muted small' }, 'Permanently deletes your account and all your grades.')),
        el('button', { type: 'button', class: 'btn btn-danger-outline', onclick: deleteFlow }, icon('trash', 18), 'Delete account'),
      ),
    ),
  );
}

function deleteFlow() {
  const google = store.user.provider === 'google.com';
  openDialog({
    title: 'Delete your account?',
    build: (close) => {
      const error = el('p', { class: 'form-error', role: 'alert' });
      const confirmBox = el('input', { type: 'text', autocomplete: 'off', placeholder: 'DELETE' });
      const password = google ? null : el('input', { type: 'password', autocomplete: 'current-password' });
      const go = el('button', { type: 'submit', class: 'btn btn-danger', disabled: true }, 'Delete forever');
      const check = () => {
        go.disabled = confirmBox.value.trim() !== 'DELETE' || (password && !password.value);
      };
      confirmBox.addEventListener('input', check);
      if (password) password.addEventListener('input', check);
      const form = el('form', {},
        el('p', { class: 'dialog-text' }, 'All your semesters and settings will be erased and can’t be recovered. Consider downloading a backup first.'),
        el('label', { class: 'field' }, el('span', {}, 'Type DELETE to confirm'), confirmBox),
        password ? el('label', { class: 'field' }, el('span', {}, 'Your password'), password) : el('p', { class: 'muted small' }, 'Google will ask you to confirm it’s you.'),
        error,
        el('div', { class: 'dialog-actions' },
          el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => close() }, 'Cancel'),
          go,
        ),
      );
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        go.disabled = true;
        error.textContent = '';
        try {
          discardPending();
          await backend.deleteAccount(password && password.value);
          close();
          toast('Your account has been deleted.', 'success');
        } catch (err) {
          changed(); // the account is still here, so save anything discarded above
          error.textContent = backend.friendlyError(err);
          check();
        }
      });
      return form;
    },
  });
}
