import { getStaffToken, getStoredVaultPasskey, setStoredVaultPasskey } from './staff-auth';
import { getCachedFinancials, setCachedFinancials, getCachedFinancialsAge } from './api';
import { FinancialPayloadSchema } from './schemas';
import { decryptFinancialVault } from './staff-vault';

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
    'rounded-xl px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3',
  ].join(' ');

  const text = document.createElement('span');
  text.textContent =
    message ||
    (state === 'loading'
      ? 'Loading…'
      : 'Could not load board financials. Check your session and try again.');
  el.replaceChildren(text);

  if (state === 'error' && message?.includes('passkey')) {
    const form = document.createElement('form');
    form.className = 'flex items-center gap-2 mt-2 sm:mt-0 flex-wrap sm:flex-nowrap';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input') as HTMLInputElement | null;
      if (input && input.value.trim()) {
        setStoredVaultPasskey(input.value.trim(), true);
        if (onRetry) onRetry();
      }
    });

    const input = document.createElement('input');
    input.type = 'password';
    input.placeholder = 'Shelter passkey';
    input.className = 'px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-teal-700 bg-white dark:bg-[#081a17] text-slate-900 dark:text-emerald-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500';

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#173a39] text-white hover:bg-teal-900 transition cursor-pointer';
    submitBtn.textContent = 'Unlock Vault';

    form.appendChild(input);
    form.appendChild(submitBtn);
    el.appendChild(form);
  } else if (state === 'error' && onRetry) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'staff-data-status__retry';
    btn.textContent = 'Retry';
    btn.addEventListener('click', onRetry);
    el.appendChild(btn);
  }
}

/**
 * Attempts to load and decrypt the AES-256-GCM financial vault bundle
 * using the authorized session passkey in zero-backend / static environments.
 */
async function tryLoadDecryptedVault(): Promise<any | null> {
  try {
    const passkey = getStoredVaultPasskey();
    if (!passkey) {
      return null;
    }
    const res = await fetch('/internal/vault/financials.enc.json', {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return null;
    }
    const vaultBundle = await res.json();
    const decrypted = await decryptFinancialVault(vaultBundle, passkey);
    if (!decrypted) return null;
    const validated = FinancialPayloadSchema.parse(decrypted);
    setCachedFinancials(validated);
    return validated;
  } catch (err) {
    console.warn('[StaffFinancials] Vault decryption/validation failed:', err);
    return null;
  }
}

/**
 * Single authenticated fetch for hub, board, and donor pages.
 * Uses the in-browser cache, then refreshes from GET /api/financials or encrypted vault.
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

  // 1. Zero-backend AES-256-GCM vault (GitHub Pages Permanent $0 stack)
  // When an authorized passkey is active, decrypt directly in-browser without throwing 404s
  if (getStoredVaultPasskey()) {
    const vaultData = await tryLoadDecryptedVault();
    if (vaultData?.headline_kpis) {
      return { ok: true, data: vaultData, fromCache: false };
    }
  }

  // 2. Attempt live API endpoint only if running in a server-backed environment
  const isServerEnv = typeof window !== 'undefined' &&
    (window.location.hostname.includes('azure') || Boolean((window as any).__MCHS_API_URL__));
  if (isServerEnv) {
    try {
      const res = await fetch('/api/financials', {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Staff-Token': token,
          'X-Authorization': `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const rawData = await res.json();
        if (rawData) {
          const data = FinancialPayloadSchema.parse(rawData);
          setCachedFinancials(data);
          return { ok: true, data, fromCache: false };
        }
      }
    } catch {
      // API endpoint unavailable or timed out; fall through to vault/cache
    }
  }

  // 3. Fallback attempt to decrypt vault
  const vaultData = await tryLoadDecryptedVault();
  if (vaultData?.headline_kpis) {
    return { ok: true, data: vaultData, fromCache: false };
  }

  // 3. Fall back to cached copy if available
  const fallbackCache = getCachedFinancials();
  if (fallbackCache?.headline_kpis) {
    return { ok: true, data: fallbackCache, fromCache: true };
  }

  return { ok: false, status: 0, error: 'Financials unavailable. Please verify your shelter passkey.' };
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
