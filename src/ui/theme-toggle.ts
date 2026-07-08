/**
 * Theme toggle: dark/light mode.
 * Respects prefers-color-scheme on first visit, persists choice in localStorage.
 */

const STORAGE_KEY = 'kmapgen-theme';

export function initThemeToggle(): void {
  const btn = document.getElementById('theme-toggle')!;
  const iconDark = document.getElementById('theme-icon-dark')!;
  const iconLight = document.getElementById('theme-icon-light')!;

  // Determine initial theme
  const stored = localStorage.getItem(STORAGE_KEY);
  let theme: 'dark' | 'light';

  if (stored === 'dark' || stored === 'light') {
    theme = stored;
  } else {
    theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  applyTheme(theme, iconDark, iconLight);

  btn.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme, iconDark, iconLight);
    localStorage.setItem(STORAGE_KEY, theme);
  });
}

function applyTheme(theme: 'dark' | 'light', iconDark: HTMLElement, iconLight: HTMLElement): void {
  document.documentElement.setAttribute('data-theme', theme);

  if (theme === 'dark') {
    iconDark.classList.remove('hidden');
    iconLight.classList.add('hidden');
  } else {
    iconDark.classList.add('hidden');
    iconLight.classList.remove('hidden');
  }
}
