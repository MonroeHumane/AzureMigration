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
        // Must match api/src/index.js's server-side MAX_SESSION_AGE -- this is just an
        // early client-side check to avoid sending a token the server will reject anyway.
        const MAX_SESSION_AGE = 7 * 24 * 60 * 60 * 1000;
        if (Math.abs(Date.now() - payload.iat) > MAX_SESSION_AGE) {
          return false;
        }
      }
    }
  } catch {}
  return true;
}

export function createLocalStaffToken(email: string): string {
  const payload = {
    email: (email || 'staff@monroe-humane.org').toLowerCase().trim(),
    role: 'staff',
    iat: Date.now(),
  };
  const jsonStr = JSON.stringify(payload);
  let b64 = '';
  if (typeof btoa === 'function') {
    b64 = btoa(jsonStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } else if (typeof Buffer !== 'undefined') {
    b64 = Buffer.from(jsonStr).toString('base64url');
  }
  const sig = 'local_' + Math.random().toString(36).substring(2, 14);
  return `mchs_${b64}.${sig}`;
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

export interface EntraClientPrincipal {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
  claims?: Array<{ typ: string; val: string }>;
}

/**
 * Persists authenticated staff session to storage and updates HTML class.
 */
export function persistStaffSession(
  email: string,
  staffToken: string,
  directusPayload: any = null,
  rememberMe: boolean = true
): void {
  if (typeof window === 'undefined') return;

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

  if (typeof document !== 'undefined') {
    document.documentElement.classList.add('staff-authenticated');
  }
}

/**
 * Checks if the user is authenticated via Azure Static Web Apps' Microsoft Entra ID integration.
 * If authenticated with an authorized @monroe-humane.org account, exchanges the identity with
 * /api/session to obtain and persist the HMAC staff session token.
 */
export async function syncEntraAuthSession(): Promise<{
  authenticated: boolean;
  email?: string;
  error?: string;
}> {
  if (typeof window === 'undefined') return { authenticated: false };

  try {
    const res = await fetch('/.auth/me', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return { authenticated: isStaffAuthenticated() };

    const data = await res.json();
    const principal: EntraClientPrincipal | null = data?.clientPrincipal || null;

    if (!principal || !principal.userDetails) {
      return { authenticated: isStaffAuthenticated() };
    }

    const email = principal.userDetails.trim().toLowerCase();

    // Enforce @monroe-humane.org organization accounts
    if (!email.endsWith('@monroe-humane.org')) {
      return {
        authenticated: false,
        email,
        error: `Access is restricted to @monroe-humane.org accounts. You are currently signed in as ${email}.`,
      };
    }

    // If we already have an active staff token for this email, we are good to go!
    if (isStaffAuthenticated() && getStaffUserEmail().toLowerCase() === email) {
      return { authenticated: true, email };
    }

    // Exchange with /api/session (SWA automatically passes x-ms-client-principal)
    const sessionRes = await fetchWithTimeout('/api/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ entra_email: email }),
    }, 6000);

    if (sessionRes.ok) {
      const sData = await sessionRes.json();
      if (sData?.token && isStaffHmacToken(sData.token)) {
        persistStaffSession(email, sData.token, null, true);
        return { authenticated: true, email };
      }
    } else if (sessionRes.status === 403) {
      const errData = await sessionRes.json().catch(() => null);
      return {
        authenticated: false,
        email,
        error: errData?.error || `Access restricted to @monroe-humane.org accounts.`,
      };
    }
  } catch (err) {
    console.warn('[StaffAuth] Failed to sync Entra session:', err);
  }

  return { authenticated: isStaffAuthenticated() };
}

const PASSKEY_SALT = 'mchs_auth_salt_2026:';
const AUTHORIZED_PASSKEY_HASHES = new Set([
  '81d67611cacb1c57e3dcaad10149527c15e5d8c0d688387a89ab2103f395adea', // Shelt3r2025!
  '132dc4358c04abc3ec4deadd7e97a0093e6dd2964652165a9fe7ac42606cefec', // MonroeStaff2026!
  'adcc5590a29c3e8acd51b454cfdfbc60f6a333005830000145b78fd10a699ce7', // monroestaff2026!
  'd88bfa47c664f94d2c53244c6dc0cfe5cafac93dd1f35499cc9f80b1844928bc', // MonroeShelter2026!
  'bd1ecc303ac5d6c87e1ec715daa987a3659e047ba7dcddeb682c99cba9d3ef9c', // monroeshelter2026!
  '49edc24e035cc3047300a56491c1aba1b636c3af44cc242824a77f13419f1c09', // monroecare2026!
  '7ad9fca9842975f74137ea4f21c06f6e718c17031ad61c2d2cfd9de98fe7c173', // MonroeCare2026!
]);

export async function isAuthorizedPasskey(pass: string): Promise<boolean> {
  const clean = (pass || '').trim();
  if (!clean) return false;
  try {
    const salted = PASSKEY_SALT + clean;
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const data = new TextEncoder().encode(salted);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return AUTHORIZED_PASSKEY_HASHES.has(hashHex);
    }
  } catch (e) {
    console.error('[StaffAuth] Passkey hash verification error:', e);
  }
  return false;
}

/**
 * Sign in through /api/login or local verified shelter passkey.
 */
export async function loginStaff(opts: {
  email: string;
  password: string;
  rememberMe?: boolean;
}): Promise<void> {
  // Frontend Rate Limiting for Login
  const LOCKOUT_KEY = 'mchs_login_lockout';
  const ATTEMPTS_KEY = 'mchs_login_attempts';
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION_MS = 5 * 60 * 1000;

  try {
    const lockoutUntil = parseInt(localStorage.getItem(LOCKOUT_KEY) || '0', 10);
    if (lockoutUntil > Date.now()) {
      const minLeft = Math.ceil((lockoutUntil - Date.now()) / 60000);
      throw new Error(`Too many failed attempts. Please try again in ${minLeft} minute(s).`);
    } else if (lockoutUntil !== 0) {
      localStorage.removeItem(LOCKOUT_KEY);
      localStorage.removeItem(ATTEMPTS_KEY);
    }
  } catch (e: any) {
    if (e.message.includes('Too many failed')) throw e;
  }

  const { password, rememberMe = true } = opts;
  const email = (opts.email || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();

  // Validate salted passkey hash asynchronously
  const hasValidPasskey = await isAuthorizedPasskey(cleanPass);

  if (hasValidPasskey) {
    const localToken = createLocalStaffToken(email || 'staff@monroe-humane.org');
    try {
      localStorage.removeItem(ATTEMPTS_KEY);
      localStorage.removeItem(LOCKOUT_KEY);
    } catch {}
    persistStaffSession(email || 'staff@monroe-humane.org', localToken, null, rememberMe);
    return;
  }

  // If not a recognized local passkey, attempt cloud identity service (if online)
  let staffToken: string | null = null;
  let directusPayload: any = null;

  try {
    const res = await fetchWithTimeout('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }, 4000);

    if (res.ok) {
      const data = await res.json();
      if (data && data.token) {
        staffToken = data.token;
        directusPayload = data.directus ? normalizeDirectusAuth(data.directus) : null;
        localStorage.removeItem(ATTEMPTS_KEY);
        localStorage.removeItem(LOCKOUT_KEY);
      }
    }
  } catch (apiErr) {
    // Cloud API offline/unavailable, continue to Directus or rejection
  }

  if (!staffToken) {
    let sdkTimer: any = null;
    try {
      await Promise.race([
        staffClient.login({ email, password }),
        new Promise((_, reject) => {
          sdkTimer = setTimeout(() => {
            reject(Object.assign(new Error('Directus login timed out'), { name: 'AbortError' }));
          }, 4000);
        }),
      ]);
      const dt = await staffClient.getToken();
      if (dt) {
        staffToken = await exchangeDirectusTokenForStaffSession(email, dt);
        try {
          const stored = getAuthStorage().get();
          if (stored) directusPayload = stored;
          localStorage.removeItem(ATTEMPTS_KEY);
          localStorage.removeItem(LOCKOUT_KEY);
        } catch {}
      }
    } catch (sdkErr: any) {
      // Cloud identity failed or offline and not a valid shelter passkey
      try {
        let attempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0', 10) + 1;
        localStorage.setItem(ATTEMPTS_KEY, attempts.toString());
        if (attempts >= MAX_ATTEMPTS) {
          localStorage.setItem(LOCKOUT_KEY, (Date.now() + LOCKOUT_DURATION_MS).toString());
          throw new Error(`Too many failed attempts. Please try again in 5 minutes.`);
        }
      } catch (lockoutErr: any) {
        if (lockoutErr.message?.includes('Too many failed')) throw lockoutErr;
      }

      throw new Error('Invalid credentials. Please verify your staff email and shelter passkey.');
    } finally {
      if (sdkTimer) clearTimeout(sdkTimer);
    }
  }

  if (!isStaffHmacToken(staffToken)) {
    throw new Error('Invalid credentials or authentication service offline.');
  }

  // 3. Persist tokens respecting Remember Me security preferences:
  persistStaffSession(email, staffToken, directusPayload, rememberMe);
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

  // In production SWA, clear the Microsoft Entra session cookie via /.auth/logout
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    window.location.replace(`/.auth/logout?post_logout_redirect_uri=${encodeURIComponent(redirectUrl)}`);
    return;
  }

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

/**
 * Idle Session Timeout
 * Logs out staff automatically after 15 minutes of inactivity.
 */
export function initIdleTimeout(timeoutMinutes = 15): void {
  if (typeof window === 'undefined') return;

  const IDLE_TIMEOUT_MS = timeoutMinutes * 60 * 1000;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    if (!isStaffAuthenticated()) return;
    
    idleTimer = setTimeout(() => {
      console.warn(`[StaffAuth] Idle timeout reached (${timeoutMinutes}m). Signing out.`);
      logoutStaff('/internal/?reauth=idle');
    }, IDLE_TIMEOUT_MS);
  }

  // Monitor basic interaction events
  const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
  events.forEach(evt => document.addEventListener(evt, resetIdleTimer, { passive: true }));
  
  // Call once to initialize
  resetIdleTimer();
}
