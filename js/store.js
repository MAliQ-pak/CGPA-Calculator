// Holds the signed-in user's data and saves changes to the database shortly after they happen.
import { freshData, normalize, serialize } from './calc.js';
import * as backend from './firebase.js';

const SAVE_DELAY = 700;
export const LEGACY_KEY = 'cgpa-calculator:v1'; // where the first web version kept data

export const store = {
  user: null,
  data: freshData(),
  status: 'saved', // 'saving' | 'saved' | 'offline' | 'error'
};

const listeners = { status: new Set(), change: new Set() };
let timer = null;
let pending = 0;
let dirty = false;

// Called after every change to the data (used for achievements).
export function onChange(fn) {
  listeners.change.add(fn);
}

export function onStatus(fn) {
  listeners.status.add(fn);
  fn(store.status);
}

function setStatus(s) {
  store.status = s;
  for (const fn of listeners.status) fn(s);
}

export async function loadFor(user) {
  store.user = user;
  const saved = await backend.loadData(user.uid);
  store.data = saved ? normalize(saved) : freshData();
  setStatus(navigator.onLine ? 'saved' : 'offline');
  return { isNew: !saved };
}

// Drop unsaved edits (used right before the account and its data are deleted).
export function discardPending() {
  clearTimeout(timer);
  dirty = false;
}

export function clear() {
  clearTimeout(timer);
  store.user = null;
  store.data = freshData();
  dirty = false;
}

// Call after changing store.data.
export function changed() {
  dirty = true;
  setStatus(navigator.onLine ? 'saving' : 'offline');
  clearTimeout(timer);
  timer = setTimeout(flush, SAVE_DELAY);
  for (const fn of listeners.change) fn();
}

// Files from before accounts had a setup, program or achievements keep the user's current ones.
export function replaceData(data) {
  const next = normalize(data);
  if (!data.profile) next.profile = store.data.profile;
  if (!data.program) next.program = store.data.program;
  if (!data.gamify) next.gamify = store.data.gamify;
  store.data = next;
  changed();
}

// Firestore applies one device's writes in order and keeps them on the device while
// offline, so each flush can write straight away without waiting for the last one.
export function flush() {
  clearTimeout(timer);
  if (!dirty || !store.user) return Promise.resolve();
  dirty = false;
  pending += 1;
  if (!navigator.onLine) setStatus('offline');
  return backend
    .saveData(store.user.uid, serialize(store.data))
    .then(() => {
      pending -= 1;
      if (!pending && !dirty) setStatus('saved');
    })
    .catch((e) => {
      pending -= 1;
      dirty = true;
      setStatus('error');
      console.error('Save failed', e);
    });
}

export function retrySave() {
  dirty = true;
  setStatus('saving');
  return flush();
}

window.addEventListener('online', () => {
  if (store.user) {
    setStatus(dirty || pending ? 'saving' : 'saved');
    if (dirty) flush();
  }
});
window.addEventListener('offline', () => {
  if (store.user) setStatus('offline');
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush();
});

// ---------- data left by the first (sign-in free) version ----------

export function legacyData() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    const data = normalize(saved);
    // Return the raw object so replaceData keeps the account's own setup and program.
    return data.semesters.length || data.prior.cgpa ? saved : null;
  } catch (e) {
    return null;
  }
}

export function forgetLegacyData() {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch (e) {
    // Storage blocked: nothing to remove.
  }
}
