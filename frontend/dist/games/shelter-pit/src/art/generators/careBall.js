var SP_CareBallGen = {
  draw(g, w, h, family, tier, glyph) {
    var cx = w / 2;
    var cy = h / 2;
    var color = SP_PALETTE.families[family] || SP_PALETTE.uiAccent;
    SP_Draw.fillRoundRect(g, 4, 4, w - 8, h - 8, 10, color);
    SP_Draw.outline(g);
    g.strokeRoundedRect(4, 4, w - 8, h - 8, 10);
    SP_Draw.tierRing(g, cx, cy, w / 2 - 6, tier || 1);
    g.fillStyle(SP_PALETTE.highlight, 1);
    g.fillCircle(cx - 6, cy - 6, 3);
    g.fillStyle(SP_PALETTE.outline, 1);
    if (glyph === 'bone') {
      g.fillRect(cx - 8, cy - 2, 16, 4);
      g.fillCircle(cx - 8, cy, 4);
      g.fillCircle(cx + 8, cy, 4);
    } else if (glyph === 'brush') {
      g.fillRect(cx - 2, cy - 8, 4, 10);
      g.fillRect(cx - 6, cy + 2, 12, 4);
    } else if (glyph === 'star') {
      g.fillRect(cx - 1, cy - 7, 2, 14);
      g.fillRect(cx - 7, cy - 1, 14, 2);
    } else if (glyph === 'bell') {
      g.fillTriangle(cx, cy - 6, cx - 6, cy + 4, cx + 6, cy + 4);
    } else {
      g.fillCircle(cx, cy, 5);
    }
  },

  bakeAll(scene) {
    var balls = SHELTER_CONTENT.careBalls;
    balls.forEach(function (b) {
      for (var tier = 1; tier <= 3; tier++) {
        var key = 'care:' + b.id + ':' + tier;
        SP_Draw.bakeTexture(scene, key, CFG.CELL, CFG.CELL, function (g, w, h) {
          SP_CareBallGen.draw(g, w, h, b.family, tier, b.glyph);
        });
      }
    });
    SP_Draw.bakeTexture(scene, 'ball:tennis', CFG.CELL, CFG.CELL, function (g, w, h) {
      SP_Draw.fillCircle(g, w / 2, h / 2, w / 2 - 4, SP_PALETTE.tennis);
      SP_Draw.outline(g);
      g.strokeCircle(w / 2, h / 2, w / 2 - 4);
    });
  },
};
