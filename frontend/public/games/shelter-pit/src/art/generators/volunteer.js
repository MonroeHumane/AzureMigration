var SP_VolunteerGen = {
  draw(g, w, h, seed, roleColor) {
    var cx = w / 2;
    var cy = h / 2;
    SP_Draw.fillRoundRect(g, 4, 4, w - 8, h - 8, 8, roleColor || 0x38bdf8);
    SP_Draw.outline(g);
    g.strokeRoundedRect(4, 4, w - 8, h - 8, 8);
    g.fillStyle(0xffdbac, 1);
    g.fillCircle(cx, cy - 4, 8);
    g.fillStyle(SP_PALETTE.outline, 1);
    g.fillCircle(cx - 3, cy - 5, 1.5);
    g.fillCircle(cx + 3, cy - 5, 1.5);
    g.fillStyle((seed % 2) ? 0x4a3728 : 0x1e293b, 1);
    g.fillRect(cx - 7, cy - 12, 14, 5);
  },

  bakeAll(scene) {
    SHELTER_CONTENT.volunteers.forEach(function (v) {
      var key = 'vol:' + v.id;
      SP_Draw.bakeTexture(scene, key, CFG.CELL, CFG.CELL, function (g, w, h) {
        SP_VolunteerGen.draw(g, w, h, v.seed || 1, v.color);
      });
    });
  },
};
