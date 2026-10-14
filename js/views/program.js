// Program & courses: edit the course list used to fill in new semesters.
import { store, changed } from '../store.js';
import { defaultProgram, programCredits, fmtCredits } from '../calc.js';
import { el, icon, confirmDialog, toast } from '../ui.js';
import { programEditor } from './program-editor.js';
import { startSharing, stopSharing, programChanged, codeLookup, useSharedProgram, joinLink, pendingJoin, clearPendingJoin } from '../sharing.js';
import * as backend from '../firebase.js';

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
        programChanged();
      },
    }));
    updateSummary();
  };

  const shareCard = el('section', { class: 'card share-card' });
  const renderShare = () => {
    const code = store.data.program.shareCode;
    if (!code) {
      const start = el('button', { type: 'button', class: 'btn btn-primary' }, icon('share', 18), 'Create a share code');
      start.addEventListener('click', async () => {
        start.disabled = true;
        try {
          await startSharing();
          renderShare();
          toast('Share code created', 'success');
        } catch (e) {
          toast(e.message && !e.code ? e.message : backend.friendlyError(e), 'error');
          start.disabled = false;
        }
      });
      shareCard.replaceChildren(
        el('div', { class: 'card-head' }, el('div', {}, el('h3', {}, 'Share with friends'),
          el('p', { class: 'card-sub' }, 'Friends at your university can copy this course list with a short code instead of typing it in. Only course names and credit hours are shared, never your marks.'))),
        start,
      );
      return;
    }
    const link = joinLink(code);
    const copy = (text, what) => async () => {
      try {
        await navigator.clipboard.writeText(text);
        toast(`${what} copied`, 'success');
      } catch (e) {
        toast(`Couldn’t copy. Select the ${what.toLowerCase()} and copy it yourself.`, 'error');
      }
    };
    shareCard.replaceChildren(
      el('div', { class: 'card-head' }, el('div', {}, el('h3', {}, 'Share with friends'),
        el('p', { class: 'card-sub' }, 'Send your friends this code or link. Changes you make to your courses are shared automatically; friends who already copied it keep their own copy.'))),
      el('div', { class: 'share-code', 'aria-label': `Share code ${code.split('').join(' ')}` }, code),
      el('div', { class: 'btn-row' },
        el('button', { type: 'button', class: 'btn btn-primary btn-small', onclick: copy(code, 'Code') }, 'Copy code'),
        el('button', { type: 'button', class: 'btn btn-ghost btn-small', onclick: copy(link, 'Link') }, 'Copy link'),
        navigator.share ? el('button', { type: 'button', class: 'btn btn-ghost btn-small', onclick: () => navigator.share({ title: 'GradePoint', text: `Copy my ${store.data.program.name} courses on GradePoint with code ${code}`, url: link }).catch(() => {}) }, icon('share', 16), 'Share') : null,
        el('button', { type: 'button', class: 'btn btn-ghost btn-small danger-text', onclick: async () => {
          if (!(await confirmDialog({ title: 'Stop sharing?', message: `The code ${code} will stop working. Friends who already copied your courses keep their copy.`, confirmText: 'Stop sharing', danger: true }))) return;
          try {
            await stopSharing();
            renderShare();
            toast('Sharing stopped');
          } catch (e) {
            toast(backend.friendlyError(e), 'error');
          }
        } }, 'Stop sharing'),
      ),
    );
  };

  const lookup = codeLookup({
    useLabel: 'Use these courses',
    onUse: async (code, shared) => {
      if (!(await confirmDialog({
        title: `Use ${shared.name}${shared.university ? ` · ${shared.university}` : ''}?`,
        message: 'Your program’s courses will be replaced with this one. Semesters you’ve already added keep their courses and marks.',
        confirmText: 'Use these courses',
      }))) return;
      useSharedProgram(store.data, code, shared);
      changed();
      programChanged();
      mount();
      lookup.querySelector('.code-preview').replaceChildren();
      holder.scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast(`Now using ${shared.name}`, 'success');
    },
  });
  const copyCard = el('section', { class: 'card' },
    el('div', { class: 'card-head' }, el('div', {}, el('h3', {}, 'Copy a friend’s program'),
      el('p', { class: 'card-sub' }, 'Got a code from a friend? Enter it to use their course list.'))),
    lookup,
  );

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
        const shareCode = store.data.program.shareCode;
        store.data.program = defaultProgram();
        if (shareCode) store.data.program.shareCode = shareCode;
        changed();
        programChanged();
        mount();
        toast('Program reset to the default', 'success');
      } }, 'Reset to default'),
    ),
    el('div', { class: 'notice' }, icon('book', 18),
      el('span', {}, 'Changes apply to semesters you add from now on. To change a semester you’ve already added, edit its courses on the ', el('a', { href: '#/semesters' }, 'Semesters'), ' page.')),
    holder,
    shareCard,
    copyCard,
  );
  mount();
  renderShare();
  if (location.hash.endsWith('/share')) {
    history.replaceState(null, '', '#/program');
    shareCard.scrollIntoView({ block: 'center' });
  }

  const pending = pendingJoin();
  if (pending) {
    clearPendingJoin();
    lookup.querySelector('input').value = pending;
    copyCard.scrollIntoView({ block: 'center' });
    lookup.search();
  }
}
