import { store, changed, replaceData, flush, discardPending } from '../store.js';
import { serialize, programCredits, fmtCredits } from '../calc.js';
import { scaleEditor } from './scale-editor.js';
import { el, icon, avatar, toast, openDialog, confirmDialog } from '../ui.js';
import { getTheme, setTheme } from '../theme.js';
import * as backend from '../firebase.js';

export function renderSettings(root, { refreshUser, runSetup }) {
  root.append(
    el('div', { class: 'page-intro' }, el('h2', {}, 'Settings'), el('p', {}, 'Your profile, grading scale and data.')),
    profileSection(refreshUser),
    programSection(runSetup),
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

function programSection(runSetup) {
  const { program, profile } = store.data;
  const credits = program.semesters.reduce((sum, s) => sum + programCredits(s), 0);
  return section('Program & courses', 'Your degree’s courses, used to fill in new semesters.',
    el('div', { class: 'program-summary' },
      el('span', { class: 'option-icon' }, icon('book', 22)),
      el('div', {},
        el('strong', {}, [program.name || 'Your program', profile.university].filter(Boolean).join(' · ')),
        el('div', { class: 'muted small' }, `${program.semesters.length} semesters · ${fmtCredits(credits)} credit hours · currently in Semester ${profile.currentSemester}`),
      ),
    ),
    el('div', { class: 'btn-row' },
      el('a', { href: '#/program', class: 'btn btn-primary btn-small' }, 'Edit courses'),
      el('button', { type: 'button', class: 'btn btn-ghost btn-small', onclick: runSetup }, 'Run setup again'),
    ),
  );
}

function appearanceSection() {
  const current = getTheme();
  const group = el('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Theme' });
  for (const [value, label, ic] of [['light', 'Light', 'sun'], ['dark', 'Dark', 'moon'], ['system', 'Match device', 'monitor']]) {
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
  return section('Grading scale', 'Marks at or above the minimum get that grade. Match it to your university.',
    scaleEditor(store.data, { onChange: changed }),
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
