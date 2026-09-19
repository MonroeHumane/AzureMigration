import { getStaffToken } from './staff-auth';

export type StaffPetsOk = {
  ok: true;
  data: {
    lastSyncTimestamp: string | null;
    syncError?: string | null;
    activeCount: number;
    archivedCount: number;
    totalCount: number;
    pets: any[];
  };
};

export type StaffPetsErr = { ok: false; status: number; error: string };

let petsMemoryCache: StaffPetsOk | null = null;
let petsMemoryCacheAt = 0;

export async function fetchStaffPets(force = false): Promise<StaffPetsOk | StaffPetsErr> {
  if (!force && petsMemoryCache && (Date.now() - petsMemoryCacheAt < 5 * 60 * 1000)) {
    return petsMemoryCache;
  }

  const token = await getStaffToken();
  if (!token) {
    return { ok: false, status: 401, error: 'No staff session' };
  }

  const isServerEnv = typeof window !== 'undefined' &&
    (window.location.hostname.includes('azure') || Boolean((window as any).__MCHS_API_URL__));

  if (isServerEnv) {
    try {
      const res = await fetch('/api/staff-pets', {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Staff-Token': token,
          'X-Authorization': `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const json = await res.json();
        const data = json?.data || json;
        if (data && Array.isArray(data.pets)) {
          const result: StaffPetsOk = {
            ok: true,
            data: {
              lastSyncTimestamp: data.lastSyncTimestamp || null,
              activeCount: Number(data.activeCount || 0),
              archivedCount: Number(data.archivedCount || 0),
              totalCount: Number(data.totalCount || data.pets.length),
              pets: data.pets,
            },
          };
          petsMemoryCache = result;
          petsMemoryCacheAt = Date.now();
          return result;
        }
      }
    } catch {
      // network error loading /api/staff-pets, proceed to static fallback
    }
  }

  // Fallback to static endpoints for $0 static hosting
  try {
    const staticRes = await fetch('/shelter-pets.json', { signal: AbortSignal.timeout(5000) });
    if (staticRes.ok) {
      const pets = await staticRes.json();
      if (Array.isArray(pets)) {
        let allPets = [...pets];
        let archivedCount = 0;
        try {
          const archRes = await fetch('/archived-pets.json', { signal: AbortSignal.timeout(3000) });
          if (archRes.ok) {
            const archData = await archRes.json();
            if (Array.isArray(archData)) {
              archivedCount = archData.length;
              allPets = allPets.concat(archData.slice(0, 150));
            }
          }
        } catch {}

        const result: StaffPetsOk = {
          ok: true,
          data: {
            lastSyncTimestamp: pets[0]?.last_seen_at || null,
            activeCount: pets.length,
            archivedCount,
            totalCount: pets.length + archivedCount,
            pets: allPets,
          },
        };
        petsMemoryCache = result;
        petsMemoryCacheAt = Date.now();
        return result;
      }
    }
  } catch {}

  return { ok: false, status: 0, error: 'Census unavailable' };
}
