var SP_BackgroundGen = {
  drawZone(g, w, h, zoneId) {
    var z = SP_PALETTE.zone[zoneId] || SP_PALETTE.zone.stray_alley;
    g.fillGradientStyle(z.sky, z.sky, SP_PALETTE.bgDark, SP_PALETTE.bgDark, 1);
    g.fillRect(0, 0, w, h * 0.35);
    g.fillStyle(z.floor, 1);
    g.fillRect(0, h * 0.35, w, h * 0.65);
    g.fillStyle(SP_PALETTE.kennelWall, 1);
    g.fillRect(0, h * 0.32, w, h * 0.04);
    for (var i = 0; i < 6; i++) {
      g.fillStyle(0xffffff, 0.08);
      g.fillRect(40 + i * 200, 80, 80, 120);
    }
  },

  drawFarLayer(g, w, h, zoneId) {
    var z = SP_PALETTE.zone[zoneId] || SP_PALETTE.zone.stray_alley;
    g.fillStyle(z.sky, 1);
    g.fillRect(0, 0, w, h);
    for (var i = 0; i < 8; i++) {
      g.fillStyle(0xffffff, 0.06);
      g.fillRect(i * 160, 20 + (i % 3) * 30, 60, 80);
    }
  },

  bakeAll(scene) {
    SHELTER_CONTENT.zones.forEach(function (z) {
      var key = 'bg:' + z.id;
      SP_Draw.bakeTexture(scene, key, CFG.WIDTH, CFG.HEIGHT, function (g, w, h) {
        SP_BackgroundGen.drawZone(g, w, h, z.id);
      }, 1);
      SP_Draw.bakeTexture(scene, key + ':far', CFG.WIDTH, 240, function (g, w, h) {
        SP_BackgroundGen.drawFarLayer(g, w, h, z.id);
      }, 1);
    });
  },
};
