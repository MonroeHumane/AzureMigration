/**
 * Simple fetch wrapper that avoids triggering Directus SDK's automatic logout.
 * It performs a plain `fetch` and returns the response unchanged.
 * The optional `ignoreAutoLogout` flag is present for future extensibility.
 */
export async function apiFetch(
  input: RequestInfo,
  init: RequestInit = {},
  _options: { ignoreAutoLogout?: boolean } = {}
): Promise<Response> {
  const response = await fetch(input, init);
  return response;
}

/** Retrieve the persisted staff token from storage with Directus fallback without invoking Directus SDK. */
export function getStoredStaffToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token =
    localStorage.getItem('mchs_staff_token') ||
    sessionStorage.getItem('mchs_staff_token');
  if (token) return token;

  try {
    const raw = localStorage.getItem('directus_auth') || sessionStorage.getItem('directus_auth');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.access_token) return parsed.access_token;
    }
  } catch {}

  return null;
}

export const FINANCIALS_CACHE_KEY = 'mchs_financials_cache_v1';

export function getCachedFinancials(): any | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(FINANCIALS_CACHE_KEY) || localStorage.getItem(FINANCIALS_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCachedFinancials(data: any): void {
  if (typeof window === 'undefined' || !data) return;
  try {
    const str = JSON.stringify(data);
    sessionStorage.setItem(FINANCIALS_CACHE_KEY, str);
    localStorage.setItem(FINANCIALS_CACHE_KEY, str);
  } catch {}
}

