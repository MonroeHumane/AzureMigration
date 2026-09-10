/**
 * Staff Ops PWA display detection.
 * Standalone / fullscreen / minimal-ui / window-controls-overlay (and iOS
 * navigator.standalone) mean the page was launched from the installed app,
 * not a normal browser tab.
 */

const INSTALLED_FLAG = 'hsmc_ops_pwa_installed';

const STANDALONE_MODES = [
  'standalone',
  'fullscreen',
  'minimal-ui',
  'window-controls-overlay',
] as const;

export function isStandaloneDisplay(win: Window = window): boolean {
  if (STANDALONE_MODES.some((mode) => win.matchMedia(`(display-mode: ${mode})`).matches)) {
    return true;
  }
  const nav = win.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  try {
    if (new URLSearchParams(win.location.search).get('source') === 'pwa') return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function markPwaDisplay(target: HTMLElement = document.documentElement): void {
  const standalone = isStandaloneDisplay(target.ownerDocument?.defaultView || window);
  target.setAttribute('data-pwa', standalone ? 'standalone' : 'browser');
}

export function rememberPwaInstalled(): void {
  try {
    localStorage.setItem(INSTALLED_FLAG, '1');
  } catch {
    /* private mode */
  }
}

export function forgetPwaInstalled(): void {
  try {
    localStorage.removeItem(INSTALLED_FLAG);
  } catch {
    /* private mode */
  }
}

export function wasPwaJustInstalled(): boolean {
  try {
    return localStorage.getItem(INSTALLED_FLAG) === '1';
  } catch {
    return false;
  }
}

export async function isRelatedPwaInstalled(): Promise<boolean> {
  const nav = navigator as Navigator & {
    getInstalledRelatedApps?: () => Promise<Array<{ platform?: string; id?: string }>>;
  };
  if (typeof nav.getInstalledRelatedApps !== 'function') return false;
  try {
    const apps = await nav.getInstalledRelatedApps();
    return Array.isArray(apps) && apps.length > 0;
  } catch {
    return false;
  }
}

export async function shouldHideInstallCard(): Promise<boolean> {
  if (isStandaloneDisplay() || wasPwaJustInstalled()) return true;
  return isRelatedPwaInstalled();
}
