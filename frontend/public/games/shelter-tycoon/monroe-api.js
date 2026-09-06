// ═══════════════════════════════════════════════════════════════
//  SHELTER TYCOON - Monroe WordPress REST API integration
//  Uses the same Adoptédex username (slug) as Humane Games launcher.
// ═══════════════════════════════════════════════════════════════

import { G } from './game.js';
import { getRoomInstances, getCorridorTiles } from './map.js';

const USER_STORAGE_KEY = 'monroeDexUser';
const DISPLAY_STORAGE_KEY = 'monroeDexDisplay';
const COOKIE_KEY = 'monroeDexUser';
const BACKUP_SAVE_KEY = 'shelterTycoonBackupSave';

function getEmbedParams() {
  const params = new URLSearchParams(window.location.search);
  const dexDisplay = params.get('dex_display') || '';
  return {
    dexUser: (params.get('dex_user') || '').trim().toLowerCase(),
    dexDisplay: dexDisplay ? decodeURIComponent(dexDisplay).trim() : '',
    dexApi: (params.get('dex_api') || '/wp-json/monroe/v1/').replace(/\/?$/, '/'),
  };
}

function getApiBase() {
  const { dexApi } = getEmbedParams();
  return dexApi.replace(/\/?$/, '');
}

function apiUrl(path) {
  const base = getApiBase();
  const clean = path.replace(/^\//, '');
  return `${base}/${clean}`;
}

let arcadeSessionPromise = null;

function ensureArcadeSession() {
  if (arcadeSessionPromise) return arcadeSessionPromise;
  arcadeSessionPromise = fetch(apiUrl('session/anonymous'), {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }).then((res) => {
    if (!res.ok) arcadeSessionPromise = null;
    return res;
  }).catch((err) => {
    arcadeSessionPromise = null;
    throw err;
  });
  return arcadeSessionPromise;
}

function readCookie(name) {
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : '';
}

function writeCookie(slug) {
  if (!slug) return;
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(slug)}; path=/; max-age=31536000; SameSite=Lax`;
}

/** Same rules as humane-games-launcher.js / monroe_adoptedex_normalize_username. */
export function slugifyDexUsername(raw) {
  const display = String(raw || '').trim().replace(/\s+/g, ' ');
  if (display.length < 3 || display.length > 20) return null;

  let slug = display.toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (slug.length < 3) {
    slug = display.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  }
  if (slug.length < 3 || slug.length > 20) return null;

  return { slug, display };
}

/**
 * Persist Adoptédex identity (shared with /games/ launcher).
 * @param {string} slug - username_slug for REST paths
 * @param {string} [display] - display name for UI
 */
export function setMonroeDexUser(slug, display) {
  if (!slug) return;
  const safeDisplay = (display || slug).trim();
  try {
    localStorage.setItem(USER_STORAGE_KEY, slug);
    localStorage.setItem(DISPLAY_STORAGE_KEY, safeDisplay);
  } catch (_) { /* ignore */ }
  writeCookie(slug);
  G.playerNickname = slug;
  G.playerDisplayName = safeDisplay;
}

/** @deprecated Use setMonroeDexUser - kept for call sites. */
export function setMonroeNickname(nickname) {
  const parsed = slugifyDexUsername(nickname);
  if (parsed) {
    setMonroeDexUser(parsed.slug, parsed.display);
    return;
  }
  const slug = String(nickname || '').trim().toLowerCase();
  if (slug) setMonroeDexUser(slug, slug);
}

/** Adoptédex username slug (REST key). */
export function getMonroeNickname() {
  return G.playerNickname || null;
}

export function getMonroeDisplayName() {
  return G.playerDisplayName || G.playerNickname || 'Director';
}

/**
 * Resolve identity from launcher URL params, then localStorage/cookie
 * (same keys as Humane Games).
 * @returns {{ slug: string, display: string } | null}
 */
export function resolvePlayerIdentity() {
  const { dexUser, dexDisplay } = getEmbedParams();
  if (dexUser) {
    const display = dexDisplay || dexUser;
    setMonroeDexUser(dexUser, display);
    return { slug: dexUser, display };
  }

  let slug = null;
  let display = null;
  try {
    slug = localStorage.getItem(USER_STORAGE_KEY);
    display = localStorage.getItem(DISPLAY_STORAGE_KEY);
  } catch (_) { /* ignore */ }

  if (!slug) slug = readCookie(COOKIE_KEY) || null;
  if (!slug) return null;

  setMonroeDexUser(slug, display || slug);
  return { slug, display: display || slug };
}

export function hasLauncherIdentity() {
  if (getEmbedParams().dexUser) return true;
  try {
    if (localStorage.getItem(USER_STORAGE_KEY)) return true;
  } catch (_) { /* ignore */ }
  return !!readCookie(COOKIE_KEY);
}

export function isLauncherEmbed() {
  return /(?:^|[?&])embed=1(?:&|$)/.test(window.location.search);
}

export function notifyLauncherNeedDex() {
  if (!isLauncherEmbed()) return;
  try {
    window.parent.postMessage({ type: 'monroe-shelter-need-dex' }, window.location.origin);
  } catch (_) { /* ignore */ }
}

export function showDexIdentityGate() {
  const gate = document.getElementById('dex-identity-gate');
  if (gate) gate.hidden = false;
}

export function hideDexIdentityGate() {
  const gate = document.getElementById('dex-identity-gate');
  if (gate) gate.hidden = true;
}

/**
 * Merge Adoptédex discoveries into game state (same profile as saves).
 */
export async function syncAdoptedexProfile(slug) {
  if (!slug) return;
  try {
    const response = await fetch(apiUrl(`adoptedex/${encodeURIComponent(slug)}`), {
      credentials: 'same-origin',
    });
    if (!response.ok) return;

    const data = await response.json();
    if (data.display_name) {
      G.playerDisplayName = data.display_name;
      try {
        localStorage.setItem(DISPLAY_STORAGE_KEY, data.display_name);
      } catch (_) { /* ignore */ }
    }

    const met = (data.met_ids || []).map(String);
    if (met.length) {
      const merged = new Set([...(G.adoptedPetIds || []), ...met]);
      G.adoptedPetIds = [...merged];
      refreshAvailablePets();
    }
  } catch (error) {
    console.warn('Adoptédex sync skipped.', error);
  }
}

const SPECIES_MAP = {
  dog: 'dog',
  dogs: 'dog',
  canine: 'dog',
  cat: 'cat',
  cats: 'cat',
  feline: 'cat',
  rabbit: 'rabbit',
  rabbits: 'rabbit',
  bunny: 'rabbit',
  bunnies: 'rabbit',
};

function normalizeSpecies(rawType) {
  const key = String(rawType || '').trim().toLowerCase();
  if (!key) return 'other';
  if (SPECIES_MAP[key]) return SPECIES_MAP[key];
  if (key.includes('dog')) return 'dog';
  if (key.includes('cat')) return 'cat';
  if (key.includes('rabbit') || key.includes('bunny')) return 'rabbit';
  return 'other';
}

function normalizeCatalogPet(pet) {
  if (!pet || typeof pet !== 'object') return null;
  const id = pet.id ?? pet.pet_id;
  if (id == null || id === '') return null;

  return {
    id: String(id),
    name: pet.name || 'Pet',
    species: pet.species || normalizeSpecies(pet.type),
    age: pet.age ?? '',
    photo_url: pet.photo_url || pet.file || pet.photo || null,
    profile_url: pet.url || pet.profile_url || null,
    breed: pet.breed || '',
    type: pet.type || pet.species || '',
  };
}

function extractCatalogPets(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.active)) return data.active;
  if (Array.isArray(data?.pets)) return data.pets;
  return [];
}

export async function loadMonroePets() {
  const response = await fetch(apiUrl('pet-catalog'), { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Pet catalog failed (${response.status})`);
  const data = await response.json();
  const rawPets = extractCatalogPets(data);
  G.shelterCatalog = rawPets
    .map(normalizeCatalogPet)
    .filter(Boolean);
  refreshAvailablePets();
  console.log(`Loaded ${G.shelterCatalog.length} total pets. ${G.availablePets.length} available for intake.`);
  return G.availablePets.length;
}

