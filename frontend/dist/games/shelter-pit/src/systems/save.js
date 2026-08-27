var SP_Save = {
  LOCAL_PREFIX: 'shelter_pit_save_',

  defaultSave() {
    return {
      version: 1,
      shiftsCompleted: 0,
      unlockedZones: ['stray_alley'],
      unlockedVolunteers: ['starter'],
      discoveredEvolutions: [],
      petsHelped: [],
      campus: SP_Campus.defaultGrid(),
      supplies: { kibble: 0, towel: 0, supply: 0 },
      resourceTimers: {},
      lastPlayedAt: Date.now(),
    };
  },

  loadLocal(slug) {
    if (!slug) return SP_Save.defaultSave();
    try {
      var raw = localStorage.getItem(SP_Save.LOCAL_PREFIX + slug);
      if (!raw) return SP_Save.defaultSave();
      return Object.assign(SP_Save.defaultSave(), JSON.parse(raw));
    } catch (_) {
      return SP_Save.defaultSave();
    }
  },

  saveLocal(slug, data) {
    if (!slug) return;
    try {
      data.lastPlayedAt = Date.now();
      localStorage.setItem(SP_Save.LOCAL_PREFIX + slug, JSON.stringify(data));
    } catch (_) { /* ignore */ }
  },

  mergeCloud(local, cloud) {
    if (!cloud || typeof cloud !== 'object') return local;
    var out = Object.assign(SP_Save.defaultSave(), cloud);
    if ((local.shiftsCompleted || 0) > (out.shiftsCompleted || 0)) {
      out.shiftsCompleted = local.shiftsCompleted;
    }
    return out;
  },

  async load(slug) {
    var local = SP_Save.loadLocal(slug);
    if (typeof MonroeApi !== 'undefined' && MonroeApi.loadShelterPitSave) {
      try {
        var cloud = await MonroeApi.loadShelterPitSave(slug);
        if (cloud && cloud.save_data) {
          var parsed = typeof cloud.save_data === 'string' ? JSON.parse(cloud.save_data) : cloud.save_data;
          local = SP_Save.mergeCloud(local, parsed);
        }
      } catch (_) { /* offline */ }
    }
    window.__SP_SAVE__ = local;
    return local;
  },

  async persist(slug, data) {
    window.__SP_SAVE__ = data;
    SP_Save.saveLocal(slug, data);
    if (typeof MonroeApi !== 'undefined' && MonroeApi.saveShelterPitSave) {
      try {
        await MonroeApi.saveShelterPitSave(slug, data);
      } catch (_) { /* offline */ }
    }
  },

  recordShiftComplete(slug, result) {
    var save = window.__SP_SAVE__ || SP_Save.defaultSave();
    save.shiftsCompleted = (save.shiftsCompleted || 0) + 1;
    if (result.zoneId && save.unlockedZones.indexOf(result.zoneId) === -1) {
      /* already unlocked */
    }
    var zoneIdx = SHELTER_CONTENT.zones.findIndex(function (z) {
      return z.id === result.zoneId;
    });
    if (zoneIdx >= 0 && zoneIdx < SHELTER_CONTENT.zones.length - 1 && result.won) {
      var next = SHELTER_CONTENT.zones[zoneIdx + 1].id;
      if (save.unlockedZones.indexOf(next) === -1) save.unlockedZones.push(next);
    }
    SHELTER_CONTENT.volunteers.forEach(function (v) {
      if (v.unlock === 'default') return;
      if (v.unlock.indexOf('zone:') === 0) {
        var zid = v.unlock.slice(5);
        if (save.unlockedZones.indexOf(zid) >= 0 && save.unlockedVolunteers.indexOf(v.id) === -1) {
          save.unlockedVolunteers.push(v.id);
        }
      }
      if (v.unlock.indexOf('shifts:') === 0) {
        var need = parseInt(v.unlock.slice(7), 10);
        if (save.shiftsCompleted >= need && save.unlockedVolunteers.indexOf(v.id) === -1) {
          save.unlockedVolunteers.push(v.id);
        }
      }
    });
    (result.discovered || []).forEach(function (d) {
      if (save.discoveredEvolutions.indexOf(d) === -1) save.discoveredEvolutions.push(d);
    });
    (result.petsHelped || []).forEach(function (p) {
      if (save.petsHelped.indexOf(p) === -1) save.petsHelped.push(p);
    });
    return SP_Save.persist(slug, save);
  },

  isCampusUnlocked() {
    var save = window.__SP_SAVE__ || SP_Save.defaultSave();
    return (save.shiftsCompleted || 0) >= 2;
  },
};
