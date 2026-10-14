// Sharing a program with friends through a short code, and copying a friend's program.
import * as backend from './firebase.js';
import { store, changed } from './store.js';
import { newShareCode, cleanShareCode, sharedProgramPayload, programFromShared, programCredits, fmtCredits } from './calc.js';
import { el, icon, toast } from './ui.js';

const PENDING_KEY = 'gradepoint:join';
const PUBLISH_DELAY = 1500;
let timer = null;

const payload = () => sharedProgramPayload(store.data, store.user && store.user.name);

export async function startSharing() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newShareCode();
    if (await backend.getSharedProgram(code)) continue; // taken; try another
    await backend.publishProgram(code, payload());
    store.data.program.shareCode = code;
    changed();
    return code;
  }
  throw new Error('Couldn’t create a code. Please try again.');
}

export async function stopSharing() {
  const code = store.data.program.shareCode;
  clearTimeout(timer);
  if (code) await backend.unpublishProgram(code);
  delete store.data.program.shareCode;
  changed();
}

// Call after the program changes; friends who use the code later get the latest version.
export function programChanged() {
  if (!store.data.program.shareCode) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      await backend.publishProgram(store.data.program.shareCode, payload());
    } catch (e) {
      console.error('Updating the shared program failed', e);
      toast('Couldn’t update your shared program. Changes will be shared next time you edit.', 'error');
    }
  }, PUBLISH_DELAY);
}

// Resolves to { code, shared } or throws an Error with a message fit to show.
export async function lookUp(input) {
  const code = cleanShareCode(input);
  if (!code) throw new Error('Codes are 6 letters and numbers, like K7P2QX.');
  const shared = await backend.getSharedProgram(code).catch((e) => {
    throw new Error(backend.friendlyError(e));
  });
  if (!shared) throw new Error(`No program uses the code ${code}. Check it with your friend.`);
  return { code, shared };
}

export function useSharedProgram(target, code, shared) {
  const keep = target.program && target.program.shareCode;
  target.program = programFromShared(shared, code);
  if (keep) target.program.shareCode = keep;
}

export function joinLink(code) {
  return `${location.origin}${location.pathname}#/join/${code}`;
}

// A join link opened before signing in is remembered until the user is in.
export function rememberPendingJoin(code) {
  try { sessionStorage.setItem(PENDING_KEY, code); } catch (e) { /* storage blocked */ }
}
export function pendingJoin() {
  try { return sessionStorage.getItem(PENDING_KEY) || ''; } catch (e) { return ''; }
}
export function clearPendingJoin() {
  try { sessionStorage.removeItem(PENDING_KEY); } catch (e) { /* storage blocked */ }
}

// Code box with a preview of the friend's program and a button to use it.
export function codeLookup({ initial = '', useLabel = 'Use this program', onUse }) {
  const input = el('input', { type: 'text', value: initial, placeholder: 'e.g. K7P2QX', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', 'aria-label': 'Program code', maxlength: '80' });
  const find = el('button', { type: 'submit', class: 'btn btn-ghost' }, 'Find');
  const error = el('p', { class: 'form-error', role: 'alert' });
  const preview = el('div', { class: 'code-preview', 'aria-live': 'polite' });
  const form = el('form', { class: 'code-form' }, input, find);

  async function search() {
    error.textContent = '';
    preview.replaceChildren();
    find.disabled = true;
    try {
      const { code, shared } = await lookUp(input.value);
      input.value = code;
      const sems = Array.isArray(shared.semesters) ? shared.semesters : [];
      const credits = sems.reduce((sum, s) => sum + programCredits({ courses: s.courses || [] }), 0);
      const courses = sems.reduce((sum, s) => sum + (s.courses || []).length, 0);
      preview.append(el('div', { class: 'program-summary found' },
        el('span', { class: 'option-icon' }, icon('book', 22)),
        el('div', {},
          el('strong', {}, [shared.name, shared.university].filter(Boolean).join(' · ')),
          el('div', { class: 'muted small' }, `${sems.length} semesters · ${courses} courses · ${fmtCredits(credits)} credit hours${shared.ownerName ? ` · shared by ${shared.ownerName}` : ''}`),
        ),
        el('button', { type: 'button', class: 'btn btn-primary btn-small', onclick: () => onUse(code, shared) }, useLabel),
      ));
    } catch (e) {
      error.textContent = e.message;
    }
    find.disabled = false;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    search();
  });
  const node = el('div', { class: 'code-lookup' }, form, error, preview);
  node.search = search;
  return node;
}
