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
const FINANCIALS_CACHE_STAMP_KEY = 'mchs_financials_cache_v1_at';

/**
 * Without an expiry this cache survives in localStorage indefinitely, so two
 * staff members can sit on payloads written weeks apart and disagree about what
 * the portal contains. The stamp lives in its own key to keep the cached payload
 * shape untouched for existing readers.
 */
const FINANCIALS_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

function cacheAge(): number | null {
  try {
    const raw = sessionStorage.getItem(FINANCIALS_CACHE_STAMP_KEY) || localStorage.getItem(FINANCIALS_CACHE_STAMP_KEY);
    const at = raw ? Number(raw) : NaN;
    return Number.isFinite(at) ? Date.now() - at : null;
  } catch {
    return null;
  }
}

let memoryCache: any | null = null;
let memoryCacheAt: number = 0;

export function getCachedFinancialsAge(): number | null {
  if (memoryCacheAt > 0) return Date.now() - memoryCacheAt;
  return cacheAge();
}

export function clearCachedFinancials(): void {
  if (typeof window === 'undefined') return;
  memoryCache = null;
  memoryCacheAt = 0;
  try {
    sessionStorage.removeItem(FINANCIALS_CACHE_KEY);
    localStorage.removeItem(FINANCIALS_CACHE_KEY);
    sessionStorage.removeItem(FINANCIALS_CACHE_STAMP_KEY);
    localStorage.removeItem(FINANCIALS_CACHE_STAMP_KEY);
  } catch {}
}

export function getCachedFinancials(): any | null {
  if (typeof window === 'undefined') return null;
  
  // ClientRouter keeps JS context alive. Use in-memory cache to avoid 
  // blocking the main thread with a 5MB+ JSON.parse() on every page swap.
  if (memoryCache && (Date.now() - memoryCacheAt < FINANCIALS_CACHE_TTL_MS)) {
    return memoryCache;
  }
  
  try {
    const raw = sessionStorage.getItem(FINANCIALS_CACHE_KEY) || localStorage.getItem(FINANCIALS_CACHE_KEY);
    if (!raw) return null;
    const age = cacheAge();
    if (age === null || age > FINANCIALS_CACHE_TTL_MS) {
      clearCachedFinancials();
      return null;
    }
    const parsed = JSON.parse(raw);
    memoryCache = parsed;
    memoryCacheAt = Date.now() - age; // preserve original fetch timestamp
    return parsed;
  } catch {
    return null;
  }
}

export function setCachedFinancials(data: any): void {
  if (typeof window === 'undefined' || !data) return;
  
  memoryCache = data;
  memoryCacheAt = Date.now();
  
  try {
    const str = JSON.stringify(data);
    const now = String(Date.now());
    sessionStorage.setItem(FINANCIALS_CACHE_KEY, str);
    localStorage.setItem(FINANCIALS_CACHE_KEY, str);
    sessionStorage.setItem(FINANCIALS_CACHE_STAMP_KEY, now);
    localStorage.setItem(FINANCIALS_CACHE_STAMP_KEY, now);
  } catch (err) {
    console.warn('[StaffFinancials] Failed to write cache to Web Storage (quota exceeded?):', err);
  }
}

