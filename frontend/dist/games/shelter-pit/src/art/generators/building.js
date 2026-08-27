var SP_BuildingGen = {
  draw(g, w, h, kind) {
    var base = 0x475569;
    if (kind === 'pantry') base = 0xf59e0b;
    if (kind === 'laundry') base = 0x38bdf8;
    if (kind === 'toy_room') base = 0x22c55e;
    if (kind === 'volunteer_home') base = 0xa78bfa;
    g.fillStyle(base, 1);
    g.fillRect(8, 14, w - 16, h - 18);
    g.fillStyle(SP_PALETTE.highlight, 1);
    g.fillTriangle(w / 2, 6, 6, 16, w - 6, 16);
    SP_Draw.outline(g);
    g.strokeRect(8, 14, w - 16, h - 18);
  },

  bakeAll(scene) {
    ['pantry', 'laundry', 'toy_room', 'volunteer_home', 'gatherer'].forEach(function (kind) {
      var key = 'bld:' + kind;
      SP_Draw.bakeTexture(scene, key, CFG.CELL * 2, CFG.CELL * 2, function (g, w, h) {
        SP_BuildingGen.draw(g, w, h, kind);
      });
    });
  },
};
