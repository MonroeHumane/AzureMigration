/**
 * Reactive Network & Encrypted Vault Status Monitor
 * Humane Society of Monroe County — Staff Ops
 *
 * Keeps staff informed about connectivity status and confirms that local
 * cryptographic vault, offline mutations, & census caches remain fully operational.
 */

import { getPendingMutations, initOfflineQueueAutoSync } from './offline-mutation-queue';

export function initNetworkMonitor(): void {
  if (typeof window === 'undefined') return;

  function updateStatus() {
    const isOnline = navigator.onLine;
    const pending = getPendingMutations();
    const pendingCount = pending.length;

    // Desktop Sidebar indicator
    const sidebarDot = document.getElementById('sidebar-net-dot');
    const sidebarText = document.getElementById('sidebar-net-text');
    if (sidebarDot) {
      if (!isOnline) {
        sidebarDot.className = 'w-2 h-2 rounded-full bg-amber-500 animate-pulse';
      } else if (pendingCount > 0) {
        sidebarDot.className = 'w-2 h-2 rounded-full bg-teal-500 animate-pulse';
      } else {
        sidebarDot.className = 'w-2 h-2 rounded-full bg-emerald-500';
      }
    }
    if (sidebarText) {
      if (!isOnline) {
        sidebarText.textContent = pendingCount > 0 ? `Offline (${pendingCount} queued)` : 'Offline (Local Vault)';
        sidebarText.className = 'text-amber-700 dark:text-amber-400 font-semibold';
      } else {
        sidebarText.textContent = 'System Online';
        sidebarText.className = 'text-slate-700 dark:text-slate-200 font-semibold';
      }
    }

    // Top Header / Mobile Nav indicator
    const navDot = document.getElementById('nav-network-dot');
    const navText = document.getElementById('nav-network-text');
    if (navDot) {
      navDot.className = isOnline
        ? 'w-2 h-2 rounded-full bg-emerald-400'
        : 'w-2 h-2 rounded-full bg-amber-400 animate-pulse';
    }
    if (navText) {
      navText.innerHTML = isOnline
        ? 'Vault: <strong class="text-slate-900 dark:text-white font-medium">Online</strong>'
        : 'Mode: <strong class="text-amber-600 dark:text-amber-400 font-medium">Offline</strong>';
    }
  }

  if (!(window as any).__hsmc_net_bound) {
    (window as any).__hsmc_net_bound = true;
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    window.addEventListener('mchs:mutations-changed', updateStatus);
    initOfflineQueueAutoSync();
  }

  updateStatus();
}
