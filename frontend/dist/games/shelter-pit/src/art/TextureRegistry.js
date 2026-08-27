var SP_TextureRegistry = {
  REQUIRED_KEYS: [],

  collectKeys() {
    var keys = ['ball:tennis', 'ui:card', 'ui:enrichment', 'ui:btn', 'ui:heart', 'ui:hpbar', 'pixel'];
    SHELTER_CONTENT.careBalls.forEach(function (b) {
      for (var t = 1; t <= 3; t++) keys.push('care:' + b.id + ':' + t);
    });
    SHELTER_CONTENT.perks.forEach(function (p) {
      keys.push('perk:' + p.id);
    });
    ['mud', 'noise', 'lonely', 'kennel'].forEach(function (type) {
      ['small', 'medium', 'large'].forEach(function (size) {
        keys.push('stressor:' + type + ':' + size);
      });
    });
    SHELTER_CONTENT.volunteers.forEach(function (v) {
      keys.push('vol:' + v.id);
    });
    ['pantry', 'laundry', 'toy_room', 'volunteer_home', 'gatherer'].forEach(function (k) {
      keys.push('bld:' + k);
    });
    ['floor', 'wall'].forEach(function (t) {
      keys.push('tile:' + t);
    });
    ['kibble', 'towel', 'supply'].forEach(function (r) {
      keys.push('tile:res:' + r);
    });
    keys.push('tile:zone');
    SHELTER_CONTENT.zones.forEach(function (z) {
      keys.push('bg:' + z.id);
      keys.push('bg:' + z.id + ':far');
    });
    SP_TextureRegistry.REQUIRED_KEYS = keys;
    return keys;
  },

  bakeAll(scene) {
    SP_CareBallGen.bakeAll(scene);
    SP_PerkGen.bakeAll(scene);
    SP_StressorGen.bakeAll(scene);
    SP_VolunteerGen.bakeAll(scene);
    SP_BuildingGen.bakeAll(scene);
    SP_TileGen.bakeAll(scene);
    SP_BackgroundGen.bakeAll(scene);
    SP_UiGen.bakeAll(scene);
    var keys = SP_TextureRegistry.collectKeys();
    var missing = keys.filter(function (k) {
      return !scene.textures.exists(k);
    });
    if (missing.length) {
      throw new Error('Missing baked textures: ' + missing.join(', '));
    }
    return keys;
  },

  keyForCareBall(id, level) {
    return 'care:' + id + ':' + (level || 1);
  },
};
