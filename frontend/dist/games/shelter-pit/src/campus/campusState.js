var SP_Campus = {
  defaultGrid() {
    var grid = [];
    for (var y = 0; y < CFG.CAMPUS.gridH; y++) {
      var row = [];
      for (var x = 0; x < CFG.CAMPUS.gridW; x++) {
        row.push({ type: 'floor', resource: null, building: null });
      }
      grid.push(row);
    }
    grid[3][2] = { type: 'floor', resource: 'kibble', building: null, amount: 3, max: 5 };
    grid[3][5] = { type: 'floor', resource: 'towel', building: null, amount: 2, max: 4 };
    grid[4][8] = { type: 'floor', resource: 'supply', building: null, amount: 1, max: 3 };
    return { tiles: grid, buildings: [] };
  },

  tickResources(save) {
    var campus = save.campus || SP_Campus.defaultGrid();
    var now = Date.now();
    var regrowMs = CFG.CAMPUS.regrowMinutes * 60 * 1000;
    if (!save.resourceTimers) save.resourceTimers = {};
    campus.tiles.forEach(function (row, y) {
      row.forEach(function (cell, x) {
        if (!cell.resource) return;
        var key = x + ',' + y;
        if (cell.amount >= cell.max) return;
        var last = save.resourceTimers[key] || now;
        if (now - last >= regrowMs) {
          cell.amount = Math.min(cell.max, (cell.amount || 0) + 1);
          save.resourceTimers[key] = now;
        }
        if (cell.building && SP_Campus._buildingNearResource(campus, x, y)) {
          if (now - last >= regrowMs / 2) {
            cell.amount = Math.min(cell.max, (cell.amount || 0) + 1);
            save.resourceTimers[key] = now;
          }
        }
      });
    });
    save.campus = campus;
    return campus;
  },

  _buildingNearResource(campus, rx, ry) {
    var buildings = campus.buildings || [];
    return buildings.some(function (b) {
      return Math.abs(b.x - rx) <= 2 && Math.abs(b.y - ry) <= 2;
    });
  },

  computeRunBonuses(save) {
    var bonuses = { damage: 0, extraBall: 0, timerGrace: 0 };
    var campus = save.campus || SP_Campus.defaultGrid();
    (campus.buildings || []).forEach(function (b) {
      var cfg = CFG.BUILDING_BONUSES[b.id];
      if (!cfg) return;
      if (cfg.damage) bonuses.damage += cfg.damage;
      if (cfg.extraBall) bonuses.extraBall += cfg.extraBall;
      if (cfg.timerGrace) bonuses.timerGrace += cfg.timerGrace;
    });
    return bonuses;
  },

  unlockVolunteerFromHome(save) {
    SHELTER_CONTENT.volunteers.forEach(function (v) {
      if (v.unlock === 'default') return;
      if (v.unlock.indexOf('building:') === 0 && v.unlock.slice(9) === 'volunteer_home') {
        if (save.unlockedVolunteers.indexOf(v.id) === -1) save.unlockedVolunteers.push(v.id);
      }
    });
  },

  placeBuilding(save, x, y, buildingId) {
    return SP_CampusPlacement.tryPlace(save, x, y, buildingId);
  },
};
