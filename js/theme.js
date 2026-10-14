// Light (default) / dark / system theme, remembered per device.
const KEY = 'gradepoint:theme';

export function getTheme() {
  try {
    return localStorage.getItem(KEY) || 'light';
  } catch (e) {
    return 'light';
  }
}

export function applyTheme(theme = getTheme()) {
  if (theme === 'light') document.documentElement.removeAttribute('data-theme');
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
