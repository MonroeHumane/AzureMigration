var SP_StressorGen = {
  draw(g, w, h, type, size) {
    var color = SP_PALETTE.stressor[type] || 0x64748b;
    var pad = size === 'large' ? 2 : size === 'small' ? 8 : 4;
    SP_Draw.fillRoundRect(g, pad, pad, w - pad * 2, h - pad * 2, 8, color);
    SP_Draw.outline(g);
    g.strokeRoundedRect(pad, pad, w - pad * 2, h - pad * 2, 8);
    g.fillStyle(SP_PALETTE.highlight, 0.5);
    if (type === 'mud') {
      g.fillEllipse(w / 2, h / 2 + 4, w / 3, h / 6);
    } else if (type === 'noise') {
      for (var i = 0; i < 3; i++) {
        g.fillTriangle(w / 2 - 8 + i * 8, h / 2 + 6, w / 2 - 4 + i * 8, h / 2 - 6, w / 2 + i * 8, h / 2 + 6);
      }
    } else if (type === 'lonely') {
      g.fillCircle(w / 2 - 4, h / 2 - 2, 2);
      g.fillCircle(w / 2 + 4, h / 2 - 2, 2);
      g.fillRect(w / 2 - 3, h / 2 + 4, 6, 2);
    } else {
      g.fillRect(w / 2 - 8, h / 2 - 4, 16, 10);
    }
  },

  bakeAll(scene) {
    ['mud', 'noise', 'lonely', 'kennel'].forEach(function (type) {
      ['small', 'medium', 'large'].forEach(function (size) {
        var key = 'stressor:' + type + ':' + size;
        SP_Draw.bakeTexture(scene, key, CFG.CELL, CFG.CELL, function (g, w, h) {
          SP_StressorGen.draw(g, w, h, type, size);
        });
      });
    });
  },
};
