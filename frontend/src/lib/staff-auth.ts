import { createDirectus, rest, authentication } from '@directus/sdk';

export const DIRECTUS_URL = 'https://mchs-directus.livelyfield-d0a70609.eastus.azurecontainerapps.io';

export const DIRECTUS_AUTH_KEY = 'directus_auth';
export const STAFF_AUTH_FLAG = 'mchs_staff_auth';
export const STAFF_USER_KEY = 'mchs_staff_user';
export const STAFF_TOKEN_KEY = 'mchs_staff_token';
export const STAFF_REMEMBER_KEY = 'mchs_staff_remember';

/**
 * Storage adapter for Directus authentication SDK.
 * Reads and writes from localStorage primarily to ensure persistent sessions across tabs.
 */
function getAuthStorage() {
  return {
    get() {
      try {
        const raw = localStorage.getItem(DIRECTUS_AUTH_KEY) || sessionStorage.getItem(DIRECTUS_AUTH_KEY);
        return raw ? normalizeDirectusAuth(JSON.parse(raw)) : null;
      } catch {
        return null;
      }
    },
    set(data: any) {
      try {
        if (data) {
          const str = JSON.stringify(normalizeDirectusAuth(data) || data);
          sessionStorage.setItem(DIRECTUS_AUTH_KEY, str);
          if (localStorage.getItem(STAFF_REMEMBER_KEY) === 'true') {
            localStorage.setItem(DIRECTUS_AUTH_KEY, str);
          } else {
            localStorage.removeItem(DIRECTUS_AUTH_KEY);
          }
        } else {
          localStorage.removeItem(DIRECTUS_AUTH_KEY);
          sessionStorage.removeItem(DIRECTUS_AUTH_KEY);
        }
      } catch (e) {
        console.warn('[StaffAuth] Failed to write auth data to storage:', e);
      }
    }
  };
}

export const staffClient = createDirectus(DIRECTUS_URL)
  .with(rest())
  .with(authentication('json', { storage: getAuthStorage() }));

// Directus SDK logs out automatically on some 401s. Never let that wipe the
// HMAC staff session; explicit Sign Out uses logoutStaff() instead.
staffClient.logout = async () => {
  return;
};

export function isStaffHmacToken(token: string | null | undefined): token is string {
  if (typeof token !== 'string' || !token.startsWith('mchs_') || !token.includes('.')) {
    return false;
  }
  try {
    const clean = token.substring(5);
    const [payloadB64] = clean.split('.');
    if (!payloadB64) return false;
    let jsonStr = '';
    if (typeof atob === 'function') {
      const b64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
      jsonStr = atob(b64);
    } else if (typeof Buffer !== 'undefined') {
      jsonStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
    }
    if (jsonStr) {
      const payload = JSON.parse(jsonStr);
      if (payload && typeof payload.iat === 'number') {
        const MAX_SESSION_AGE = 30 * 24 * 60 * 60 * 1000;
        if (Math.abs(Date.now() - payload.iat) > MAX_SESSION_AGE) {
          return false;
        }
      }
    }
  } catch {}
  return true;
}

export function getStoredHmacStaffToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(STAFF_TOKEN_KEY) || sessionStorage.getItem(STAFF_TOKEN_KEY);
  if (!token) return null;
  if (isStaffHmacToken(token)) {
    return token;
  }
  // Stale or expired token found in storage - purge to prevent false auth states
  clearStaffClientSession(true);
  return null;
}

/**
 * Directus REST /auth/login returns `expires` as a TTL in milliseconds
 * (e.g. 900000). The SDK treats `expires` / `expires_at` as epoch timestamps.
 * Saving the raw payload makes the session look expired immediately, so the
 * grants pipeline (and other CMS reads) fail while HMAC staff login still works.
 */
export function normalizeDirectusAuth(data: any): any {
  if (!data || typeof data !== 'object') return data;
  const access = data.access_token || data.accessToken || null;
  const refresh = data.refresh_token || data.refreshToken || null;
  if (!access && !refresh) return data;

  let expires = typeof data.expires === 'number' ? data.expires : null;
  let expiresAt = typeof data.expires_at === 'number' ? data.expires_at : null;
  if (expiresAt == null && expires != null && expires > 0 && expires < 1e12) {
    expiresAt = Date.now() + expires;
  } else if (expiresAt == null && expires != null && expires >= 1e12) {
    expiresAt = expires;
  }

  return {
    access_token: access,
    refresh_token: refresh,
    expires,
    expires_at: expiresAt,
  };
}

export async function ensureDirectusSession(): Promise<boolean> {
  try {
    const token = await staffClient.getToken();
    return typeof token === 'string' && token.length > 10;
  } catch {
    return false;
  }
}
export function isStaffAuthenticated(): boolean {
  return getStoredHmacStaffToken() !== null;
}

export function getRememberedStaffEmail(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const isRemembered = localStorage.getItem(STAFF_REMEMBER_KEY) === 'true';
    if (isRemembered) {
      return localStorage.getItem(STAFF_USER_KEY) || null;
    }
  } catch {}
  return null;
}

