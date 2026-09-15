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

  try {
    const res = await fetch('/api/staff-pets', {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Staff-Token': token,
        'X-Authorization': `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      return { ok: false, status: res.status, error: `Census unavailable (${res.status})` };
    }
    const json = await res.json();
    const data = json?.data || json;
    if (!data || !Array.isArray(data.pets)) {
      return { ok: false, status: 502, error: 'Empty census response' };
    }
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
  } catch {
    return { ok: false, status: 0, error: 'Network error loading census' };
  }
}
