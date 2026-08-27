var SP_TileGen = {
  bakeAll(scene) {
    SP_Draw.bakeTexture(scene, 'tile:floor', 16, 16, function (g, w, h) {
      g.fillStyle(SP_PALETTE.kennelFloor, 1);
      g.fillRect(0, 0, w, h);
      g.fillStyle(0x7c6a4f, 0.3);
      g.fillRect(0, h - 2, w, 2);
    });
    SP_Draw.bakeTexture(scene, 'tile:wall', 16, 16, function (g, w, h) {
      g.fillStyle(SP_PALETTE.kennelWall, 1);
      g.fillRect(0, 0, w, h);
    });
    ['kibble', 'towel', 'supply'].forEach(function (res) {
      var colors = { kibble: 0xf59e0b, towel: 0x38bdf8, supply: 0x64748b };
      SP_Draw.bakeTexture(scene, 'tile:res:' + res, CFG.CELL, CFG.CELL, function (g, w, h) {
        SP_Draw.fillRoundRect(g, 4, 4, w - 8, h - 8, 4, colors[res]);
        SP_Draw.outline(g);
        g.strokeRoundedRect(4, 4, w - 8, h - 8, 4);
      });
    });
    SP_Draw.bakeTexture(scene, 'tile:zone', CFG.CELL, CFG.CELL, function (g, w, h) {
      g.fillStyle(SP_PALETTE.uiAccent, 0.25);
      g.fillRect(0, 0, w, h);
      g.lineStyle(1, SP_PALETTE.uiAccent, 0.6);
      g.strokeRect(1, 1, w - 2, h - 2);
    });
  },
};
