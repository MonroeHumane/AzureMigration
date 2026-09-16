/**
 * Client-Side Membership Program State & Sync Engine
 * 
 * Synchronizes public site references (Header, Footer, Mobile Drawer,
 * Homepage, Donate page, Resources, and /membership) with settings
 * managed in the Staff Portal Website Content Manager (localStorage: mchs_site_content_v2).
 */

export const STORAGE_KEY = 'mchs_site_content_v2';

export interface MembershipState {
  enabled: boolean;
  label?: string;
  title?: string;
  disabledLabel?: string;
  disabledTitle?: string;
  disabledNotice?: string;
  zeffyUrl?: string;
  tiers?: Record<string, { enabled: boolean; name?: string }>;
}

export const DEFAULT_MEMBERSHIP_STATE: MembershipState = {
  enabled: true,
  label: '2026 Memberships Now Open',
  title: 'Join the Monroe Humane Pack',
  disabledLabel: 'Under Development',
  disabledTitle: 'Program Details Are Under Development',
  disabledNotice:
    'Our annual membership program is currently undergoing review. Specific tiers, pricing, and perks have not yet been finalized by our board and staff for this cycle. Shirts and merch are sold at the shelter, and direct tax-deductible gifts can be made today.',
  zeffyUrl: 'https://www.zeffy.com/en-US/donation-form/donate-to-change-lives-22422',
  tiers: {
    'kitty-circle': { enabled: true, name: 'Kitty Circle' },
    'beagle-buddies': { enabled: true, name: 'Beagle Buddies' },
    'spaniel-squad': { enabled: true, name: 'Spaniel Squad' },
    'saint-bernard': { enabled: true, name: 'The Saint Bernard Society' },
    'lifetime-guardian': { enabled: true, name: 'Lifetime Guardian' },
  },
};

/**
 * Get current membership state from storage or default
 */
export function getMembershipState(): MembershipState {
  if (typeof window === 'undefined') return DEFAULT_MEMBERSHIP_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MEMBERSHIP_STATE;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.membership === 'object' && parsed.membership !== null) {
      return {
        ...DEFAULT_MEMBERSHIP_STATE,
        ...parsed.membership,
        tiers: {
          ...DEFAULT_MEMBERSHIP_STATE.tiers,
          ...(parsed.membership.tiers || {}),
        },
      };
    }
  } catch (e) {
    console.warn('[MembershipSync] Failed reading storage:', e);
  }
  return DEFAULT_MEMBERSHIP_STATE;
}

/**
 * Synchronize all DOM elements across the site to match the current membership state
 */
export function applyMembershipStateToDOM(state?: MembershipState): void {
  if (typeof document === 'undefined') return;
  const current = state || getMembershipState();
  const isEnabled = current.enabled !== false;

  // 1. Navigation & Header
  document.querySelectorAll<HTMLElement>('[data-nav-membership]').forEach((el) => {
    if (isEnabled) {
      el.textContent = 'Membership';
      el.classList.remove('text-stone-400');
    } else {
      el.textContent = 'Membership (coming soon)';
      el.classList.add('text-stone-400');
    }
  });

  // 2. Footer
  document.querySelectorAll<HTMLElement>('[data-footer-membership]').forEach((el) => {
    el.textContent = isEnabled ? 'Membership' : 'Membership (coming soon)';
  });

  // 3. Mobile Bottom Tab Drawer
  document.querySelectorAll<HTMLElement>('[data-bottom-sheet-membership]').forEach((el) => {
    if (isEnabled) {
      el.textContent = '2026 Membership Program';
      el.classList.remove('text-stone-400');
    } else {
      el.textContent = 'Membership (coming soon)';
      el.classList.add('text-stone-400');
    }
  });

  // 4. Donate Page Link
  document.querySelectorAll<HTMLElement>('[data-donate-membership]').forEach((el) => {
    el.textContent = isEnabled ? 'Become a Member' : 'Membership (coming soon)';
  });

  // 5. Resources Page Link
  document.querySelectorAll<HTMLElement>('[data-resources-membership]').forEach((el) => {
    el.textContent = isEnabled ? 'Membership Plans' : 'Membership (coming soon)';
  });

  // 6. Homepage Membership Section
  const homeActive = document.querySelector<HTMLElement>('[data-home-membership-active]');
  const homePaused = document.querySelector<HTMLElement>('[data-home-membership-paused]');
  if (homeActive && homePaused) {
    if (isEnabled) {
      homeActive.classList.remove('hidden');
      homePaused.classList.add('hidden');
    } else {
      homeActive.classList.add('hidden');
      homePaused.classList.remove('hidden');
      const noticeEl = homePaused.querySelector<HTMLElement>('[data-home-membership-notice-text]');
      if (noticeEl && current.disabledNotice) {
        noticeEl.textContent = current.disabledNotice;
      }
    }
  }

  // 7. /membership Dedicated Page
  const pageActive = document.querySelector<HTMLElement>('[data-membership-active]');
  const pagePaused = document.querySelector<HTMLElement>('[data-membership-paused]');
  if (pageActive && pagePaused) {
    if (isEnabled) {
      pageActive.classList.remove('hidden');
      pagePaused.classList.add('hidden');
    } else {
      pageActive.classList.add('hidden');
      pagePaused.classList.remove('hidden');
      const noticeTitleEl = pagePaused.querySelector<HTMLElement>('[data-membership-paused-title]');
      const noticeDescEl = pagePaused.querySelector<HTMLElement>('[data-membership-paused-desc]');
      if (noticeTitleEl && current.disabledTitle) {
        noticeTitleEl.textContent = current.disabledTitle;
      }
      if (noticeDescEl && current.disabledNotice) {
        noticeDescEl.textContent = current.disabledNotice;
      }
    }
  }

  // 8. Individual Tier Visibility (when Master is enabled)
  if (isEnabled && current.tiers) {
    Object.entries(current.tiers).forEach(([tierId, cfg]) => {
      const card = document.getElementById(`tier-card-${tierId}`);
      if (card) {
        if (cfg.enabled === false) {
          card.classList.add('opacity-40', 'grayscale', 'pointer-events-none');
        } else {
          card.classList.remove('opacity-40', 'grayscale', 'pointer-events-none');
        }
      }
    });
  }

  // 9. Zeffy Form URL Sync
  if (current.zeffyUrl) {
    document.querySelectorAll<HTMLAnchorElement>('[data-zeffy-membership-link]').forEach((el) => {
      const tierParam = el.getAttribute('data-zeffy-tier');
      if (tierParam) {
        const url = new URL(current.zeffyUrl!, window.location.origin);
        url.searchParams.set('tier', tierParam);
        el.href = url.toString();
      } else {
        el.href = current.zeffyUrl!;
      }
    });
  }
}

/**
 * Initialize auto-sync listener across tabs and page transitions
 */
export function initMembershipSync(): void {
  if (typeof window === 'undefined') return;

  // Run on initial paint
  applyMembershipStateToDOM();

  // Listen to cross-tab storage changes
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      applyMembershipStateToDOM();
    }
  });

  // Listen to same-window custom sync events
  window.addEventListener('mchs:membership-toggle', () => {
    applyMembershipStateToDOM();
  });

  // Hook into Astro ClientRouter navigations
  document.addEventListener('astro:page-load', () => {
    applyMembershipStateToDOM();
  });
}
