import { createDirectus, rest, authentication } from '@directus/sdk';

export const DIRECTUS_URL = 'https://mchs-directus.livelyfield-d0a70609.eastus.azurecontainerapps.io';

export const DIRECTUS_AUTH_KEY = 'directus_auth';
export const STAFF_AUTH_FLAG = 'mchs_staff_auth';
export const STAFF_USER_KEY = 'mchs_staff_user';
export const STAFF_REMEMBER_KEY = 'mchs_staff_remember';

/**
 * Storage adapter for Directus authentication SDK that respects "Remember Me".
 * If Remember Me is true, tokens persist in localStorage; otherwise sessionStorage.
 */
function getAuthStorage() {
  return {
    get() {
      try {
        const raw = sessionStorage.getItem(DIRECTUS_AUTH_KEY) || localStorage.getItem(DIRECTUS_AUTH_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    set(data: any) {
      try {
        if (data) {
          const remember = localStorage.getItem(STAFF_REMEMBER_KEY) === 'true';
          const str = JSON.stringify(data);
          if (remember) {
            localStorage.setItem(DIRECTUS_AUTH_KEY, str);
            sessionStorage.removeItem(DIRECTUS_AUTH_KEY);
          } else {
            sessionStorage.setItem(DIRECTUS_AUTH_KEY, str);
            localStorage.removeItem(DIRECTUS_AUTH_KEY);
          }
        } else {
          sessionStorage.removeItem(DIRECTUS_AUTH_KEY);
          localStorage.removeItem(DIRECTUS_AUTH_KEY);
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
 * Synchronous client-side check whether staff credentials or active tokens are present.
 * Also checks Directus token expiration timestamps to avoid zombie sessions.
 */
export function isStaffAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const raw = sessionStorage.getItem(DIRECTUS_AUTH_KEY) || localStorage.getItem(DIRECTUS_AUTH_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // If we have an expires_at timestamp and both access_token and refresh_token are missing, invalid
      if (parsed.expires_at && parsed.expires_at < Date.now() && !parsed.refresh_token) {
        return false;
      }
      return !!(parsed.access_token || parsed.refresh_token);
    }

    // Fallback legacy flag
    return !!(
      sessionStorage.getItem(STAFF_AUTH_FLAG) ||
      localStorage.getItem(STAFF_AUTH_FLAG)
    );
  } catch {
    return false;
  }
}

/**
 * Returns the currently signed-in staff email or identifier.
 */
export function getStaffUserEmail(): string {
  if (typeof window === 'undefined') return 'staff@monroe-humane.org';
  return (
    sessionStorage.getItem(STAFF_USER_KEY) ||
    localStorage.getItem(STAFF_USER_KEY) ||
    'staff@monroe-humane.org'
  );
}

/**
 * Executes login via Directus SDK, saves tokens and user flags, and sets document state.
 */
export async function loginStaff(opts: {
  email: string;
  password: string;
  rememberMe?: boolean;
}): Promise<void> {
  const { email, password, rememberMe = true } = opts;

  // Set remember flag prior to client.login() so the storage adapter directs tokens properly
  if (rememberMe) {
    localStorage.setItem(STAFF_REMEMBER_KEY, 'true');
  } else {
    localStorage.removeItem(STAFF_REMEMBER_KEY);
  }

  // Authenticate with Directus (stores tokens in storage adapter)
  await staffClient.login({ email, password });

  // Save staff flags in matching storage
  if (rememberMe) {
    localStorage.setItem(STAFF_AUTH_FLAG, 'true');
    localStorage.setItem(STAFF_USER_KEY, email);
    sessionStorage.removeItem(STAFF_AUTH_FLAG);
    sessionStorage.removeItem(STAFF_USER_KEY);
  } else {
    sessionStorage.setItem(STAFF_AUTH_FLAG, 'true');
    sessionStorage.setItem(STAFF_USER_KEY, email);
    localStorage.removeItem(STAFF_AUTH_FLAG);
    localStorage.removeItem(STAFF_USER_KEY);
  }

  // Update HTML class immediately
  if (typeof document !== 'undefined') {
    document.documentElement.classList.add('staff-authenticated');
  }
}

/**
 * Signs out of Directus (revoking refresh token on server) and wipes client-side storage.
 */
export async function logoutStaff(redirectUrl: string = '/internal'): Promise<void> {
  try {
    await staffClient.logout();
  } catch {
    // Best-effort remote revocation; always proceed with client wipe
  }

  try {
    sessionStorage.removeItem(DIRECTUS_AUTH_KEY);
    sessionStorage.removeItem(STAFF_AUTH_FLAG);
    sessionStorage.removeItem(STAFF_USER_KEY);
    localStorage.removeItem(DIRECTUS_AUTH_KEY);
    localStorage.removeItem(STAFF_AUTH_FLAG);
    localStorage.removeItem(STAFF_USER_KEY);
    localStorage.removeItem(STAFF_REMEMBER_KEY);

    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('staff-authenticated');
    }
  } catch {}

  window.location.href = redirectUrl;
}

/**
 * Helper to ensure active Directus token is valid or refreshed.
 */
export async function getStaffToken(): Promise<string | null> {
  try {
    return await staffClient.getToken();
  } catch {
    return null;
  }
}
