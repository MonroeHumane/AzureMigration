// Azure arcade API client — anonymous session, scores, cloud save sync,
// Adoptédex economy (milestones → packs/coins, pack open, pet discovery).
import { GAME_ID, SAVE_SLOT, SCHEMA_VERSION, UPGRADES } from './config.js';

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
    signal: AbortSignal.timeout(8000),
  }).then(r => (r.ok ? r.json() : null)).catch(() => { sessionPromise = null; return null; });
  return sessionPromise;
}

async function post(path, body) {
  const res = await fetch(apiBase() + path.replace(/^\//, ''), {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function get(path) {
  const res = await fetch(apiBase() + path.replace(/^\//, ''), { credentials: 'include', signal: AbortSignal.timeout(8000) });
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
  if (user) {
    if (typeof MonroeAdoptedex !== 'undefined' && MonroeAdoptedex.fetchDex) {
      try {
        const p = await MonroeAdoptedex.fetchDex(apiBase(), user);
        if (p) return p;
      } catch (e) { /* fall through */ }
    }
    try {
      const r = await get(`adoptedex/${encodeURIComponent(user)}`);
      if (r.ok) return r.data;
    } catch (e) { /* fall through */ }
  }
  return { ok: true, coin_balance: localCoins(), local: true };
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

// Server-authoritative coin award — reason value comes from COIN_AWARD_REASONS.
export async function awardCoins(reason = 'game_award') {
  const user = dexUser();
  if (user) {
    try {
      await ensureSession();
      const r = await post(`adoptedex/${encodeURIComponent(user)}/coins/award`, { reason });
      if (r.ok) return r.data && r.data.ok ? r.data : null;
    } catch (e) { /* fall through to local */ }
  }
  if (reason !== 'game_award') return null;
  const awarded = localAwardCoins(LOCAL_GAME_AWARD, 'game');
  return { ok: true, awarded, coin_balance: localCoins(), local: true };
}

// ── Game progress — upgrades + objectives + multiplier ──────────────────────

const LS_PROGRESS = 'sr_progress';

function readLocalProgress() {
  try { return JSON.parse(localStorage.getItem(LS_PROGRESS) || 'null'); } catch (e) { return null; }
}
function writeLocalProgress(p) {
  try { localStorage.setItem(LS_PROGRESS, JSON.stringify(p)); } catch (e) {}
}

// ── Guest-local economy ─────────────────────────────────────────────────────
// Signed-out players get a device-only wallet so the full loop (earn → buy)
// works without a Binder account. Values mirror the server's tables; nothing
// here can create server-side value — signing in switches to the real wallet.
const LS_COINS = 'sr_coins';
const LS_COIN_DAY = 'sr_coins_day';
const LOCAL_DONATION_VALUES = [0, 8, 16, 26, 40, 60];
const LOCAL_GAME_AWARD = 5;
const LOCAL_GAME_DAILY_CAP = 25;
const LOCAL_DONATION_POOL_CAP = 100;

function localCoins() {
  try { return Math.max(0, JSON.parse(localStorage.getItem(LS_COINS)) | 0); } catch (e) { return 0; }
}
function writeLocalCoins(n) {
  try { localStorage.setItem(LS_COINS, JSON.stringify(Math.max(0, n | 0))); } catch (e) {}
}
function localCoinDay() {
  const day = new Date().toISOString().slice(0, 10);
  try {
    const d = JSON.parse(localStorage.getItem(LS_COIN_DAY) || 'null');
    if (d && d.day === day) return d;
  } catch (e) {}
  return { day, game: 0, pool: 0 };
}
function writeLocalCoinDay(d) {
  try { localStorage.setItem(LS_COIN_DAY, JSON.stringify(d)); } catch (e) {}
}
function localUpgradeLevel(upgrade) {
  const p = readLocalProgress();
  const lvl = p && p.upgrades ? p.upgrades[upgrade] : null;
  return (lvl && typeof lvl === 'object' ? lvl.level : lvl) | 0;
}
function localAwardCoins(delta, kind) {
  // kind: 'game' (game_award cap) | 'pool' (shared donation pool cap)
  const day = localCoinDay();
  if (kind === 'game' && day.game + delta > LOCAL_GAME_DAILY_CAP) delta = Math.max(0, LOCAL_GAME_DAILY_CAP - day.game);
  if (day.pool + delta > LOCAL_DONATION_POOL_CAP) delta = Math.max(0, LOCAL_DONATION_POOL_CAP - day.pool);
  if (delta > 0) {
    if (kind === 'game') day.game += delta;
    day.pool += delta;
    writeLocalCoinDay(day);
    writeLocalCoins(localCoins() + delta);
  }
  return delta;
}

// Server truth, with a localStorage fallback so upgrades work for guests.
export async function fetchProgress() {
  const user = dexUser();
  if (user) {
    try {
      await ensureSession();
      const r = await get(`adoptedex/${encodeURIComponent(user)}/game/progress?game_id=${GAME_ID}`);
      if (r.ok && r.data && r.data.ok) {
        writeLocalProgress(r.data);
        return r.data;
      }
    } catch (e) { /* fall through to local */ }
  }
  return readLocalProgress();
}

export async function buyUpgrade(upgrade) {
  const user = dexUser();
  if (user) {
    try {
      await ensureSession();
      const r = await post(`adoptedex/${encodeURIComponent(user)}/game/upgrades/buy`, { game_id: GAME_ID, upgrade });
      if (r.ok) {
        if (r.data && r.data.ok) {
          const p = readLocalProgress() || {};
          p.upgrades = Object.assign(p.upgrades || {}, { [upgrade]: { level: r.data.level } });
          writeLocalProgress(p);
        }
        return r.data; // business rejections (insufficient/maxed) stand
      }
      // Request itself failed (auth/network) → degrade to the local wallet.
    } catch (e) { /* fall through to local */ }
  }
  // Local fallback — buy against the device wallet (costs mirror the
  // server's UPGRADE_DEFS table in config.js).
  const def = UPGRADES[upgrade];
  if (!def) return { ok: false, code: 'bad_request', message: 'Unknown upgrade' };
  const level = localUpgradeLevel(upgrade);
  if (level >= def.costs.length) return { ok: false, code: 'maxed', message: 'Upgrade already maxed' };
  const cost = def.costs[level];
  const balance = localCoins();
  if (balance < cost) return { ok: false, code: 'insufficient', message: 'Not enough coins', coin_balance: balance };
  writeLocalCoins(balance - cost);
  const p = readLocalProgress() || {};
  p.upgrades = Object.assign(p.upgrades || {}, { [upgrade]: { level: level + 1 } });
  writeLocalProgress(p);
  return { ok: true, upgrade, level: level + 1, cost, coin_balance: localCoins(), local: true };
}

export async function claimObjective(key) {
  const user = dexUser();
  if (!user) {
    const p = readLocalProgress() || {};
    p.objectives = Array.isArray(p.objectives) ? p.objectives : [];
    const already = p.objectives.includes(key);
    if (!already) {
      p.objectives.push(key);
      p.multiplier = (p.multiplier || 1) + 1;
      writeLocalProgress(p);
    }
    return { ok: true, already, multiplier: p.multiplier, objectives: p.objectives, local: true };
  }
  try {
    await ensureSession();
    const r = await post(`adoptedex/${encodeURIComponent(user)}/game/objectives/claim`, { game_id: GAME_ID, key });
    if (r.ok && r.data && r.data.ok) {
      const p = readLocalProgress() || {};
      p.multiplier = r.data.multiplier;
      p.objectives = r.data.objectives;
      writeLocalProgress(p);
    }
    return r.data;
  } catch (e) { return null; }
}

// Donation pickup → server awards level-scaled coins.
export async function donation() {
  const user = dexUser();
  if (user) {
    try {
      await ensureSession();
      const r = await post(`adoptedex/${encodeURIComponent(user)}/coins/donation`, { game_id: GAME_ID });
      if (r.ok) return r.data && r.data.ok ? r.data : null;
    } catch (e) { /* fall through to local */ }
  }
  const level = localUpgradeLevel('donation');
  const delta = LOCAL_DONATION_VALUES[Math.max(0, Math.min(5, level))] | 0;
  if (delta <= 0) return { ok: false, message: 'Donation Burst not owned' };
  const awarded = localAwardCoins(delta, 'pool');
  return { ok: true, awarded, level, local: true };
}

export async function spendCoins(amount, reason) {
  const user = dexUser();
  if (!user) return { ok: false, code: 'guest' };
  try {
    await ensureSession();
    const r = await post(`adoptedex/${encodeURIComponent(user)}/coins/spend`, { amount, reason: reason || 'game_spend' });
    return r.data;
  } catch (e) { return { ok: false, code: 'offline' }; }
}
