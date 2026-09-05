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
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    set(data: any) {
      try {
        if (data) {
          const str = JSON.stringify(data);
          localStorage.setItem(DIRECTUS_AUTH_KEY, str);
          sessionStorage.setItem(DIRECTUS_AUTH_KEY, str);
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

/**
 * Synchronous client-side check whether staff is authenticated.
 * Session remains active until explicit logout on this browser.
 */
export function isStaffAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    if (
      localStorage.getItem(STAFF_AUTH_FLAG) === 'true' ||
      sessionStorage.getItem(STAFF_AUTH_FLAG) === 'true'
    ) {
      return true;
    }

    if (
      localStorage.getItem(STAFF_TOKEN_KEY) ||
      sessionStorage.getItem(STAFF_TOKEN_KEY)
    ) {
      return true;
    }

    const raw = localStorage.getItem(DIRECTUS_AUTH_KEY) || sessionStorage.getItem(DIRECTUS_AUTH_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return !!(parsed && (parsed.access_token || parsed.refresh_token));
    }
  } catch {
    return false;
  }

  return false;
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
 * Executes login via /api/login and Directus SDK, saves persistent tokens and user flags.
 */
export async function loginStaff(opts: {
  email: string;
  password: string;
  rememberMe?: boolean;
}): Promise<void> {
  const { email, password, rememberMe = true } = opts;

  let staffToken: string | null = null;
  let directusPayload: any = null;

  // 1. Primary: Authenticate through Azure Functions /api/login
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.token) {
        staffToken = data.token;
        directusPayload = data.directus;
      }
    } else if (res.status === 401) {
      throw new Error('Invalid email or password. Please verify your credentials.');
    }
  } catch (err: any) {
    if (err.message && err.message.includes('Invalid email or password')) {
      throw err;
    }
    console.warn('[StaffAuth] /api/login call failed, falling back to Directus SDK:', err);
  }

  // 2. Directus SDK authentication (for CMS items access)
  try {
    await staffClient.login({ email, password });
    if (!staffToken) {
      const dt = await staffClient.getToken();
      if (dt) {
        // Exchange Directus token for HMAC staff session token
        try {
          const sRes = await fetch('/api/session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${dt}`,
            },
            body: JSON.stringify({ email }),
          });
          if (sRes.ok) {
            const sData = await sRes.json();
            if (sData && sData.token) {
              staffToken = sData.token;
            }
          }
        } catch {}
      }
    }
  } catch (sdkErr: any) {
    if (!staffToken) {
      throw sdkErr;
    }
  }

  // 3. Persist session data in localStorage for cross-tab persistence
  localStorage.setItem(STAFF_AUTH_FLAG, 'true');
  localStorage.setItem(STAFF_USER_KEY, email);
  if (rememberMe) {
    localStorage.setItem(STAFF_REMEMBER_KEY, 'true');
  }

  if (staffToken) {
    localStorage.setItem(STAFF_TOKEN_KEY, staffToken);
    sessionStorage.setItem(STAFF_TOKEN_KEY, staffToken);
  }

  if (directusPayload) {
    const str = JSON.stringify(directusPayload);
    localStorage.setItem(DIRECTUS_AUTH_KEY, str);
    sessionStorage.setItem(DIRECTUS_AUTH_KEY, str);
  }

  // Update HTML class immediately for zero-flicker UI
  if (typeof document !== 'undefined') {
    document.documentElement.classList.add('staff-authenticated');
  }
}

/**
 * Signs out of Staff Portal (revokes remote token and wipes all client-side storage).
 * Only invoked when user explicitly clicks "Sign Out".
 */
export async function logoutStaff(redirectUrl: string = '/internal/'): Promise<void> {
  try {
    await staffClient.logout();
  } catch {}

  try {
    localStorage.removeItem(DIRECTUS_AUTH_KEY);
    localStorage.removeItem(STAFF_AUTH_FLAG);
    localStorage.removeItem(STAFF_USER_KEY);
    localStorage.removeItem(STAFF_TOKEN_KEY);
    localStorage.removeItem(STAFF_REMEMBER_KEY);

    sessionStorage.removeItem(DIRECTUS_AUTH_KEY);
    sessionStorage.removeItem(STAFF_AUTH_FLAG);
    sessionStorage.removeItem(STAFF_USER_KEY);
    sessionStorage.removeItem(STAFF_TOKEN_KEY);
    sessionStorage.removeItem(STAFF_REMEMBER_KEY);

    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('staff-authenticated');
    }
  } catch {}

  window.location.href = redirectUrl;
}

/**
 * Returns active Bearer token for API requests.
 * Prioritizes persistent HMAC staff token to prevent 15-minute token expiration dropouts.
 */
export async function getStaffToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  // 1. Persistent signed staff token (does not expire every 15m)
  const staffToken = localStorage.getItem(STAFF_TOKEN_KEY) || sessionStorage.getItem(STAFF_TOKEN_KEY);
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
