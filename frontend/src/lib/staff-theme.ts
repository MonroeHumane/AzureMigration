/**
 * Staff Portal Theme Management
 * Defaults to 'light' (Monroe Humane org color scheme)
 * Toggleable to 'dark' ("Dark Ops" neutralized palette)
 */

export type StaffTheme = 'light' | 'dark';

export function getStaffTheme(): StaffTheme {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-staff-theme');
    if (attr === 'dark' || attr === 'light') return attr;
  }
  try {
    const stored = localStorage.getItem('mchs_staff_theme');
    if (stored === 'dark' || stored === 'light') return stored;
  } catch (e) {}
  return 'light';
}

export function setStaffTheme(theme: StaffTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-staff-theme', theme);
  try {
    localStorage.setItem('mchs_staff_theme', theme);
  } catch (e) {}
  syncStaffThemeUI();
}

export function toggleStaffTheme(): StaffTheme {
  const current = getStaffTheme();
  const next: StaffTheme = current === 'dark' ? 'light' : 'dark';
  setStaffTheme(next);
  return next;
}

export function syncStaffThemeUI(): void {
  if (typeof document === 'undefined') return;
  const current = getStaffTheme();
  const isDark = current === 'dark';

  document.querySelectorAll<HTMLElement>('.staff-theme-toggle-btn').forEach((btn) => {
    const sunIcon = btn.querySelector('.theme-icon-sun');
    const moonIcon = btn.querySelector('.theme-icon-moon');
    const label = btn.querySelector('.theme-toggle-label');

    if (isDark) {
      sunIcon?.classList.remove('hidden');
      moonIcon?.classList.add('hidden');
      if (label) label.textContent = 'Dark Ops';
      btn.setAttribute('title', 'Switch to Monroe Light Theme');
      btn.setAttribute('aria-label', 'Switch to Monroe Light Theme');
    } else {
      sunIcon?.classList.add('hidden');
      moonIcon?.classList.remove('hidden');
      if (label) label.textContent = 'Light';
      btn.setAttribute('title', 'Switch to Dark Ops Theme');
      btn.setAttribute('aria-label', 'Switch to Dark Ops Theme');
    }
  });
}

export function initStaffThemeToggle(): void {
  if (typeof document === 'undefined') return;

  document.querySelectorAll<HTMLElement>('.staff-theme-toggle-btn').forEach((btn) => {
    if (btn.dataset.themeBound !== '1') {
      btn.dataset.themeBound = '1';
      btn.addEventListener('click', () => {
        toggleStaffTheme();
      });
    }
  });

  syncStaffThemeUI();
}
