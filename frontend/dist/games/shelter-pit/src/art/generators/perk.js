var SP_PerkGen = {
  draw(g, w, h, category) {
    var cx = w / 2;
    var cy = h / 2;
    SP_Draw.fillRoundRect(g, 6, 6, w - 12, h - 12, 6, 0x334155);
    SP_Draw.outline(g);
    g.strokeRoundedRect(6, 6, w - 12, h - 12, 6);
    g.fillStyle(SP_PALETTE.families[category] || SP_PALETTE.uiAccent, 1);
    g.fillRect(w - 10, 6, 4, 8);
    g.fillCircle(cx, cy, 8);
    g.fillStyle(SP_PALETTE.highlight, 0.8);
    g.fillRect(cx - 4, cy - 2, 8, 4);
  },

  bakeAll(scene) {
    SHELTER_CONTENT.perks.forEach(function (p) {
      var key = 'perk:' + p.id;
      SP_Draw.bakeTexture(scene, key, CFG.CELL, CFG.CELL, function (g, w, h) {
        SP_PerkGen.draw(g, w, h, p.category);
      });
    });
  },
};
