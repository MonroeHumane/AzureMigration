/* ─── Real shelter pet fetch/filter/cache ──────────────────────────────────
   Copied from shelter-pit/src/pets.js's proven pattern almost verbatim -
   same endpoint (pets_api, auto-appended by the launcher for any game with
   needsDex:true), same isRealPhoto() allow-list, same 10-minute cache.
   Collectibles in-track are a generic local sprite (see GameScene.js) -
   this module only supplies the REAL photo/name shown at pickup time and
   at run-end, never a texture loaded from a remote URL. */

var ShelterRunPets = (function () {
  var petList = [];
  var lastFetchTime = 0;
  var CACHE_TTL_MS = 10 * 60 * 1000;

  function getApiBase() {
    var params = new URLSearchParams(window.location.search);
    var dexApi = params.get('dex_api');
    if (dexApi) return dexApi.replace(/\/?$/, '');
    if (window.location.origin && !window.location.origin.startsWith('file:')) {
      return window.location.origin + '/wp-json/monroe/v1';
    }
    return 'https://www.monroe-humane.org/wp-json/monroe/v1';
  }

  function getPetsApiUrl() {
    var params = new URLSearchParams(window.location.search);
    var petsApi = params.get('pets_api');
    if (petsApi) return petsApi.replace(/\/?$/, '');
    return getApiBase() + '/pet-match-pets';
  }

  function isRealPhoto(url) {
    if (!url || typeof url !== 'string') return false;
    var u = url.trim();
    if (/^https?:\/\/g\.petango\.com\/photos\//i.test(u)) return true;
    var blocked = ['photo-not-available', 'placehold.co', 'dogmissing.png', 'catmissing.png'];
    var lower = u.toLowerCase();
    for (var i = 0; i < blocked.length; i++) {
      if (lower.indexOf(blocked[i]) !== -1) return false;
    }
    return /^https:\/\//i.test(u);
  }

  function normalizePet(raw) {
    var file = raw.file || raw.photo || raw.image || '';
    return {
      id: String(raw.id || ''),
      name: raw.name || 'Adoptable pet',
      photo: typeof file === 'string' && file.trim() ? file.trim() : null,
      link: raw.url || 'https://www.monroe-humane.org/adopt/',
      alt: raw.alt || raw.name || 'Adoptable pet',
    };
  }

  async function fetchPets(force) {
    if (!force && petList.length && Date.now() - lastFetchTime < CACHE_TTL_MS) {
      return petList;
    }
    try {
      var apiUrl = getPetsApiUrl();
      var response = await fetch(apiUrl + (apiUrl.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now(), {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('pets fetch failed');
      var payload = await response.json();
      var images = payload.images || payload.pets || [];
      petList = images.map(normalizePet).filter(function (p) {
        return p.id && isRealPhoto(p.photo);
      });
      lastFetchTime = Date.now();
    } catch (_) {
      petList = [];
    }
    return petList;
  }

  /** Draws up to `count` pets without repeats within a single run. */
  function drawForRun(count) {
    var pool = petList.slice();
    var drawn = [];
    while (drawn.length < count && pool.length) {
      var idx = Math.floor(Math.random() * pool.length);
      drawn.push(pool.splice(idx, 1)[0]);
    }
    return drawn;
  }

  return {
    fetchPets: fetchPets,
    drawForRun: drawForRun,
    getList: function () { return petList; },
    isRealPhoto: isRealPhoto,
  };
})();
