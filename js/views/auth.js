// Sign-in / create-account screen.
import { el, icon, GOOGLE_LOGO } from '../ui.js';
import * as backend from '../firebase.js';

export function renderAuth(root) {
  let mode = 'signin'; // 'signin' | 'signup' | 'reset'
  const card = el('div', { class: 'auth-card' });

  const brand = el('aside', { class: 'auth-brand' },
    el('div', { class: 'brand-mark' }, logoMark(40), el('span', {}, 'GradePoint')),
    el('h1', {}, 'Your CGPA, always up to date.'),
    el('p', { class: 'auth-lead' }, 'Track every semester, see your progress at a glance and plan the grades you need next.'),
    el('ul', { class: 'auth-points' },
      point('trend', 'Semester GPA and CGPA, calculated as you type'),
      point('planner', 'Find the GPA you need to hit your target'),
      point('cloud', 'Saved to your account on every device'),
    ),
  );

  function point(name, text) {
    return el('li', {}, icon(name, 18), el('span', {}, text));
  }

  function render() {
    card.replaceChildren();
    const error = el('p', { class: 'form-error', role: 'alert' });
    const info = el('p', { class: 'form-info', role: 'status' });

    const showError = (e) => {
      info.textContent = '';
      error.textContent = typeof e === 'string' ? e : backend.friendlyError(e);
    };

    const busy = (form, on) => {
      for (const b of form.querySelectorAll('button, input')) b.disabled = on;
      card.classList.toggle('is-busy', on);
    };

    if (mode === 'reset') {
      const email = el('input', { type: 'email', name: 'email', autocomplete: 'email', required: true, placeholder: 'you@example.com' });
      const form = el('form', { class: 'auth-form', novalidate: true },
        field('Email', email),
        error, info,
        el('button', { type: 'submit', class: 'btn btn-primary btn-block' }, 'Send reset link'),
      );
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        busy(form, true);
        try {
          await backend.resetPassword(email.value.trim());
          error.textContent = '';
          info.textContent = `If an account uses ${email.value.trim()}, a reset link is on its way. Check your inbox and spam folder.`;
        } catch (err) {
          showError(err);
        }
        busy(form, false);
      });
      card.append(
        el('h2', {}, 'Reset your password'),
        el('p', { class: 'auth-sub' }, "Enter your account's email and we'll send you a link to choose a new password."),
        form,
        el('p', { class: 'auth-switch' }, el('button', { type: 'button', class: 'link', onclick: () => go('signin') }, '← Back to sign in')),
      );
      email.focus();
      return;
    }

    const signup = mode === 'signup';
    const google = el('button', { type: 'button', class: 'btn btn-google btn-block', html: `${GOOGLE_LOGO}<span>Continue with Google</span>` });
    google.addEventListener('click', async () => {
      error.textContent = '';
      card.classList.add('is-busy');
      try {
        await backend.signInWithGoogle();
      } catch (err) {
        if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') showError(err);
      }
      card.classList.remove('is-busy');
    });

    const name = el('input', { type: 'text', name: 'name', autocomplete: 'name', required: true, placeholder: 'Ali Khan' });
    const email = el('input', { type: 'email', name: 'email', autocomplete: 'email', required: true, placeholder: 'you@example.com' });
    const password = el('input', { type: 'password', name: 'password', autocomplete: signup ? 'new-password' : 'current-password', required: true, minlength: '6', placeholder: signup ? 'At least 6 characters' : '••••••••' });
    const toggle = el('button', { type: 'button', class: 'input-action', 'aria-label': 'Show password' }, 'Show');
    toggle.addEventListener('click', () => {
      const show = password.type === 'password';
      password.type = show ? 'text' : 'password';
      toggle.textContent = show ? 'Hide' : 'Show';
      toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });

    const form = el('form', { class: 'auth-form', novalidate: true },
      signup ? field('Name', name) : null,
      field('Email', email),
      field('Password', el('div', { class: 'input-with-action' }, password, toggle),
        signup ? null : el('button', { type: 'button', class: 'link small', onclick: () => go('reset') }, 'Forgot password?')),
      error,
      el('button', { type: 'submit', class: 'btn btn-primary btn-block' }, signup ? 'Create account' : 'Sign in'),
    );

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (signup && !name.value.trim()) return showError('Enter your name.');
      if (!email.value.trim()) return showError('Enter your email address.');
      if (signup && password.value.length < 6) return showError('Use a password of at least 6 characters.');
      if (!password.value) return showError('Enter your password.');
      busy(form, true);
      google.disabled = true;
      try {
        if (signup) await backend.signUpWithEmail(name.value.trim(), email.value.trim(), password.value);
        else await backend.signInWithEmail(email.value.trim(), password.value);
      } catch (err) {
        showError(err);
        busy(form, false);
        google.disabled = false;
      }
    });

    card.append(
      el('h2', {}, signup ? 'Create your account' : 'Welcome back'),
      el('p', { class: 'auth-sub' }, signup ? 'Free, and takes less than a minute.' : 'Sign in to see your grades.'),
      google,
      el('div', { class: 'divider' }, el('span', {}, 'or use email')),
      form,
      el('p', { class: 'auth-switch' },
        signup ? 'Already have an account? ' : 'New here? ',
        el('button', { type: 'button', class: 'link', onclick: () => go(signup ? 'signin' : 'signup') }, signup ? 'Sign in' : 'Create an account'),
      ),
    );
  }

  function go(m) {
    mode = m;
    render();
  }

  render();
  root.replaceChildren(el('div', { class: 'auth-screen' }, brand, el('main', { class: 'auth-main' }, card)));
}

function field(label, control, extra) {
  const id = `f-${Math.random().toString(36).slice(2, 8)}`;
  const input = control.matches('input') ? control : control.querySelector('input');
  input.id = id;
  return el('div', { class: 'field' },
    el('div', { class: 'field-label-row' }, el('label', { for: id }, label), extra || null),
    control,
  );
}

export function logoMark(size = 32) {
  return el('span', {
    class: 'logo-mark',
    'aria-hidden': 'true',
    html: `<svg width="${size}" height="${size}" viewBox="0 0 40 40"><rect width="40" height="40" rx="11" fill="var(--accent)"/><path d="M20 10 7 16.5 20 23l13-6.5L20 10Z" fill="#fff"/><path d="M12 20v6c0 2 3.6 4 8 4s8-2 8-4v-6l-8 4-8-4Z" fill="#fff" opacity=".75"/><path d="M33 16.5V25" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`,
  });
}

export function setupNotice(root) {
  root.replaceChildren(el('div', { class: 'auth-screen single' },
    el('main', { class: 'auth-main' },
      el('div', { class: 'auth-card' },
        el('div', { class: 'brand-mark center' }, logoMark(40)),
        el('h2', {}, 'Almost ready'),
        el('p', { class: 'auth-sub' }, 'This copy of the app isn\'t connected to Firebase yet. Fill in firebase-config.js with your project\'s web config, then reload. The README has the steps.'),
      ),
    ),
  ));
}
