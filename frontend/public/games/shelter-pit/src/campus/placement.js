var SP_CampusPlacement = {
  BUILDINGS: [
    { id: 'pantry', label: 'Pantry', cost: { kibble: 3 } },
    { id: 'laundry', label: 'Laundry', cost: { towel: 3 } },
    { id: 'toy_room', label: 'Toy Room', cost: { supply: 3 } },
    { id: 'volunteer_home', label: 'Volunteer Home', cost: { kibble: 2, supply: 2 } },
  ],

  canAfford(save, buildingId) {
    var def = SP_CampusPlacement.BUILDINGS.find(function (b) { return b.id === buildingId; });
    if (!def) return false;
    var supplies = save.supplies || {};
    return Object.keys(def.cost).every(function (k) {
      return (supplies[k] || 0) >= def.cost[k];
    });
  },

  spend(save, buildingId) {
    var def = SP_CampusPlacement.BUILDINGS.find(function (b) { return b.id === buildingId; });
    if (!def || !SP_CampusPlacement.canAfford(save, buildingId)) return false;
    save.supplies = save.supplies || {};
    Object.keys(def.cost).forEach(function (k) {
      save.supplies[k] = (save.supplies[k] || 0) - def.cost[k];
    });
    return true;
  },

  tryPlace(save, x, y, buildingId) {
    var campus = save.campus || SP_Campus.defaultGrid();
    if (!campus.tiles[y] || !campus.tiles[y][x]) return { ok: false, reason: 'Invalid tile' };
    var cell = campus.tiles[y][x];
    if (cell.building) return { ok: false, reason: 'Already built' };
    if (!SP_CampusPlacement.spend(save, buildingId)) return { ok: false, reason: 'Not enough supplies' };
    cell.building = buildingId;
    campus.buildings = campus.buildings || [];
    campus.buildings.push({ id: buildingId, x: x, y: y });
    if (buildingId === 'volunteer_home') {
      SP_Campus.unlockVolunteerFromHome(save);
    }
    save.campus = campus;
    return { ok: true };
  },
};