export function refreshAvailablePets() {
  const adopted = new Set(G.adoptedPetIds || []);
  const inShelter = new Set(
    (G.agents || [])
      .filter(a => a.petId != null)
      .map(a => a.petId),
  );
  G.availablePets = (G.shelterCatalog || []).filter(
    pet => !adopted.has(pet.id) && !inShelter.has(pet.id),
  );
}

export async function loadFromWordPress(slug) {
  if (!slug) return null;
  try {
    const response = await fetch(apiUrl(`tycoon/${encodeURIComponent(slug)}`), {
      credentials: 'same-origin',
    });
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Load failed (${response.status})`);
    }
    const payload = await response.json();
    if (payload.display_name) G.playerDisplayName = payload.display_name;
    const raw = payload?.tycoon_save_data ?? payload?.save_data ?? payload;
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (error) {
    console.error('Failed to load save from WordPress.', error);
    try {
      const backup = localStorage.getItem(BACKUP_SAVE_KEY);
      return backup ? JSON.parse(backup) : null;
    } catch (_) {
      return null;
    }
  }
}

export async function saveToWordPress(slug, gameStateObj) {
  if (!slug) return false;
  try {
    const response = await fetch(apiUrl(`tycoon/${encodeURIComponent(slug)}/save`), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tycoon_save_data: JSON.stringify(gameStateObj) }),
    });
    if (!response.ok) throw new Error(`Save failed (${response.status})`);
    console.log('Game state saved to WordPress (Adoptédex profile).');
    return true;
  } catch (error) {
    console.error('Failed to sync save with WordPress.', error);
    try {
      localStorage.setItem(BACKUP_SAVE_KEY, JSON.stringify(gameStateObj));
    } catch (_) { /* ignore */ }
    return false;
  }
}

export async function onPetAdoptedOut(petId, slug) {
  if (!G.adoptedPetIds.includes(petId)) {
    G.adoptedPetIds.push(petId);
  }
  refreshAvailablePets();

  if (!slug) return;
  try {
    await ensureArcadeSession();
    await fetch(apiUrl(`adoptedex/${encodeURIComponent(slug)}/discover`), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pet_id: petId, source: 'tycoon' }),
    });
  } catch (error) {
    console.error('Adoptédex discover failed.', error);
  }
}

export function serializeGameState() {
  return {
    version: 1,
    money: G.money,
    totalRevenue: G.totalRevenue,
    reputation: G.reputation,
    day: G.day,
    week: G.week,
    adoptedPetIds: [...(G.adoptedPetIds || [])],
    companyType: G.companyType,
    unlockedRooms: [...(G.unlockedRooms || [])],
    techTreeBranches: [...(G.techTreeBranches || [])],
    equipmentConfig: { ...G.equipmentConfig },
    marketingBudget: G.marketingBudget,
    dailyHistory: G.dailyHistory,
    completedLog: G.completedLog,
    metrics: G.metrics,
    adoptedCount: G.adoptedCount || 0,
    lastAdoptionDay: G.lastAdoptionDay || 0,
    tutorialComplete: !!G.tutorialComplete,
    ceo: G.ceo ? {
      x: G.ceo.x,
      y: G.ceo.y,
      name: G.ceo.name,
      mood: G.ceo.mood,
      skill: G.ceo.skill,
      alignment: G.ceo.alignment,
      agentId: G.ceo.id,
    } : null,
    pets: (G.agents || [])
      .filter(a => a.petId != null)
      .map(a => {
        const carePlan = G.projects.find(p => p.petId === a.petId && p.isCarePlan);
        return {
          petId: a.petId,
          name: a.name,
          species: a.species,
          age: a.age,
          roleKey: a.roleKey,
          x: a.x,
          y: a.y,
          readyForAdoption: !!a.readyForAdoption,
          carePlan: carePlan
            ? {
                id: carePlan.id,
                phaseIdx: carePlan.phaseIdx,
                phaseProgress: carePlan.phaseProgress,
                state: carePlan.state,
                dayAge: carePlan.dayAge,
                qualityScore: carePlan.qualityScore,
                templateOffice: carePlan.template?.office,
              }
            : null,
        };
      }),
    rooms: getRoomInstances().map(r => ({
      typeKey: r.typeKey,
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      rotation: r.rotation || 0,
      constructionProgress: r.constructionProgress,
    })),
    corridors: getCorridorTiles(),
  };
}
