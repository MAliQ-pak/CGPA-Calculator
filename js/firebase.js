// The only module that talks to Firebase. Everything else goes through these functions.
import { firebaseConfig } from '../firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/12.19.0';

export const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let auth;
let db;
let A; // firebase/auth module
let F; // firebase/firestore module

async function init() {
  if (auth) return;
  const [{ initializeApp }, authMod, fsMod] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);
  A = authMod;
  F = fsMod;
  const app = initializeApp(firebaseConfig);
  auth = A.getAuth(app);
  try {
    // Keeps data available offline and syncs it when the connection is back.
    db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
  } catch (e) {
    db = F.getFirestore(app);
  }
}

function toUser(u) {
  if (!u) return null;
  return {
    uid: u.uid,
    name: u.displayName || '',
    email: u.email || '',
    photo: u.photoURL || '',
    provider: (u.providerData[0] && u.providerData[0].providerId) || 'password',
  };
}

export async function onUserChanged(cb) {
  await init();
  A.onAuthStateChanged(auth, (u) => cb(toUser(u)));
}

export async function signInWithGoogle() {
  await init();
  const provider = new A.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await A.signInWithPopup(auth, provider);
  } catch (e) {
    if (e.code === 'auth/popup-blocked') return A.signInWithRedirect(auth, provider);
    throw e;
  }
}

export async function signInWithEmail(email, password) {
  await init();
  await A.signInWithEmailAndPassword(auth, email, password);
}

export async function signUpWithEmail(name, email, password) {
  await init();
  const cred = await A.createUserWithEmailAndPassword(auth, email, password);
  if (name) {
    await A.updateProfile(cred.user, { displayName: name });
    // The sign-in event fired before the name was set; tell the app about it.
    window.dispatchEvent(new CustomEvent('gp:user', { detail: toUser(cred.user) }));
  }
  return toUser(cred.user);
}

export async function resetPassword(email) {
  await init();
  await A.sendPasswordResetEmail(auth, email);
}

export async function updateName(name) {
  await A.updateProfile(auth.currentUser, { displayName: name });
  return toUser(auth.currentUser);
}

export async function signOutUser() {
  await A.signOut(auth);
}

// Returns the saved data, or null for a brand-new user.
export async function loadData(uid) {
  const snap = await F.getDoc(F.doc(db, 'users', uid));
  return snap.exists() ? snap.data().data || null : null;
}

export async function saveData(uid, data) {
  await F.setDoc(F.doc(db, 'users', uid), { version: 1, data, updatedAt: F.serverTimestamp() });
}

// ---------- shared programs (programs/{code}) ----------

export async function getSharedProgram(code) {
  const snap = await F.getDoc(F.doc(db, 'programs', code));
  return snap.exists() ? snap.data() : null;
}

export async function publishProgram(code, payload) {
  await F.setDoc(F.doc(db, 'programs', code), { ...payload, createdBy: auth.currentUser.uid, updatedAt: F.serverTimestamp() });
}

export async function unpublishProgram(code) {
  await F.deleteDoc(F.doc(db, 'programs', code));
}

// Deletes the user's data and account. Firebase asks for a recent sign-in first,
// so we re-authenticate (Google popup, or the password the user just typed).
export async function deleteAccount(password, sharedCode) {
  const user = auth.currentUser;
  const provider = user.providerData[0] && user.providerData[0].providerId;
  if (provider === 'google.com') {
    await A.reauthenticateWithPopup(user, new A.GoogleAuthProvider());
  } else {
    await A.reauthenticateWithCredential(user, A.EmailAuthProvider.credential(user.email, password));
  }
  if (sharedCode) await F.deleteDoc(F.doc(db, 'programs', sharedCode)).catch(() => {});
  await F.deleteDoc(F.doc(db, 'users', user.uid));
  await A.deleteUser(user);
}

const MESSAGES = {
  'auth/invalid-email': "That email address doesn't look right.",
  'auth/missing-email': 'Enter your email address.',
  'auth/missing-password': 'Enter your password.',
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong password.',
  'auth/user-not-found': 'No account uses that email. Create one instead.',
  'auth/email-already-in-use': 'An account already uses that email. Sign in instead.',
  'auth/weak-password': 'Use a password of at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': "Couldn't reach the server. Check your connection.",
  'auth/popup-closed-by-user': 'Sign-in window closed before finishing.',
  'auth/cancelled-popup-request': 'Sign-in window closed before finishing.',
  'auth/unauthorized-domain': "This site isn't allowed to sign in yet. Add it under Authentication → Settings → Authorized domains.",
  'auth/operation-not-allowed': "This sign-in method isn't turned on in Firebase yet.",
  'auth/user-disabled': 'This account has been disabled.',
  'permission-denied': "The database refused the request. Check that firestore.rules is published.",
  unavailable: "You're offline. Changes are kept and will sync when you reconnect.",
};

export function friendlyError(e) {
  return (e && MESSAGES[e.code]) || (e && e.message) || 'Something went wrong. Please try again.';
}
