// First-run setup: one click for the default setup, or four short steps to make it your own.
import { store, changed } from '../store.js';
import {
  uid, defaultProgram, emptyProgram, programCourses, programCredits, scaleProblem,
  parseNum, maxGP, fmt, fmtCredits, DEFAULT_PROGRAM_NAME,
} from '../calc.js';
import { el, icon } from '../ui.js';
import { logoMark } from './auth.js';
import { programEditor } from './program-editor.js';
import { scaleEditor } from './scale-editor.js';
import { codeLookup, pendingJoin, clearPendingJoin, programChanged } from '../sharing.js';
import { programFromShared } from '../calc.js';

const STEPS = ['About you', 'Courses', 'Grading', 'Starting point'];
const clone = (v) => JSON.parse(JSON.stringify(v, (k, x) => (typeof x === 'number' && !Number.isFinite(x) ? null : x)));

export function renderSetup(root, { onDone, rerun = false }) {
  const live = store.data;
  const hasSemesters = live.semesters.length > 0;
  const draft = {
    university: live.profile.university,
    currentSemester: live.profile.currentSemester || '1',
    programKind: live.program.name === DEFAULT_PROGRAM_NAME || !live.program.name ? 'default' : 'custom',
    shared: null, // { code, data } once a friend's code is used
    program: clone(live.program),
    scale: clone(live.scale).map((g) => ({ min: g.min ?? NaN, grade: g.grade, gp: g.gp ?? NaN })),
    start: 'fresh', // 'fresh' | 'prior' | 'past'
    prior: { ...live.prior },
    addCurrent: true,
  };
  const joinCode = rerun ? '' : pendingJoin();
  let step = rerun ? 1 : joinCode ? 'join' : 0;

  const firstName = (store.user.name || '').split(' ')[0];
  const main = el('main', { class: 'setup-main' });
  const progress = el('div', { class: 'setup-progress' });
  root.replaceChildren(el('div', { class: 'setup-screen' },
    el('header', { class: 'setup-top' }, el('span', { class: 'brand-mark' }, logoMark(30), el('span', {}, 'GradePoint')), progress),
    main,
  ));

  function render() {
    progress.replaceChildren();
    if (typeof step === 'number' && step > 0) {
      progress.append(
        el('span', { class: 'muted small' }, `Step ${step} of ${STEPS.length} · ${STEPS[step - 1]}`),
        el('div', { class: 'setup-bar', role: 'progressbar', 'aria-valuemin': '1', 'aria-valuemax': String(STEPS.length), 'aria-valuenow': String(step) },
          el('span', { style: `width:${(step / STEPS.length) * 100}%` })),
      );
    }
    main.replaceChildren(step === 'join' ? join() : [welcome, about, courses, grading, starting][step]());
    const focusable = main.querySelector('h1');
    if (focusable) focusable.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  const go = (n) => {
    step = n;
    render();
  };

  function card(title, sub, body, { back = true, next = 'Continue', onNext, error } = {}) {
    const err = el('p', { class: 'form-error', role: 'alert' });
    const nextBtn = el('button', { type: 'button', class: 'btn btn-primary' }, next, icon('chevron', 18));
    nextBtn.addEventListener('click', () => {
      const problem = error && error();
      err.textContent = problem || '';
      if (!problem) (onNext || (() => go(step + 1)))();
    });
    return el('div', { class: 'setup-card' },
      el('h1', { tabindex: '-1' }, title),
      sub ? el('p', { class: 'setup-sub' }, sub) : null,
      body,
      err,
      el('div', { class: 'setup-actions' },
        back ? el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => go(step - 1) }, 'Back') : el('span'),
        nextBtn,
      ),
    );
  }

  function welcome() {
    return el('div', { class: 'setup-card' },
      el('div', { class: 'setup-hero-icon' }, logoMark(56)),
      el('h1', { tabindex: '-1' }, firstName ? `Welcome, ${firstName}!` : 'Welcome!'),
      el('p', { class: 'setup-sub' }, 'Let’s get your account ready. Pick the default setup to start right away, or take a minute to match it to your degree.'),
      el('div', { class: 'choice-list' },
        el('button', { type: 'button', class: 'choice-card big', onclick: finishDefault },
          el('span', { class: 'option-icon' }, icon('check', 22)),
          el('span', { class: 'choice-text' },
            el('strong', {}, 'Use the default setup'),
            el('span', { class: 'muted' }, 'BSCS courses for semesters 1–8 and the standard grading scale (A 80+, B+ 70+, B 60+, C+ 55+, C 50+). You can change everything later in Settings.'),
          ),
          el('span', { class: 'tag' }, 'Fastest'),
        ),
        el('button', { type: 'button', class: 'choice-card big', onclick: () => go(1) },
          el('span', { class: 'option-icon' }, icon('settings', 22)),
          el('span', { class: 'choice-text' },
            el('strong', {}, 'Set it up my way'),
            el('span', { class: 'muted' }, 'Choose your program, edit its courses, adjust the grading scale and enter where you’re starting from. About a minute.'),
          ),
        ),
        el('button', { type: 'button', class: 'choice-card big', onclick: () => go('join') },
          el('span', { class: 'option-icon' }, icon('share', 22)),
          el('span', { class: 'choice-text' },
            el('strong', {}, 'I have a code from a friend'),
            el('span', { class: 'muted' }, 'Copy a friend’s course list for your university, then finish setting up.'),
          ),
        ),
      ),
    );
  }

  function join() {
    const lookup = codeLookup({
      initial: joinCode,
      useLabel: 'Use these courses',
      onUse: (code, data) => {
        draft.shared = { code, data };
        draft.programKind = 'shared';
        draft.program = programFromShared(data, code);
        if (!draft.university && data.university) draft.university = data.university;
        clearPendingJoin();
        go(1);
      },
    });
    const node = el('div', { class: 'setup-card' },
      el('h1', { tabindex: '-1' }, 'Copy a friend’s program'),
      el('p', { class: 'setup-sub' }, 'Enter the 6-character code your friend shared. You’ll see their program before using it, and you can still edit the courses afterwards.'),
      lookup,
      el('div', { class: 'setup-actions' },
        el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { clearPendingJoin(); go(0); } }, 'Back'),
        el('span'),
      ),
    );
    if (joinCode) setTimeout(() => lookup.search());
    return node;
  }

  function about() {
    const uni = el('input', { type: 'text', value: draft.university, placeholder: 'e.g. FAST-NUCES, COMSATS, NUST', autocomplete: 'organization' });
    uni.addEventListener('input', () => { draft.university = uni.value; });
    const sem = el('select', {});
    for (let i = 1; i <= 12; i++) sem.append(el('option', { value: String(i) }, `Semester ${i}`));
    sem.value = draft.currentSemester;
    sem.addEventListener('change', () => { draft.currentSemester = sem.value; });

    const customName = el('input', { type: 'text', value: draft.programKind === 'custom' ? draft.program.name : '', placeholder: 'e.g. BBA, BS Electrical Engineering' });
    customName.addEventListener('input', () => { draft.program.name = customName.value; });
    const nameField = el('label', { class: 'field', hidden: draft.programKind !== 'custom' }, el('span', {}, 'Program name'), customName);

    const kinds = el('div', { class: 'choice-list', role: 'radiogroup', 'aria-label': 'Degree program' });
    const option = (kind, title, desc) => {
      const b = el('button', { type: 'button', role: 'radio', class: 'choice-card', 'aria-checked': String(draft.programKind === kind) },
        el('span', { class: 'radio-dot', 'aria-hidden': 'true' }),
        el('span', { class: 'choice-text' }, el('strong', {}, title), el('span', { class: 'muted' }, desc)),
      );
      b.addEventListener('click', () => {
        if (draft.programKind !== kind) {
          draft.programKind = kind;
          // Switching program starts its course list fresh; the old one isn't saved until Finish.
          draft.program = kind === 'default' ? defaultProgram()
            : kind === 'shared' ? programFromShared(draft.shared.data, draft.shared.code)
            : emptyProgram(customName.value);
        }
        for (const x of kinds.children) x.setAttribute('aria-checked', String(x === b));
        nameField.hidden = kind !== 'custom';
        if (kind === 'custom') customName.focus();
      });
      return b;
    };
    if (draft.shared) {
      const d = draft.shared.data;
      kinds.append(option('shared', `${d.name}${d.university ? ` · ${d.university}` : ''}`,
        `${d.ownerName ? `${d.ownerName}’s` : 'Your friend’s'} course list (code ${draft.shared.code}). Check it on the next step.`));
    }
    kinds.append(
      option('default', 'BSCS', 'Courses for all 8 semesters are filled in. Edit them on the next step if yours differ.'),
      option('custom', 'Another program', 'Start with an empty course list and add your own courses.'),
    );

    return card('Tell us about your studies', 'This fills in your courses so adding a semester takes one tap.',
      el('div', { class: 'setup-fields' },
        el('label', { class: 'field' }, el('span', {}, 'University (optional)'), uni),
        el('div', { class: 'field' }, el('span', {}, 'Degree program'), kinds),
        nameField,
        el('label', { class: 'field narrow' }, el('span', {}, 'Which semester are you in now?'), sem),
      ),
      {
        back: !rerun,
        error: () => (draft.programKind === 'custom' && !draft.program.name.trim() ? 'Enter your program’s name.' : ''),
      },
    );
  }

  function courses() {
    // Make sure the program reaches the current semester so it can be filled in.
    const cur = Number(draft.currentSemester);
    while (draft.program.semesters.length < cur) draft.program.semesters.push({ id: uid(), courses: [] });
    return card(`Your ${draft.program.name || 'program'} courses`,
      'Check the courses and credit hours for each semester. New semesters are filled in from this list. You can change it later in Settings → Program & courses.',
      programEditor(draft.program, { onChange: () => {}, showName: false }),
      { next: 'Looks good' },
    );
  }

  function grading() {
    return card('Grading scale', 'How your university turns marks into grade points. Edit it if yours is different from the default.',
      scaleEditor(draft, { onChange: () => {} }),
      { error: () => scaleProblem(draft) },
    );
  }

  function starting() {
    const cur = Number(draft.currentSemester);
    const progSem = draft.program.semesters[cur - 1];
    const body = el('div', { class: 'setup-fields' });

    if (hasSemesters) {
      body.append(el('div', { class: 'notice' }, icon('check', 18),
        el('span', {}, `You already have ${live.semesters.length} semester${live.semesters.length === 1 ? '' : 's'} with grades. They stay exactly as they are.`)));
    } else {
      const max = maxGP(draft);
      const cgpa = el('input', { type: 'number', min: '0', max: String(max), step: '0.01', inputmode: 'decimal', value: draft.prior.cgpa, placeholder: 'e.g. 3.20' });
      const credits = el('input', { type: 'number', min: '0', step: '1', inputmode: 'numeric', value: draft.prior.credits, placeholder: 'e.g. 36' });
      cgpa.addEventListener('input', () => { draft.prior.cgpa = cgpa.value; });
      credits.addEventListener('input', () => { draft.prior.credits = credits.value; });
      const priorFields = el('div', { class: 'field-grid', hidden: draft.start !== 'prior' },
        el('label', { class: 'field' }, el('span', {}, 'CGPA so far'), cgpa),
        el('label', { class: 'field' }, el('span', {}, 'Credit hours completed'), credits),
      );

      const choices = el('div', { class: 'choice-list', role: 'radiogroup', 'aria-label': 'Starting point' });
      const option = (value, title, desc) => {
        const b = el('button', { type: 'button', role: 'radio', class: 'choice-card', 'aria-checked': String(draft.start === value) },
          el('span', { class: 'radio-dot', 'aria-hidden': 'true' }),
          el('span', { class: 'choice-text' }, el('strong', {}, title), el('span', { class: 'muted' }, desc)),
        );
        b.addEventListener('click', () => {
          draft.start = value;
          for (const x of choices.children) x.setAttribute('aria-checked', String(x === b));
          priorFields.hidden = value !== 'prior';
          if (value === 'prior') cgpa.focus();
        });
        return b;
      };
      if (cur === 1) {
        draft.start = 'fresh';
      } else {
        choices.append(
          option('fresh', 'Just track from now on', 'Start with this semester. You can add earlier ones any time.'),
          option('prior', 'I know my CGPA so far', `Enter your CGPA and credit hours from semesters 1–${cur - 1}.`),
          option('past', 'I’ll enter my past semesters', `Adds semesters 1–${cur - 1} with their courses so you can fill in your marks.`),
        );
        body.append(choices, priorFields);
      }

      const check = el('input', { type: 'checkbox', checked: draft.addCurrent });
      check.addEventListener('change', () => { draft.addCurrent = check.checked; });
      body.append(el('label', { class: 'check-row' }, check,
        el('span', {}, el('strong', {}, `Add Semester ${cur} now`),
          el('span', { class: 'muted' }, progSem && progSem.courses.length
            ? ` with its ${progSem.courses.length} courses (${fmtCredits(programCredits(progSem))} credit hours), ready for your marks`
            : ' (empty, since your program has no courses for it yet)')),
      ));
    }

    return card(cur === 1 && !hasSemesters ? 'You’re all set' : 'Where are you starting from?', null, body, {
      next: 'Finish setup',
      onNext: finish,
      error: () => {
        if (hasSemesters || draft.start !== 'prior') return '';
        const v = parseNum(draft.prior.cgpa);
        const c = parseNum(draft.prior.credits);
        if (v === null || v < 0 || v > maxGP(draft)) return `Enter a CGPA between 0 and ${fmt(maxGP(draft))}.`;
        if (c === null || c <= 0) return 'Enter the credit hours you’ve completed.';
        return '';
      },
    });
  }

  function finishDefault() {
    const data = store.data;
    data.profile.setupDone = true;
    changed();
    onDone({ welcome: true });
  }

  function finish() {
    const data = store.data;
    const shareCode = data.program.shareCode;
    data.profile = { setupDone: true, university: draft.university.trim(), currentSemester: draft.currentSemester };
    data.program = draft.program;
    data.program.name = data.program.name.trim() || DEFAULT_PROGRAM_NAME;
    if (shareCode) data.program.shareCode = shareCode;
    data.scale = draft.scale;
    if (!hasSemesters) {
      const cur = Number(draft.currentSemester);
      if (draft.start === 'prior') data.prior = { cgpa: draft.prior.cgpa, credits: draft.prior.credits };
      const add = (n) => data.semesters.push({ id: uid(), name: `Semester ${n}`, courses: programCourses(data, n - 1) });
      if (draft.start === 'past') for (let n = 1; n < cur; n++) add(n);
      if (draft.addCurrent) add(cur);
    }
    changed();
    programChanged();
    onDone({ welcome: !rerun, goTo: !hasSemesters && data.semesters.length ? 'semesters' : 'dashboard' });
  }

  render();
}
