// Azure arcade API client — anonymous session, scores, cloud save sync,
// Adoptédex economy (milestones → packs/coins, pack open, pet discovery).
import { GAME_ID, SAVE_SLOT, SCHEMA_VERSION } from './config.js';

function apiBase() {
  if (typeof MonroeAdoptedex !== 'undefined') {
    const p = MonroeAdoptedex.getParams();
    if (p.dexApi) return p.dexApi.replace(/\/?$/, '/');
  }
  const params = new URLSearchParams(location.search);
  const explicit = params.get('dex_api') || params.get('api');
  if (explicit) return explicit.replace(/\/?$/, '/');
  const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  return local
    ? 'https://mchs-arcade-api.livelyfield-d0a70609.eastus.azurecontainerapps.io/arcade-api/v1/'
    : location.origin + '/arcade-api/v1/';
}

export function dexUser() {
  if (typeof MonroeAdoptedex !== 'undefined') return MonroeAdoptedex.getParams().dexUser || '';
  const params = new URLSearchParams(location.search);
  return (params.get('dex_user') || params.get('user') || localStorage.getItem('monroeDexUser') || '').trim().toLowerCase();
}

export function playerName() {
  if (typeof MonroeAdoptedex !== 'undefined') {
    const p = MonroeAdoptedex.getParams();
    if (p.dexDisplay) return p.dexDisplay;
  }
  try {
    return localStorage.getItem('monroeDexDisplay') || localStorage.getItem('monroeDexUser') || 'Player';
  } catch (e) { return 'Player'; }
}

let sessionPromise = null;
export function ensureSession() {
  if (sessionPromise) return sessionPromise;
  sessionPromise = fetch(apiBase() + 'session/anonymous', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}',
  }).then(r => (r.ok ? r.json() : null)).catch(() => { sessionPromise = null; return null; });
  return sessionPromise;
}

async function post(path, body) {
  const res = await fetch(apiBase() + path.replace(/^\//, ''), {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function get(path) {
  const res = await fetch(apiBase() + path.replace(/^\//, ''), { credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// ── Scores ──────────────────────────────────────────────────────────────────

export async function submitScore(score, metadata) {
  await ensureSession();
  return post('scores', {
    gameId: GAME_ID, score, playerName: playerName(),
    metadata: metadata || {},
  });
}

export async function getLeaderboard(limit = 10, timeframe = 'all') {
  const r = await get(`scores?gameId=${GAME_ID}&limit=${limit}&timeframe=${timeframe}`);
  return r.ok && r.data && Array.isArray(r.data.scores) ? r.data.scores : [];
}

// ── Cloud save (sync) ───────────────────────────────────────────────────────
// Save shape: { best, gamesPlayed, totalMeters, catId, claimedMilestones: [] }

let saveRevision = 0;
let cloudSave = null;

export async function loadCloudSave() {
  await ensureSession();
  const r = await get(`saves?gameId=${GAME_ID}&slot=${SAVE_SLOT}`);
  if (r.ok && r.data && r.data.data) {
    saveRevision = r.data.revision || 0;
    cloudSave = r.data.data;
  }
  return cloudSave;
}

function opId() {
  return 'sr2-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

export async function pushCloudSave(local) {
  await ensureSession();
  const merged = Object.assign({}, cloudSave || {}, local, {
    best: Math.max(local.best || 0, (cloudSave && cloudSave.best) || 0),
    claimedMilestones: Array.from(new Set([
      ...((cloudSave && cloudSave.claimedMilestones) || []),
      ...(local.claimedMilestones || []),
    ])),
  });
  const r = await post('sync', {
    operations: [{
      operationId: opId(), type: 'save', gameId: GAME_ID, slot: SAVE_SLOT,
      schemaVersion: SCHEMA_VERSION, expectedRevision: saveRevision, data: merged,
    }],
  });
  const res = r.data && r.data.results && r.data.results[0];
  if (res && res.status === 'success') {
    saveRevision = res.revision;
    cloudSave = merged;
  } else if (res && res.status === 'conflict') {
    saveRevision = res.serverRevision || saveRevision;
    cloudSave = res.serverData || cloudSave;
    if (cloudSave && merged.best > (cloudSave.best || 0)) return pushCloudSave(local);
  }
  return cloudSave;
}

// ── Adoptédex economy ───────────────────────────────────────────────────────

export async function claimMilestone(rewardKey, tier) {
  const user = dexUser();
  if (!user) return null;
  await ensureSession();
  if (typeof MonroeAdoptedex !== 'undefined' && MonroeAdoptedex.claimReward) {
    return MonroeAdoptedex.claimReward(apiBase(), user, GAME_ID, rewardKey, { tier: tier || 'standard', count: 1 });
  }
  const r = await post(`adoptedex/${encodeURIComponent(user)}/rewards/claim`, { game_id: GAME_ID, reward_key: rewardKey });
  return r.data;
}

export async function openPack(tier = 'standard') {
  const user = dexUser();
  if (!user) return null;
  await ensureSession();
  if (typeof MonroeAdoptedex !== 'undefined' && MonroeAdoptedex.openPack) {
    return MonroeAdoptedex.openPack(apiBase(), user, tier);
  }
  const r = await post(`adoptedex/${encodeURIComponent(user)}/packs/open`, { tier });
  if (!r.ok || !r.data || !r.data.ok) throw new Error((r.data && r.data.message) || 'Could not open pack.');
  return r.data;
}

export async function fetchProfile() {
  const user = dexUser();
  if (!user) return null;
  if (typeof MonroeAdoptedex !== 'undefined' && MonroeAdoptedex.fetchDex) {
    try { return await MonroeAdoptedex.fetchDex(apiBase(), user); } catch (e) { return null; }
  }
  const r = await get(`adoptedex/${encodeURIComponent(user)}`);
  return r.ok ? r.data : null;
}

// Batch-report rescued pets → Adoptédex discoveries (server dedupes).
export async function reportDiscoveries(petIds) {
  if (!petIds || !petIds.length) return null;
  const user = dexUser();
  if (!user) {
    // Persist locally so the album can pick them up later.
    try {
      const existing = JSON.parse(localStorage.getItem('monroe_discovered_pets') || '[]');
      for (const id of petIds) { const s = String(id); if (!existing.includes(s)) existing.push(s); }
      localStorage.setItem('monroe_discovered_pets', JSON.stringify(existing));
    } catch (e) {}
    return null;
  }
  if (typeof MonroeAdoptedex !== 'undefined' && MonroeAdoptedex.discoverBulk) {
    try { return await MonroeAdoptedex.discoverBulk(apiBase(), user, petIds, GAME_ID); } catch (e) { return null; }
  }
  const r = await post(`adoptedex/${encodeURIComponent(user)}/discover/bulk`, { pet_ids: petIds, source: GAME_ID });
  return r.ok ? r.data : null;
}
