import * as backend from './firebase.js';
import { store, loadFor, clear, onStatus, legacyData, forgetLegacyData, replaceData, flush, retrySave } from './store.js';
import { el, icon, avatar, toast, confirmDialog } from './ui.js';
import { renderAuth, setupNotice, logoMark } from './views/auth.js';
import { renderDashboard } from './views/dashboard.js';
import { renderSemesters } from './views/semesters.js';
import { renderPlanner } from './views/planner.js';
import { renderSettings } from './views/settings.js';
import { renderProgram } from './views/program.js';
import { renderSetup } from './views/setup.js';
import { applyTheme } from './theme.js';

const root = document.getElementById('app');

const ROUTES = {
  dashboard: { title: 'Dashboard', icon: 'dashboard', render: renderDashboard },
  semesters: { title: 'Semesters', icon: 'semesters', render: renderSemesters },
  planner: { title: 'Planner', icon: 'planner', render: renderPlanner },
  settings: { title: 'Settings', icon: 'settings', render: renderSettings },
  // Reached from Settings, so it isn't in the navigation and highlights Settings.
  program: { title: 'Program & courses', icon: 'book', render: renderProgram, parent: 'settings' },
};

let shell = null;
let cleanup = null;

applyTheme();

function currentRoute() {
  const name = location.hash.replace(/^#\/?/, '').split('/')[0];
  return ROUTES[name] ? name : 'dashboard';
}

export function navigate(name) {
  if (location.hash !== `#/${name}`) location.hash = `#/${name}`;
  else renderRoute();
}

function renderRoute() {
  if (!shell) return;
  const name = currentRoute();
  const route = ROUTES[name];
  if (cleanup) cleanup();
  cleanup = null;
  for (const a of shell.querySelectorAll('[data-route]')) {
    if (a.dataset.route === (route.parent || name)) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  shell.querySelector('#page-title').textContent = route.title;
  document.title = `${route.title} · GradePoint`;
  const content = shell.querySelector('#content');
  content.replaceChildren();
  cleanup = route.render(content, { navigate, refreshUser, runSetup: () => startSetup(true) }) || null;
  content.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', renderRoute);

function statusBadge() {
  const node = el('button', { type: 'button', class: 'save-status', 'aria-live': 'polite' });
  const labels = {
    saving: ['cloud', 'Saving…'],
    saved: ['check', 'Saved'],
    offline: ['cloudOff', 'Offline · will sync'],
    error: ['alert', "Couldn't save · retry"],
  };
  onStatus((s) => {
    const [ic, text] = labels[s];
    node.className = `save-status is-${s}`;
    node.replaceChildren(icon(ic, 16), el('span', {}, text));
    node.disabled = s !== 'error';
  });
  node.addEventListener('click', () => retrySave());
  return node;
}

function navLinks(cls) {
  return el('nav', { class: cls, 'aria-label': 'Main' },
    Object.entries(ROUTES).filter(([, r]) => !r.parent).map(([name, r]) =>
      el('a', { href: `#/${name}`, class: 'nav-link', dataset: { route: name } }, icon(r.icon), el('span', {}, r.title)),
    ),
  );
}

function userMenu() {
  const wrap = el('div', { class: 'user-menu' });
  const button = el('button', { type: 'button', class: 'user-button', 'aria-haspopup': 'menu', 'aria-expanded': 'false' });
  const menu = el('div', { class: 'menu', role: 'menu', hidden: true });
  const fill = () => {
    const u = store.user;
    button.replaceChildren(avatar(u, 32), el('span', { class: 'user-button-name' }, u.name || u.email));
    button.setAttribute('aria-label', `Account: ${u.name || u.email}`);
    menu.replaceChildren(
      el('div', { class: 'menu-head' }, el('strong', {}, u.name || 'Your account'), el('span', {}, u.email)),
      el('a', { href: '#/settings', role: 'menuitem', class: 'menu-item', onclick: () => toggle(false) }, icon('settings', 18), 'Settings'),
      el('button', { type: 'button', role: 'menuitem', class: 'menu-item', onclick: signOut }, icon('logout', 18), 'Sign out'),
    );
  };
  const toggle = (open) => {
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  };
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    toggle(menu.hidden);
  });
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) toggle(false);
  });
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      toggle(false);
      button.focus();
    }
  });
  wrap.refresh = fill;
  fill();
  wrap.append(button, menu);
  return wrap;
}

