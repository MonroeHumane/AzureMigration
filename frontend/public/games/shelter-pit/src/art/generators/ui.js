var SP_UiGen = {
  bakeAll(scene) {
    SP_Draw.bakeTexture(scene, 'ui:card', 120, 140, function (g, w, h) {
      SP_Draw.fillRoundRect(g, 2, 2, w - 4, h - 4, 10, SP_PALETTE.uiPanel);
      SP_Draw.outline(g);
      g.strokeRoundedRect(2, 2, w - 4, h - 4, 10);
    }, 1);
    SP_Draw.bakeTexture(scene, 'ui:enrichment', 64, 64, function (g, w, h) {
      SP_Draw.fillCircle(g, w / 2, h / 2, w / 2 - 4, 0x7c3aed);
      SP_Draw.outline(g);
      g.strokeCircle(w / 2, h / 2, w / 2 - 4);
      g.fillStyle(SP_PALETTE.highlight, 0.9);
      g.fillCircle(w / 2, h / 2, 8);
    });
    SP_Draw.bakeTexture(scene, 'ui:btn', 160, 48, function (g, w, h) {
      SP_Draw.fillRoundRect(g, 0, 0, w, h, 12, 0x1d4ed8);
      SP_Draw.outline(g);
      g.strokeRoundedRect(0, 0, w, h, 12);
    }, 1);
    SP_Draw.bakeTexture(scene, 'ui:heart', 24, 24, function (g, w, h) {
      g.fillStyle(SP_PALETTE.heart, 1);
      g.fillCircle(8, 10, 6);
      g.fillCircle(16, 10, 6);
      g.fillTriangle(4, 12, 20, 12, 12, 22);
    });
    SP_Draw.bakeTexture(scene, 'ui:hpbar', 40, 6, function (g, w, h) {
      g.fillStyle(0x1e293b, 1);
      g.fillRect(0, 0, w, h);
      g.fillStyle(0x22c55e, 1);
      g.fillRect(0, 0, w - 4, h);
    }, 1);
    if (!scene.textures.exists('pixel')) {
      var pg = scene.make.graphics({ x: 0, y: 0, add: false });
      pg.fillStyle(0xffffff, 1);
      pg.fillRect(0, 0, 4, 4);
      pg.generateTexture('pixel', 4, 4);
      pg.destroy();
    }
  },
};
