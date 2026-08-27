var SP_Draw = {
  outline(g, color) {
    g.lineStyle(2, color || SP_PALETTE.outline, 1);
  },

  fillCircle(g, x, y, r, color) {
    g.fillStyle(color, 1);
    g.fillCircle(x, y, r);
  },

  fillRoundRect(g, x, y, w, h, r, color) {
    g.fillStyle(color, 1);
    g.fillRoundedRect(x, y, w, h, r);
  },

  tierRing(g, cx, cy, radius, tier) {
    if (tier <= 1) return;
    var colors = [0, 0x94a3b8, 0x38bdf8, 0xf59e0b];
    g.lineStyle(3, colors[tier] || 0xffffff, 1);
    g.strokeCircle(cx, cy, radius + 2);
  },

  bakeTexture(scene, key, w, h, drawFn, hdMul) {
    var mul = hdMul || CFG.HD_MUL;
    var g = scene.make.graphics({ x: 0, y: 0, add: false });
    drawFn(g, w, h);
    g.generateTexture(key, w * mul, h * mul);
    g.destroy();
    if (scene.textures.exists(key)) {
      scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  },
};
