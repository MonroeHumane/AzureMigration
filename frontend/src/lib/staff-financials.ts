import { getStaffToken } from './staff-auth';
import { getCachedFinancials, setCachedFinancials } from './api';

export type StaffFinancialsOk = { ok: true; data: any; fromCache: boolean };
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

export function cashRunwayMonths(data: any): string | null {
  const kpis = data?.headline_kpis;
  if (!kpis) return null;
  const checking = kpis.bank_register_cash || kpis.operating_checking_first_merchants || 0;
  const liquidity = checking + (kpis.fidelity_reserve || 0);
  const monthlyNet = Math.abs((kpis.qbo_operating_net || 0) / 8);
  if (!monthlyNet) return null;
  return `${(liquidity / monthlyNet).toFixed(1)} months`;
}

export function publishedLabel(data: any): string {
  const meta = data?.meta;
  if (!meta?.period_title && !meta?.cutoff_date) return 'Board packet';
  const period = meta.period_title || '2026 YTD';
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
  el.className =
    state === 'loading'
      ? 'rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950 flex items-center justify-between gap-3'
      : 'rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 flex items-center justify-between gap-3';

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
    btn.className =
      'shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-amber-300 text-amber-950 hover:bg-amber-100';
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
        return { ok: true, data: fallbackCache, fromCache: true };
      }
      return { ok: false, status: res.status, error: 'Unauthorized to load live financials.' };
    }
    if (!res.ok) {
      const fallbackCache = getCachedFinancials();
      if (fallbackCache?.headline_kpis) {
        return { ok: true, data: fallbackCache, fromCache: true };
      }
      return { ok: false, status: res.status, error: `Financials unavailable (${res.status})` };
    }
    const data = await res.json();
    if (!data) {
      return { ok: false, status: 502, error: 'Empty financials response' };
    }
    setCachedFinancials(data);
    return { ok: true, data, fromCache: false };
  } catch {
    const fallbackCache = getCachedFinancials();
    if (fallbackCache?.headline_kpis) {
      return { ok: true, data: fallbackCache, fromCache: true };
    }
    return { ok: false, status: 0, error: 'Network error loading financials' };
  }
}

export async function refreshStaffFinancials(): Promise<StaffFinancialsOk | StaffFinancialsErr> {
  return fetchStaffFinancials({ allowCache: false });
}
