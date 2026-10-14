// Achievements page, plus the progress card shown on the dashboard.
import { store, changed } from '../store.js';
import { progress, XP } from '../gamify.js';
import { el, icon } from '../ui.js';

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

function levelBlock(p, large = false) {
  const span = p.next === null ? 1 : p.next - p.floor;
  const into = p.next === null ? 1 : p.xp - p.floor;
  const pct = Math.max(0, Math.min(100, (into / span) * 100));
  return el('div', { class: `level${large ? ' large' : ''}` },
    el('div', { class: 'level-badge', 'aria-hidden': 'true' }, el('span', {}, 'Lv'), el('strong', {}, String(p.level))),
    el('div', { class: 'level-text' },
      el('div', { class: 'level-title' }, el('strong', {}, p.title), el('span', { class: 'muted small' }, ` · ${p.xp} XP`)),
      el('div', { class: 'xp-bar', role: 'progressbar', 'aria-label': 'Progress to next level', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(pct)) },
        el('span', { style: `width:${pct}%` })),
      el('span', { class: 'muted small' }, p.next === null ? 'Top level reached. Legend!' : `${p.next - p.xp} XP to ${p.nextTitle}`),
    ),
  );
}

// Badge closest to being earned: one with progress first, then the first locked one.
function nextBadge(p) {
  const locked = p.badges.filter((b) => !b.done);
  return locked.filter((b) => b.progress).sort((a, b) => b.progress[0] / b.progress[1] - a.progress[0] / a.progress[1])[0] || locked[0] || null;
}

export function progressCard() {
  if (!store.data.gamify.enabled) return null;
  const p = progress(store.data);
  const recent = p.badges.filter((b) => b.done).sort((a, b) => (b.earnedOn || '').localeCompare(a.earnedOn || '')).slice(0, 4);
  const next = nextBadge(p);
  return el('section', { class: 'card progress-card' },
    el('div', { class: 'card-head' },
      el('h3', {}, 'Your progress'),
      el('a', { href: '#/achievements', class: 'link' }, 'All badges'),
    ),
    levelBlock(p),
    el('div', { class: 'badge-strip' },
      el('span', { class: 'muted small' }, `${p.earned} of ${p.badges.length} badges`),
      el('span', { class: 'badge-emojis', 'aria-label': recent.map((b) => b.title).join(', ') }, recent.map((b) => el('span', { title: b.title }, b.emoji))),
    ),
    next ? el('a', { href: '#/achievements', class: 'next-badge' },
      el('span', { class: 'next-emoji', 'aria-hidden': 'true' }, next.emoji),
      el('span', {}, el('strong', {}, `Next: ${next.title}`), el('span', { class: 'muted small' }, next.hint)),
      icon('chevron', 18)) : null,
  );
}

export function renderAchievements(root, { navigate }) {
  if (!store.data.gamify.enabled) {
    root.append(el('section', { class: 'card empty-state' },
      el('div', { class: 'empty-icon' }, icon('trophy', 28)),
      el('h3', {}, 'Achievements are turned off'),
      el('p', {}, 'Turn them on to earn badges and level up as you track your grades.'),
      el('button', { type: 'button', class: 'btn btn-primary', onclick: () => {
        store.data.gamify.enabled = true;
        changed();
        navigate('achievements');
      } }, 'Turn on achievements'),
    ));
    return;
  }
  const p = progress(store.data);
  const streak = store.data.gamify.streak;
  root.append(
    el('a', { href: '#/dashboard', class: 'back-link' }, el('span', { class: 'flip' }, icon('chevron', 16)), 'Dashboard'),
    el('div', { class: 'page-intro' },
      el('h2', {}, 'Achievements'),
      el('p', {}, 'Earn XP and badges for keeping your grades up to date, planning ahead and improving. It’s about good habits, not just high grades.'),
    ),
    el('div', { class: 'ach-top' },
      el('section', { class: 'card' }, levelBlock(p, true),
        el('div', { class: 'ach-stats' },
          stat(`${p.earned}/${p.badges.length}`, 'Badges'),
          stat(String(streak.count || 0), 'Week streak'),
          stat(String(streak.best || 0), 'Best streak'),
        ),
      ),
      el('section', { class: 'card xp-how' },
        el('h3', {}, 'How you earn XP'),
        el('ul', {},
          el('li', {}, el('strong', {}, `+${XP.course}`), ' for each course with a grade', el('span', { class: 'muted' }, ` (${p.parts.courses})`)),
          el('li', {}, el('strong', {}, `+${XP.item}`), ' for each quiz, mid or assignment you track', el('span', { class: 'muted' }, ` (${p.parts.items})`)),
          el('li', {}, el('strong', {}, `+${XP.semester}`), ' for each fully graded semester', el('span', { class: 'muted' }, ` (${p.parts.semesters})`)),
          el('li', {}, el('strong', {}, `+${XP.badge}`), ' for each badge', el('span', { class: 'muted' }, ` (${p.earned})`)),
        ),
        el('p', { class: 'muted small' }, 'Open GradePoint at least once a week to keep your streak going.'),
      ),
    ),
    el('div', { class: 'badge-grid' }, p.badges.map((b) => el('article', { class: `badge-tile${b.done ? ' earned' : ''}` },
      el('div', { class: 'badge-emoji', 'aria-hidden': 'true' }, b.emoji),
      el('strong', {}, b.title),
      b.done
        ? el('span', { class: 'badge-when' }, icon('check', 14), b.earnedOn ? `Unlocked ${fmtDate(b.earnedOn)}` : 'Unlocked')
        : el('span', { class: 'muted small' }, b.hint),
      !b.done && b.progress ? el('div', { class: 'badge-progress' },
        el('div', { class: 'xp-bar' }, el('span', { style: `width:${(b.progress[0] / b.progress[1]) * 100}%` })),
        el('span', { class: 'muted small' }, `${Math.floor(b.progress[0])} / ${Math.ceil(b.progress[1])}`)) : null,
      el('span', { class: 'sr-only' }, b.done ? 'Earned' : 'Locked'),
    ))),
  );
}

function stat(value, label) {
  return el('div', { class: 'ach-stat' }, el('strong', {}, value), el('span', {}, label));
}