export function clearStaffClientSession(preserveRememberedUser = false): void {
  if (typeof window === 'undefined') return;
  try {
    const isRemembered = localStorage.getItem(STAFF_REMEMBER_KEY) === 'true';
    const rememberedEmail = localStorage.getItem(STAFF_USER_KEY);

    localStorage.removeItem(DIRECTUS_AUTH_KEY);
    localStorage.removeItem(STAFF_AUTH_FLAG);
    localStorage.removeItem(STAFF_TOKEN_KEY);
    localStorage.removeItem('mchs_financials_cache_v1');
    localStorage.removeItem('mchs_financials_cache_v1_at');

    if (!preserveRememberedUser || !isRemembered) {
      localStorage.removeItem(STAFF_USER_KEY);
      localStorage.removeItem(STAFF_REMEMBER_KEY);
    } else if (rememberedEmail) {
      localStorage.setItem(STAFF_USER_KEY, rememberedEmail);
      localStorage.setItem(STAFF_REMEMBER_KEY, 'true');
    }

    sessionStorage.removeItem(DIRECTUS_AUTH_KEY);
    sessionStorage.removeItem(STAFF_AUTH_FLAG);
    sessionStorage.removeItem(STAFF_USER_KEY);
    sessionStorage.removeItem(STAFF_TOKEN_KEY);
    sessionStorage.removeItem(STAFF_REMEMBER_KEY);
    sessionStorage.removeItem('mchs_financials_cache_v1');
    sessionStorage.removeItem('mchs_financials_cache_v1_at');

    document.documentElement.classList.remove('staff-authenticated');
  } catch {}
}

/** Clear a stale/invalid session and return to the login gate. */
export function forceStaffRelogin(): void {
  if (typeof window === 'undefined') return;
  const next = window.location.pathname + window.location.search;
  clearStaffClientSession(true);
  const redirect = next.startsWith('/internal') ? encodeURIComponent(next) : '';
  window.location.replace(redirect ? `/internal/?reauth=1&redirect=${redirect}` : '/internal/?reauth=1');
}

/**
 * Returns the currently signed-in staff email or identifier.
 */
export function getStaffUserEmail(): string {
  if (typeof window === 'undefined') return 'staff@monroe-humane.org';
  return (
    localStorage.getItem(STAFF_USER_KEY) ||
    sessionStorage.getItem(STAFF_USER_KEY) ||
    'staff@monroe-humane.org'
  );
}

/**
 * Helper to fetch with an AbortController timeout.
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function exchangeDirectusTokenForStaffSession(email: string, directusToken: string): Promise<string | null> {
  const sRes = await fetchWithTimeout('/api/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${directusToken}`,
      'X-Staff-Token': directusToken,
      'X-Authorization': `Bearer ${directusToken}`,
    },
    body: JSON.stringify({ email, directus_token: directusToken, token: directusToken }),
  }, 8000);
  if (!sRes.ok) return null;
  const sData = await sRes.json().catch(() => ({}));
  return sData && sData.token ? sData.token : null;
}

/**
 * Sign in through /api/login. That Function already authenticates against Directus
 * and returns both the HMAC staff token and Directus tokens — do not call
 * Directus /auth/login again on the happy path (it doubles wait time and can 429).
 */
