// Test stand-in for js/firebase.js: same exports, data kept in localStorage.
export const isConfigured = true;
const K = 'mock:';
const get = (k, d) => JSON.parse(localStorage.getItem(K + k) || JSON.stringify(d));
const set = (k, v) => localStorage.setItem(K + k, JSON.stringify(v));
let cb = null;
const emit = () => cb && cb(get('current', null));
export async function onUserChanged(fn) { cb = fn; setTimeout(emit, 50); }
export async function signInWithGoogle() { const u = { uid: 'g1', name: 'Ali Raza', email: 'ali@gmail.com', photo: '', provider: 'google.com' }; set('current', u); emit(); }
export async function signInWithEmail(email, pw) {
  const users = get('users', {}); const u = users[email];
  if (!u || u.pw !== pw) { const e = new Error('x'); e.code = 'auth/invalid-credential'; throw e; }
  set('current', u.user); emit();
}
export async function signUpWithEmail(name, email, pw) {
  const users = get('users', {});
  if (users[email]) { const e = new Error('x'); e.code = 'auth/email-already-in-use'; throw e; }
  const user = { uid: 'u' + Object.keys(users).length, name: '', email, photo: '', provider: 'password' };
  users[email] = { pw, user }; set('users', users); set('current', user); emit();
  user.name = name; users[email].user = user; set('users', users); set('current', user);
  window.dispatchEvent(new CustomEvent('gp:user', { detail: user }));
  return user;
}
export async function resetPassword() {}
export async function updateName(name) { const u = get('current'); u.name = name; set('current', u); return u; }
export async function signOutUser() { localStorage.removeItem(K + 'current'); emit(); }
export async function loadData(uid) { await new Promise(r => setTimeout(r, 100)); return get('data:' + uid, null); }
export async function saveData(uid, data) { window.__saves = (window.__saves || 0) + 1; await new Promise(r => setTimeout(r, 150)); set('data:' + uid, data); }
// Shared programs, with the same ownership rules as firestore.rules.
const denied = () => { const e = new Error('x'); e.code = 'permission-denied'; return e; };
export async function getSharedProgram(code) { return get('programs:' + code, null); }
export async function publishProgram(code, payload) {
  const u = get('current'); const existing = get('programs:' + code, null);
  if (!u || (existing && existing.createdBy !== u.uid)) throw denied();
  set('programs:' + code, { ...payload, createdBy: u.uid });
}
export async function unpublishProgram(code) {
  const u = get('current'); const existing = get('programs:' + code, null);
  if (existing && existing.createdBy !== u.uid) throw denied();
  localStorage.removeItem(K + 'programs:' + code);
}
export async function deleteAccount(pw, sharedCode) { const u = get('current'); const users = get('users', {}); if (u.provider === 'password' && users[u.email].pw !== pw) { const e = new Error('x'); e.code = 'auth/wrong-password'; throw e; } if (sharedCode) localStorage.removeItem(K + 'programs:' + sharedCode); localStorage.removeItem(K + 'data:' + u.uid); delete users[u.email]; set('users', users); localStorage.removeItem(K + 'current'); emit(); }
export function friendlyError(e) { return ({ 'auth/invalid-credential': 'Wrong email or password.', 'auth/wrong-password': 'Wrong password.', 'auth/email-already-in-use': 'An account already uses that email. Sign in instead.' })[e.code] || 'Something went wrong.'; }
