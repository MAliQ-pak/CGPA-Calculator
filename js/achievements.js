// Records newly earned badges and celebrates them. Badges are always recorded (so turning
// achievements back on later doesn't flood the screen); celebrations only show when enabled.
import { store, changed, onChange } from './store.js';
import { newBadges, recordVisit, BADGES } from './gamify.js';
import { toast } from './ui.js';
import { confetti } from './confetti.js';

const CHECK_DELAY = 600;
let timer = null;

const today = () => new Date().toISOString().slice(0, 10);

function record(ids) {
  const date = today();
  for (const id of ids) store.data.gamify.badges[id] = date;
}

export function celebrate(ids) {
  if (!ids.length || !store.data.gamify.enabled) return;
  const shown = ids.slice(0, 2).map((id) => BADGES.find((b) => b.id === id));
  for (const b of shown) toast(`${b.emoji} Badge unlocked: ${b.title}`, 'success');
  if (ids.length > shown.length) toast(`+${ids.length - shown.length} more badges. See them in Achievements.`, 'success');
  confetti();
}

function check() {
  if (!store.user) return;
  const ids = newBadges(store.data);
  if (!ids.length) return;
  record(ids);
  changed();
  celebrate(ids);
}

// Called once after the user's data loads.
export function startAchievements() {
  const g = store.data.gamify;
  let dirty = recordVisit(store.data);
  if (!g.initialized) {
    // First run for this account: whatever is already earned is recorded quietly.
    record(newBadges(store.data));
    g.initialized = true;
    dirty = true;
  }
  if (dirty) changed();
  check();
}

onChange(() => {
  clearTimeout(timer);
  timer = setTimeout(check, CHECK_DELAY);
});
