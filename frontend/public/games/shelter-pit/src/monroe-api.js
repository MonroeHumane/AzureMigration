var MonroeApi = (function () {
  var USER_STORAGE_KEY = 'monroeDexUser';
  var DISPLAY_STORAGE_KEY = 'monroeDexDisplay';
  var COOKIE_KEY = 'monroeDexUser';

  function getEmbedParams() {
    var params = new URLSearchParams(window.location.search);
    return {
      dexUser: (params.get('dex_user') || '').trim().toLowerCase(),
      dexDisplay: params.get('dex_display') ? decodeURIComponent(params.get('dex_display')).trim() : '',
      dexApi: (params.get('dex_api') || '/wp-json/monroe/v1/').replace(/\/?$/, '/'),
    };
  }

  function apiUrl(path) {
    var base = getEmbedParams().dexApi.replace(/\/?$/, '');
    return base + '/' + path.replace(/^\//, '');
  }

  var arcadeSessionPromise = null;

  function ensureArcadeSession() {
    if (arcadeSessionPromise) return arcadeSessionPromise;
    arcadeSessionPromise = fetch(apiUrl('session/anonymous'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }).then(function (res) {
      if (!res.ok) arcadeSessionPromise = null;
      return res;
    }).catch(function (err) {
      arcadeSessionPromise = null;
      throw err;
    });
    return arcadeSessionPromise;
  }

  function getMonroeSlug() {
    var p = getEmbedParams();
    if (p.dexUser) return p.dexUser;
    try {
      return localStorage.getItem(USER_STORAGE_KEY) || '';
    } catch (_) {
      return '';
    }
  }

  function getMonroeDisplayName() {
    try {
      return localStorage.getItem(DISPLAY_STORAGE_KEY) || getMonroeSlug() || 'Volunteer';
    } catch (_) {
      return 'Volunteer';
    }
  }

  function isLauncherEmbed() {
    return /(?:^|[?&])embed=1(?:&|$)/.test(window.location.search);
  }

  function notifyLauncherNeedDex() {
    if (!isLauncherEmbed()) return;
    try {
      window.parent.postMessage({ type: 'monroe-shelter-need-dex' }, window.location.origin);
    } catch (_) { /* ignore */ }
  }

  async function loadShelterPitSave(slug) {
    if (!slug) return null;
    try {
      var response = await fetch(apiUrl('shelter-pit/' + encodeURIComponent(slug)), {
        credentials: 'same-origin',
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (_) {
      return null;
    }
  }

  async function saveShelterPitSave(slug, saveObj) {
    if (!slug) return false;
    try {
      var response = await fetch(apiUrl('shelter-pit/' + encodeURIComponent(slug) + '/save'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shelter_pit_save_data: JSON.stringify(saveObj) }),
      });
      return response.ok;
    } catch (_) {
      return false;
    }
  }

  async function discoverPet(slug, petId, source) {
    if (!slug || !petId) return false;
    try {
      await ensureArcadeSession();
      var response = await fetch(apiUrl('adoptedex/' + encodeURIComponent(slug) + '/discover'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pet_id: String(petId), source: source || 'shelter_pit' }),
      });
      return response.ok;
    } catch (_) {
      return false;
    }
  }

  return {
    getEmbedParams: getEmbedParams,
    getMonroeSlug: getMonroeSlug,
    getMonroeDisplayName: getMonroeDisplayName,
    isLauncherEmbed: isLauncherEmbed,
    notifyLauncherNeedDex: notifyLauncherNeedDex,
    loadShelterPitSave: loadShelterPitSave,
    saveShelterPitSave: saveShelterPitSave,
    discoverPet: discoverPet,
  };
})();
