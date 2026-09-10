import { getStaffToken } from './staff-auth';

export type StaffPetsOk = {
  ok: true;
  data: {
    lastSyncTimestamp: string | null;
    activeCount: number;
    archivedCount: number;
    totalCount: number;
    pets: any[];
  };
};

export type StaffPetsErr = { ok: false; status: number; error: string };

export async function fetchStaffPets(): Promise<StaffPetsOk | StaffPetsErr> {
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
    return {
      ok: true,
      data: {
        lastSyncTimestamp: data.lastSyncTimestamp || null,
        activeCount: Number(data.activeCount || 0),
        archivedCount: Number(data.archivedCount || 0),
        totalCount: Number(data.totalCount || data.pets.length),
        pets: data.pets,
      },
    };
  } catch {
    return { ok: false, status: 0, error: 'Network error loading census' };
  }
}
