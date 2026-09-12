// Real shelter pet fetch/filter/cache for rescue pickups.
// Sources: ?pets_api= override → site WP endpoint → bundled shelter-pets.json.
// Collectibles render as photo tokens; pet identity rides along to run-end.

let petList = [];
let lastFetch = 0;
let fetchPromise = null;
const CACHE_TTL = 10 * 60 * 1000;

function sources() {
  const params = new URLSearchParams(location.search);
  const out = [];
  const explicit = params.get('pets_api');
  if (explicit) out.push(explicit.replace(/\/?$/, ''));
  if (location.origin && !location.origin.startsWith('file:')) {
    out.push(location.origin + '/wp-json/monroe/v1/pet-match-pets');
    out.push(location.origin + '/shelter-pets.json');
  }
  return out;
}

function isRealPhoto(url) {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim().toLowerCase();
  for (const bad of ['photo-not-available', 'placehold.co', 'dogmissing', 'catmissing']) {
    if (u.includes(bad)) return false;
  }
  return /^https?:\/\//.test(u);
}

function normalize(raw) {
  const file = raw.image_url || raw.file || raw.photo || raw.image || '';
  return {
    id: String(raw.id || ''),
    name: raw.name || 'Adoptable pet',
    photo: file.trim() || null,
    type: raw.type || raw.species_label || 'Companion',
    breed: raw.breed || '',
    age: raw.age_display || raw.age || '',
    gender: raw.gender || '',
    link: raw.url || 'https://www.monroe-humane.org/adopt/',
    archived: !!raw.archived_at || !!raw.archived,
  };
}

export async function fetchPets(force = false) {
  if (!force && petList.length && Date.now() - lastFetch < CACHE_TTL) return petList;
  if (!force && fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    for (const url of sources()) {
      try {
        const res = await fetch(url + (url.includes('?') ? '&' : '?') + '_=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) continue;
        const payload = await res.json();
        const raw = payload.images || payload.pets || (Array.isArray(payload) ? payload : []);
        const list = raw.map(normalize).filter(p => p.id && isRealPhoto(p.photo) && !p.archived);
        if (list.length) { petList = list; lastFetch = Date.now(); break; }
      } catch (e) { /* try next source */ }
    }
    return petList;
  })();

  try { return await fetchPromise; } finally { fetchPromise = null; }
}

// Draw up to `count` distinct pets for a run.
export function drawForRun(count) {
  const pool = petList.slice();
  const drawn = [];
  while (drawn.length < count && pool.length) {
    drawn.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return drawn;
}

export function petCount() { return petList.length; }