export async function loginStaff(opts: {
  email: string;
  password: string;
  rememberMe?: boolean;
}): Promise<void> {
  const { password, rememberMe = true } = opts;
  const email = (opts.email || '').trim().toLowerCase();

  let staffToken: string | null = null;
  let directusPayload: any = null;

  try {
    const res = await fetchWithTimeout('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }, 12000);

    if (res.ok) {
      const data = await res.json();
      if (data && data.token) {
        staffToken = data.token;
        directusPayload = data.directus ? normalizeDirectusAuth(data.directus) : null;
      }
    } else if (res.status === 401) {
      throw new Error('Invalid email or password. Please verify your credentials.');
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Authentication request timed out. Please check your network connection and try again.');
    }
    if (err.message && err.message.includes('Invalid email or password')) {
      throw err;
    }
    console.warn('[StaffAuth] /api/login call failed, falling back to Directus SDK:', err);
  }

  // Fallback only when Azure login did not issue a staff session.
  if (!isStaffHmacToken(staffToken)) {
    let sdkTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        staffClient.login({ email, password }),
        new Promise((_, reject) => {
          sdkTimer = setTimeout(() => {
            reject(Object.assign(new Error('Directus login timed out'), { name: 'AbortError' }));
          }, 10000);
        }),
      ]);
      const dt = await staffClient.getToken();
      if (dt) {
        staffToken = await exchangeDirectusTokenForStaffSession(email, dt);
        try {
          const stored = getAuthStorage().get();
          if (stored) directusPayload = stored;
        } catch {}
      }
    } catch (sdkErr: any) {
      if (sdkErr?.name === 'AbortError') {
        throw new Error('Authentication request timed out. Please check your network connection and try again.');
      }
      throw sdkErr;
    } finally {
      if (sdkTimer) clearTimeout(sdkTimer);
    }
  }

  if (!isStaffHmacToken(staffToken)) {
    throw new Error('Could not create a staff session. Sign in again, or ask an admin to check /api/login.');
  }

  // 3. Persist tokens respecting Remember Me security preferences:
  // If rememberMe is true: persist to localStorage (persistent across browser restarts) & sessionStorage.
  // If rememberMe is false (shared workstation): persist ONLY to sessionStorage and purge localStorage.
  if (rememberMe) {
    try {
      localStorage.setItem(STAFF_AUTH_FLAG, 'true');
      localStorage.setItem(STAFF_USER_KEY, email);
      localStorage.setItem(STAFF_REMEMBER_KEY, 'true');
      localStorage.setItem(STAFF_TOKEN_KEY, staffToken);
      if (directusPayload) {
        localStorage.setItem(DIRECTUS_AUTH_KEY, JSON.stringify(directusPayload));
      }
    } catch (e) {
      console.warn('[StaffAuth] Failed to write to localStorage:', e);
    }
  } else {
    try {
      localStorage.removeItem(STAFF_AUTH_FLAG);
      localStorage.removeItem(STAFF_TOKEN_KEY);
      localStorage.removeItem(STAFF_REMEMBER_KEY);
      localStorage.removeItem(STAFF_USER_KEY);
      localStorage.removeItem(DIRECTUS_AUTH_KEY);
    } catch {}
  }

  try {
    sessionStorage.setItem(STAFF_AUTH_FLAG, 'true');
    sessionStorage.setItem(STAFF_USER_KEY, email);
    sessionStorage.setItem(STAFF_TOKEN_KEY, staffToken);
    if (directusPayload) {
      sessionStorage.setItem(DIRECTUS_AUTH_KEY, JSON.stringify(directusPayload));
    }
  } catch (e) {
    console.warn('[StaffAuth] Failed to write to sessionStorage:', e);
  }

  // Update HTML class immediately for zero-flicker UI
  if (typeof document !== 'undefined') {
    document.documentElement.classList.add('staff-authenticated');
  }
}

function resetLogoutButtons(): void {
  if (typeof document === 'undefined') return;
  const buttons = [
    {
      btn: 'global-staff-logout-btn',
      text: 'logout-btn-text',
      icon: 'logout-btn-icon',
      spinner: 'logout-btn-spinner',
    },
    {
      btn: 'sidebar-logout-btn',
      text: 'sidebar-logout-text',
      icon: 'sidebar-logout-icon',
      spinner: 'sidebar-logout-spinner',
    },
  ];
  for (const ids of buttons) {
    const button = document.getElementById(ids.btn) as HTMLButtonElement | null;
    if (button) button.disabled = false;
    const label = document.getElementById(ids.text);
    if (label) label.textContent = 'Sign Out';
    document.getElementById(ids.icon)?.classList.remove('hidden');
    document.getElementById(ids.spinner)?.classList.add('hidden');
  }
}

function isStaffHubPath(pathname: string): boolean {
  return pathname === '/internal' || pathname === '/internal/';
}

/**
 * Signs out of Staff Portal. Clears local session immediately and does not wait
 * on Directus — HMAC staff tokens are not revoked server-side, and a hung
 * /auth/logout call is what made Sign Out feel stuck.
 */
export async function logoutStaff(redirectUrl: string = '/internal/'): Promise<void> {
  let refreshToken: string | null = null;
  try {
    const raw = localStorage.getItem(DIRECTUS_AUTH_KEY) || sessionStorage.getItem(DIRECTUS_AUTH_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      refreshToken = parsed?.refresh_token || parsed?.refreshToken || null;
    }
  } catch {}

  clearStaffClientSession();

  if (refreshToken) {
    try {
      fetch(`${DIRECTUS_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }

  const passwordInput = document.getElementById('unified-password') as HTMLInputElement | null;
  if (passwordInput) passwordInput.value = '';

  if (isStaffHubPath(window.location.pathname) && isStaffHubPath(redirectUrl.replace(/\?.*$/, ''))) {
    document.documentElement.classList.remove('staff-authenticated');
    resetLogoutButtons();
    window.history.replaceState({}, '', '/internal/');
    return;
  }

  window.location.replace(redirectUrl);
}

/**
 * Returns active Bearer token for API requests.
 * Prioritizes persistent HMAC staff token to prevent 15-minute token expiration dropouts.
 */
export async function getStaffToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  // 1. Persistent signed staff token (does not expire every 15m)
  const staffToken = getStoredHmacStaffToken();
  if (staffToken) return staffToken;

  // 2. Directus access token
  try {
    const raw = localStorage.getItem(DIRECTUS_AUTH_KEY) || sessionStorage.getItem(DIRECTUS_AUTH_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.access_token) return parsed.access_token;
    }
  } catch {}

  // 3. Directus SDK token lookup
  try {
    const token = await staffClient.getToken();
    if (token) return token;
  } catch {}

  return null;
}
