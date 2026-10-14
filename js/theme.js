// Light / dark / system theme, remembered per device.
const KEY = 'gradepoint:theme';

export function getTheme() {
  try {
    return localStorage.getItem(KEY) || 'system';
  } catch (e) {
    return 'system';
  }
}

export function applyTheme(theme = getTheme()) {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}

export function setTheme(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch (e) {
    // Storage blocked: the choice lasts for this visit only.
  }
  applyTheme(theme);
}
