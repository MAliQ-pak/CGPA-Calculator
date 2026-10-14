// Sign-in / create-account screen.
import { el, icon, GOOGLE_LOGO } from '../ui.js';
import * as backend from '../firebase.js';

export function renderAuth(root) {
  let mode = 'signin'; // 'signin' | 'signup' | 'reset'
  const card = el('div', { class: 'auth-card' });

  const brand = el('aside', { class: 'auth-brand' },
    el('div', { class: 'brand-mark' }, logoMark(40), el('span', {}, 'GradePoint')),
    el('span', { class: 'student-badge' }, icon('book', 16), 'Made for students'),
    el('h1', {}, 'Know your CGPA. Plan your next A.'),
    el('p', { class: 'auth-lead' }, 'Add your marks after each semester and GradePoint works out your GPA, your CGPA and what you need next. Free for every student.'),
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

// GradePoint mark: a progress-ring "G" with a honey dot, the "point".
let logoCount = 0;
export function logoMark(size = 32) {
  const id = `gp-logo-${(logoCount += 1)}`;
  return el('span', {
    class: 'logo-mark',
    'aria-hidden': 'true',
    html: `<svg width="${size}" height="${size}" viewBox="0 0 40 40"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#DE6A32"/><stop offset="1" stop-color="#B9481B"/></linearGradient></defs><rect class="logo-bg" width="40" height="40" rx="12" fill="url(#${id})"/><path d="M26.4 12.3A10 10 0 1 0 30 20h-8.5" fill="none" stroke="#FFF6EC" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="30.2" cy="10.6" r="2.7" fill="#F6B94D"/></svg>`,
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
