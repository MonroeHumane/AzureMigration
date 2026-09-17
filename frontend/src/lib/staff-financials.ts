import { getStaffToken } from './staff-auth';
import { getCachedFinancials, setCachedFinancials, getCachedFinancialsAge } from './api';
import { FinancialPayloadSchema } from './schemas';
import bundledFinancials from '../data/published_2026_ytd.json';

/**
 * `staleAuth` means the live call was rejected (401/403) and we fell back to a
 * previously cached payload. The data may be old and is missing anything the
 * server has added since, so callers should not blame the server for gaps.
 */
export type StaffFinancialsOk = { ok: true; data: any; fromCache: boolean; staleAuth?: boolean };
export type StaffFinancialsErr = { ok: false; status: number; error: string };

export function formatUsd(val: number, digits = 0): string {
  const isNeg = val < 0;
  const abs = Math.abs(val);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(abs);
  return isNeg ? `(${formatted})` : formatted;
}

export function firstMerchantsChecking(data: any): number | null {
  const fromKpis = data?.headline_kpis?.operating_checking_first_merchants;
  if (typeof fromKpis === 'number') return fromKpis;
  const fromPosition = data?.statement_of_position?.assets?.operating_checking_first_merchants;
  if (typeof fromPosition === 'number') return fromPosition;
  return null;
}

export function publishedLabel(data: any): string {
  const meta = data?.meta;
  if (!meta?.period_title && !meta?.cutoff_date) return 'Board packet';
  const period = meta.period_title || 'Year-To-Date';
  const cut = meta.cutoff_date ? ` · closed ${meta.cutoff_date}` : '';
  return `${period}${cut}`;
}

export function setStaffDataStatus(
  id: string,
  state: 'loading' | 'ready' | 'error' | 'hidden',
  message?: string,
  onRetry?: () => void
): void {
  const el = document.getElementById(id);
  if (!el) return;
  if (state === 'hidden' || state === 'ready') {
    el.classList.add('hidden');
    el.replaceChildren();
    return;
  }

  el.classList.remove('hidden');
  el.className = [
    'staff-data-status',
    state === 'loading' ? 'staff-data-status--loading' : 'staff-data-status--error',
    'rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-3',
  ].join(' ');

  const text = document.createElement('span');
  text.textContent =
    message ||
    (state === 'loading'
      ? 'Loading…'
      : 'Could not load board financials. Check your session and try again.');
  el.replaceChildren(text);

  if (state === 'error' && onRetry) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'staff-data-status__retry';
    btn.textContent = 'Retry';
    btn.addEventListener('click', onRetry);
    el.appendChild(btn);
  }
}

/**
 * Single authenticated fetch for hub, board, and donor pages.
 * Uses the in-browser cache, then refreshes from GET /api/financials.
 */
export async function fetchStaffFinancials(opts: { allowCache?: boolean } = {}): Promise<StaffFinancialsOk | StaffFinancialsErr> {
  const allowCache = opts.allowCache !== false;
  const cached = allowCache ? getCachedFinancials() : null;
  if (cached?.headline_kpis) {
    return { ok: true, data: cached, fromCache: true };
  }

  const token = await getStaffToken();
  if (!token) {
    return { ok: false, status: 401, error: 'No staff session' };
  }

  try {
    const res = await fetch('/api/financials', {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Staff-Token': token,
        'X-Authorization': `Bearer ${token}`,
      },
    });
    if (res.status === 401 || res.status === 403) {
      console.warn('[StaffFinancials] /api/financials returned', res.status);
      const fallbackCache = getCachedFinancials();
      if (fallbackCache?.headline_kpis) {
        return { ok: true, data: fallbackCache, fromCache: true, staleAuth: true };
      }
      return { ok: false, status: res.status, error: 'Unauthorized to load live financials.' };
    }
    if (!res.ok) {
      const fallbackCache = getCachedFinancials();
      if (fallbackCache?.headline_kpis) {
        return { ok: true, data: fallbackCache, fromCache: true };
      }
      if ((bundledFinancials as any)?.headline_kpis) {
        return { ok: true, data: bundledFinancials, fromCache: true };
      }
      return { ok: false, status: res.status, error: `Financials unavailable (${res.status})` };
    }
    const rawData = await res.json();
    if (!rawData) {
      return { ok: false, status: 502, error: 'Empty financials response' };
    }
    
    // Parse using our strict Zod schemas to ensure end-to-end type safety
    const data = FinancialPayloadSchema.parse(rawData);
    
    setCachedFinancials(data);
    return { ok: true, data, fromCache: false };
  } catch {
    const fallbackCache = getCachedFinancials();
    if (fallbackCache?.headline_kpis) {
      return { ok: true, data: fallbackCache, fromCache: true };
    }
    if ((bundledFinancials as any)?.headline_kpis) {
      return { ok: true, data: bundledFinancials, fromCache: true };
    }
    return { ok: false, status: 0, error: 'Network error loading financials' };
  }
}

export async function refreshStaffFinancials(force: boolean = false): Promise<StaffFinancialsOk | StaffFinancialsErr> {
  if (!force) {
    const age = getCachedFinancialsAge();
    // 5MB payloads: If less than 5 minutes old, skip network and return from memory cache
    if (age !== null && age < 5 * 60 * 1000) {
      const cached = getCachedFinancials();
      if (cached) {
        return { ok: true, data: cached, fromCache: true };
      }
    }
  }
  return fetchStaffFinancials({ allowCache: false });
}