let menuNode = null;
window.addEventListener('gp:user', (e) => {
  if (store.user && store.user.uid === e.detail.uid) refreshUser(e.detail);
});
function refreshUser(user) {
  if (user) store.user = user;
  if (menuNode) menuNode.refresh();
}

async function signOut() {
  if (store.status === 'saving' || store.status === 'error') await flush();
  if (store.status === 'error' && !(await confirmDialog({ title: 'Sign out?', message: "Your latest changes haven't been saved yet. Sign out anyway?", confirmText: 'Sign out', danger: true }))) return;
  await backend.signOutUser();
}

function renderShell() {
  menuNode = userMenu();
  shell = el('div', { class: 'shell' },
    el('a', { href: '#content', class: 'skip-link' }, 'Skip to content'),
    el('aside', { class: 'sidebar' },
      el('a', { href: '#/dashboard', class: 'brand-mark' }, logoMark(32), el('span', {}, 'GradePoint')),
      navLinks('side-nav'),
      el('div', { class: 'sidebar-note' },
        el('strong', {}, icon('book', 16), 'Results out?'),
        el('span', {}, 'Add your marks right away so your CGPA and plan stay up to date.'),
      ),
    ),
    el('div', { class: 'main-col' },
      el('header', { class: 'topbar' },
        el('a', { href: '#/dashboard', class: 'brand-mark mobile-only', 'aria-label': 'GradePoint home' }, logoMark(30)),
        el('h1', { id: 'page-title', class: 'page-title' }),
        el('div', { class: 'topbar-right' }, statusBadge(), menuNode),
      ),
      el('main', { id: 'content', class: 'content', tabindex: '-1' }),
    ),
    navLinks('tab-bar'),
  );
  root.replaceChildren(shell);
  renderRoute();
}

function startSetup(rerun) {
  if (cleanup) cleanup();
  cleanup = null;
  shell = null;
  document.title = 'Set up · GradePoint';
  renderSetup(root, {
    rerun,
    onDone: ({ welcome, goTo } = {}) => {
      if (goTo) history.replaceState(null, '', `#/${goTo}`);
      renderShell();
      if (welcome) toast('You’re all set! Change anything later in Settings.', 'success');
      else toast('Setup saved', 'success');
    },
  });
}

function loadingScreen(text = 'Loading…') {
  root.replaceChildren(el('div', { class: 'loading-screen' }, logoMark(48), el('div', { class: 'spinner', 'aria-hidden': 'true' }), el('p', {}, text)));
}

async function offerLegacyImport(isNew) {
  const legacy = legacyData();
  if (!legacy) return;
  const sems = (legacy.semesters || []).length;
  const ok = await confirmDialog({
    title: 'Bring over your saved grades?',
    message: `This browser has ${sems} semester${sems === 1 ? '' : 's'} saved from the earlier version of the app. ${isNew ? 'Add them to your account?' : 'Replace the data in your account with them?'}`,
    confirmText: isNew ? 'Add to my account' : 'Replace',
    danger: !isNew,
  });
  if (ok) {
    replaceData(legacy);
    toast('Your saved grades are now in your account.', 'success');
    renderRoute();
  }
  forgetLegacyData();
}

async function start() {
  if (!backend.isConfigured) {
    setupNotice(root);
    return;
  }
  loadingScreen();
  try {
    await backend.onUserChanged(async (user) => {
      if (cleanup) cleanup();
      cleanup = null;
      shell = null;
      if (!user) {
        clear();
        renderAuth(root);
        return;
      }
      loadingScreen('Loading your grades…');
      try {
        const { isNew } = await loadFor(user);
        await offerLegacyImport(isNew);
        if (store.data.profile.setupDone) renderShell();
        else startSetup(false);
      } catch (e) {
        console.error(e);
        root.replaceChildren(el('div', { class: 'loading-screen' },
          logoMark(48),
          el('p', {}, `Couldn't load your data. ${backend.friendlyError(e)}`),
          el('button', { type: 'button', class: 'btn btn-primary', onclick: () => location.reload() }, 'Try again'),
          el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => backend.signOutUser() }, 'Sign out'),
        ));
      }
    });
  } catch (e) {
    console.error(e);
    root.replaceChildren(el('div', { class: 'loading-screen' },
      logoMark(48),
      el('p', {}, "Couldn't start the app. Check your connection and try again."),
      el('button', { type: 'button', class: 'btn btn-primary', onclick: () => location.reload() }, 'Reload'),
    ));
  }
}

start();
