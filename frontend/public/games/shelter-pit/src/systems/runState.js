var SP_RunState = {
  create(options) {
    var vol = SHELTER_CONTENT.volunteers.find(function (v) {
      return v.id === (options.volunteerId || 'starter');
    }) || SHELTER_CONTENT.volunteers[0];
    var save = (typeof window !== 'undefined' && window.__SP_SAVE__) || null;
    var buildingBonuses = save ? SP_Campus.computeRunBonuses(save) : { damage: 0, extraBall: 0, timerGrace: 0 };
    var zone = SHELTER_CONTENT.zones.find(function (z) {
      return z.id === (options.zoneId || 'stray_alley');
    }) || SHELTER_CONTENT.zones[0];
    var duration = CFG.RUN.shiftDurationSec + (buildingBonuses.timerGrace || 0);
    return {
      zoneId: options.zoneId || 'stray_alley',
      zone: zone,
      volunteerId: vol.id,
      volunteer: vol,
      level: 1,
      xp: 0,
      hearts: 0,
      timeLeft: duration,
      inventory: [{ id: vol.startBall, name: vol.startBall, kind: 'ball', level: 1, fused: false }],
      perks: [],
      perksMax: 4,
      ballsMax: 6,
      rowsCleared: 0,
      petsHelpedThisRun: [],
      discoveredThisRun: [],
      pendingEnrichment: false,
      pendingDraft: false,
      won: false,
      babyBallDamage: 1 + (buildingBonuses.damage || 0),
      buildingBonuses: buildingBonuses,
      shiftSupplies: 0,
    };
  },

  addXp(state, amount) {
    state.hearts += amount;
    while (state.hearts >= CFG.RUN.heartXpToLevel) {
      state.hearts -= CFG.RUN.heartXpToLevel;
      state.level += 1;
      state.pendingDraft = true;
      if (typeof SP_Audio !== 'undefined') SP_Audio.play('levelup');
    }
  },

  addInventoryItem(state, item) {
    var id = item.id;
    var existing = state.inventory.find(function (i) {
      return i.id === id && i.kind === item.kind;
    });
    if (existing) {
      existing.level = Math.min(3, (existing.level || 1) + 1);
      return existing;
    }
    if (item.kind === 'ball' && state.inventory.filter(function (i) {
      return i.kind === 'ball';
    }).length >= state.ballsMax) {
      return null;
    }
    if (item.kind === 'perk' && state.perks.length >= state.perksMax) {
      return null;
    }
    var entry = { id: id, name: item.name || id, kind: item.kind, level: 1, fused: false };
    if (item.kind === 'perk') state.perks.push(entry);
    else state.inventory.push(entry);
    return entry;
  },

  getDraftOptions(state) {
    var options = [];
    var balls = SHELTER_CONTENT.careBalls.filter(function (b) {
      return !state.inventory.some(function (i) {
        return i.id === b.id;
      });
    });
    var perks = SHELTER_CONTENT.perks.filter(function (p) {
      return !state.perks.some(function (i) {
        return i.id === p.id;
      });
    });
    while (options.length < 3 && (balls.length || perks.length)) {
      if (Math.random() < 0.65 && balls.length) {
        var bi = Math.floor(Math.random() * balls.length);
        var b = balls.splice(bi, 1)[0];
        options.push({ kind: 'ball', id: b.id, name: b.name });
      } else if (perks.length) {
        var pi = Math.floor(Math.random() * perks.length);
        var p = perks.splice(pi, 1)[0];
        options.push({ kind: 'perk', id: p.id, name: p.name });
      } else if (balls.length) {
        var b2 = balls.splice(0, 1)[0];
        options.push({ kind: 'ball', id: b2.id, name: b2.name });
      }
    }
    if (!options.length) {
      options.push({ kind: 'upgrade', id: 'boost', name: 'Upgrade random item' });
    }
    return options.slice(0, 3);
  },

  applyDraftChoice(state, choice) {
    if (choice.kind === 'upgrade') {
      var all = state.inventory.concat(state.perks);
      if (all.length) {
        var pick = all[Math.floor(Math.random() * all.length)];
        pick.level = Math.min(3, (pick.level || 1) + 1);
      }
    } else {
      SP_RunState.addInventoryItem(state, choice);
    }
    state.pendingDraft = false;
  },
};
