// Pet Snake Adventure — Azure Arcade API & Economy Client
// Connects to ScoresController, AdoptedexController, and cloud save sync with guest wallet resilience fallback.

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
    return localStorage.getItem('monroeDexDisplay') || localStorage.getItem('monroeDexUser') || 'Snake Ranger';
  } catch (e) {
    return 'Snake Ranger';
  }
}

let sessionPromise = null;
export function ensureSession() {
  if (sessionPromise) return sessionPromise;
  sessionPromise = fetch(apiBase() + 'session/anonymous', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(8000),
  }).then(r => (r.ok ? r.json() : null)).catch(() => {
    sessionPromise = null;
    return null;
  });
  return sessionPromise;
}

async function post(path, body) {
  const res = await fetch(apiBase() + path.replace(/^\//, ''), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function get(path) {
  const res = await fetch(apiBase() + path.replace(/^\//, ''), {
    credentials: 'include',
    signal: AbortSignal.timeout(8000)
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// ── Scores & Leaderboards ───────────────────────────────────────────────────

export async function submitScore(score, metadata = {}) {
  await ensureSession();
  return post('scores', {
    gameId: GAME_ID,
    score,
    playerName: playerName(),
    metadata,
  });
}

export async function getLeaderboard(limit = 10, timeframe = 'all') {
  const r = await get(`scores?gameId=${GAME_ID}&limit=${limit}&timeframe=${timeframe}`);
  return r.ok && r.data && Array.isArray(r.data.scores) ? r.data.scores : [];
}

// ── Cloud Save Sync ─────────────────────────────────────────────────────────

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
  return 'psa-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

export async function pushCloudSave(local) {
  await ensureSession();
  const merged = Object.assign({}, cloudSave || {}, local, {
    best: Math.max(local.best || 0, (cloudSave && cloudSave.best) || 0),
    bestFloor: Math.max(local.bestFloor || 0, (cloudSave && cloudSave.bestFloor) || 0),
    claimedMilestones: Array.from(new Set([
      ...((cloudSave && cloudSave.claimedMilestones) || []),
      ...(local.claimedMilestones || []),
    ])),
  });

  const r = await post('sync', {
    operations: [{
      operationId: opId(),
      type: 'save',
      gameId: GAME_ID,
      slot: SAVE_SLOT,
      schemaVersion: SCHEMA_VERSION,
      expectedRevision: saveRevision,
      data: merged,
    }],
  });

  const res = r.data && r.data.results && r.data.results[0];
  if (res && res.status === 'success') {
    saveRevision = res.revision;
    cloudSave = merged;
  } else if (res && res.status === 'conflict') {
    saveRevision = res.serverRevision || saveRevision;
    cloudSave = res.serverData || cloudSave;
  }
  return cloudSave;
}

// ── Adoptédex & Economy ─────────────────────────────────────────────────────

export async function claimMilestone(rewardKey, tier = 'standard') {
  const user = dexUser();
  if (!user) return null;
  await ensureSession();
  if (typeof MonroeAdoptedex !== 'undefined' && MonroeAdoptedex.claimReward) {
    return MonroeAdoptedex.claimReward(apiBase(), user, GAME_ID, rewardKey, { tier, count: 1 });
  }
  const r = await post(`adoptedex/${encodeURIComponent(user)}/rewards/claim`, {
    game_id: GAME_ID,
    reward_key: rewardKey
  });
  return r.data;
}

export async function reportDiscoveries(petIds) {
  if (!petIds || !petIds.length) return null;
  const user = dexUser();
  if (!user) {
    try {
      const existing = JSON.parse(localStorage.getItem('monroe_discovered_pets') || '[]');
      for (const id of petIds) {
        const s = String(id);
        if (!existing.includes(s)) existing.push(s);
      }
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

export async function awardCoins(reason = 'game_award') {
  const user = dexUser();
  if (user) {
    try {
      await ensureSession();
      const r = await post(`adoptedex/${encodeURIComponent(user)}/coins/award`, { reason });
      if (r.ok && r.data && r.data.ok) return r.data;
    } catch (e) { /* fall through to local */ }
  }
  const awarded = localAwardCoins(5);
  return { ok: true, awarded, coin_balance: localCoins(), local: true };
}

// ── Guest-Local Wallet Fallback ─────────────────────────────────────────────
const LS_COINS = 'sr_coins';
const LS_COIN_DAY = 'sr_coins_day';
const LOCAL_GAME_DAILY_CAP = 25;

export function localCoins() {
  try { return Math.max(0, JSON.parse(localStorage.getItem(LS_COINS)) | 0); } catch (e) { return 0; }
}

export function writeLocalCoins(n) {
  try { localStorage.setItem(LS_COINS, JSON.stringify(Math.max(0, n | 0))); } catch (e) {}
}

function localCoinDay() {
  const day = new Date().toISOString().slice(0, 10);
  try {
    const d = JSON.parse(localStorage.getItem(LS_COIN_DAY) || 'null');
    if (d && d.day === day) return d;
  } catch (e) {}
  return { day, game: 0 };
}

function writeLocalCoinDay(d) {
  try { localStorage.setItem(LS_COIN_DAY, JSON.stringify(d)); } catch (e) {}
}

function localAwardCoins(delta) {
  const day = localCoinDay();
  if (day.game + delta > LOCAL_GAME_DAILY_CAP) {
    delta = Math.max(0, LOCAL_GAME_DAILY_CAP - day.game);
  }
  if (delta > 0) {
    day.game += delta;
    writeLocalCoinDay(day);
    writeLocalCoins(localCoins() + delta);
  }
  return delta;
}
