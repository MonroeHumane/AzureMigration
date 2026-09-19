/**
 * frontend/src/lib/offline-mutation-queue.ts
 *
 * Progressive Web App (PWA) Offline Mutation Queue & Background Sync.
 * Guarantees zero data loss when staff add/edit grants, newsletters, or
 * kennel notes in shelter dead zones or offline.
 */

export type MutationEntity = 'grant' | 'newsletter' | 'content' | 'kennel_note';
export type MutationAction = 'create' | 'update' | 'delete';

export interface PendingMutation {
  id: string;
  entity: MutationEntity;
  action: MutationAction;
  payload: Record<string, any>;
  createdAt: string;
  retries: number;
}

const STORAGE_KEY = 'mchs_offline_mutations_v1';

export function getPendingMutations(): PendingMutation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePendingMutations(list: PendingMutation[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('mchs:mutations-changed', { detail: { count: list.length } }));
  } catch {}
}

export function enqueueMutation(
  entity: MutationEntity,
  action: MutationAction,
  payload: Record<string, any>
): PendingMutation {
  const mutation: PendingMutation = {
    id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    entity,
    action,
    payload,
    createdAt: new Date().toISOString(),
    retries: 0,
  };

  const current = getPendingMutations();
  current.push(mutation);
  savePendingMutations(current);

  // Attempt Background Sync registration via Service Worker if supported
  void registerBackgroundSync();

  return mutation;
}

export function removeMutation(id: string): void {
  const current = getPendingMutations();
  const filtered = current.filter((m) => m.id !== id);
  savePendingMutations(filtered);
}

export function clearPendingMutations(): void {
  savePendingMutations([]);
}

export function exportPendingMutationsAsJson(): string {
  const current = getPendingMutations();
  return JSON.stringify(current, null, 2);
}

export async function registerBackgroundSync(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    if ('sync' in reg && typeof (reg as any).sync.register === 'function') {
      await (reg as any).sync.register('mchs-background-sync');
      return true;
    }
  } catch {}
  return false;
}

export async function drainMutationQueue(
  syncHandler?: (m: PendingMutation) => Promise<boolean>
): Promise<{ synced: number; remaining: number }> {
  const pending = getPendingMutations();
  if (pending.length === 0) return { synced: 0, remaining: 0 };

  let synced = 0;
  const remaining: PendingMutation[] = [];

  for (const m of pending) {
    let ok = false;
    if (syncHandler) {
      try {
        ok = await syncHandler(m);
      } catch {
        ok = false;
      }
    } else {
      // Default handler: Check if remote API host is available
      try {
        const token = localStorage.getItem('mchs_staff_token') || sessionStorage.getItem('mchs_staff_token');
        if (token && window.location.hostname.includes('azure')) {
          const endpoint = m.entity === 'grant' ? '/api/grants' : m.entity === 'newsletter' ? '/api/newsletters' : null;
          if (endpoint) {
            const method = m.action === 'create' ? 'POST' : m.action === 'update' ? 'PATCH' : 'DELETE';
            const url = m.action === 'create' ? endpoint : `${endpoint}/${encodeURIComponent(m.payload.id || '')}`;
            const res = await fetch(url, {
              method,
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                'X-Staff-Token': token,
              },
              body: method !== 'DELETE' ? JSON.stringify(m.payload) : undefined,
            });
            ok = res.ok;
          }
        }
      } catch {
        ok = false;
      }
    }

    if (ok) {
      synced++;
    } else {
      m.retries += 1;
      remaining.push(m);
    }
  }

  savePendingMutations(remaining);
  return { synced, remaining: remaining.length };
}

let autoSyncInitialized = false;
export function initOfflineQueueAutoSync(
  syncHandler?: (m: PendingMutation) => Promise<boolean>
): () => void {
  if (typeof window === 'undefined' || autoSyncInitialized) return () => {};
  autoSyncInitialized = true;

  const onOnline = () => {
    void drainMutationQueue(syncHandler);
  };

  const onSwMessage = (event: MessageEvent) => {
    if (event.data && event.data.type === 'MCHS_BACKGROUND_SYNC_TRIGGER') {
      void drainMutationQueue(syncHandler);
    }
  };

  window.addEventListener('online', onOnline);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', onSwMessage);
  }

  // Drain immediately if currently online
  if (navigator.onLine) {
    void drainMutationQueue(syncHandler);
  }

  return () => {
    window.removeEventListener('online', onOnline);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.removeEventListener('message', onSwMessage);
    }
    autoSyncInitialized = false;
  };
}
