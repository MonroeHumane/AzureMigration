var SP_ContentLoader = {
  mergeFromCache(jsonCache) {
    if (!jsonCache) return SHELTER_CONTENT;
    var keys = [
      ['sp_care_balls', 'careBalls'],
      ['sp_perks', 'perks'],
      ['sp_volunteers', 'volunteers'],
      ['sp_zones', 'zones'],
      ['sp_stressors', 'stressorTypes'],
      ['sp_recipes', 'recipes'],
    ];
    keys.forEach(function (pair) {
      if (jsonCache.exists(pair[0])) {
        var data = jsonCache.get(pair[0]);
        if (data) SHELTER_CONTENT[pair[1]] = data;
      }
    });
    return SHELTER_CONTENT;
  },
};
