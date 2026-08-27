/* ─── HD cat texture builder + anim registration ─────────────────────────
   Same 2x nearest-neighbor upscale technique as found/src/graphics.js's
   foundBuildHdCatTextures - reuses found's cat-sheet.png asset (a generic,
   untinted cat design) rather than drawing 4 separate companion sheets.
   Companion identity comes from Phaser sprite.setTint(), not separate art. */

function srBuildHdCatTexture(scene) {
  if (!scene.textures.exists('sr-cat')) {
    return false;
  }
  if (scene.textures.exists(CFG.CAT_TEXTURE_KEY)) {
    return true;
  }

  const mul = CFG.CAT_HD_MUL;
  const frame = CFG.CAT_FRAME_PX;
  const hdFrame = frame * mul;
  const srcTex = scene.textures.get('sr-cat');
  const srcImg = srcTex.getSourceImage();

  if (!srcImg || !srcImg.width) {
    return false;
  }

  const canvas = document.createElement('canvas');
  canvas.width = srcImg.width * mul;
  canvas.height = srcImg.height * mul;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(srcImg, 0, 0, canvas.width, canvas.height);

  scene.textures.addSpriteSheet(CFG.CAT_TEXTURE_KEY, canvas, {
    frameWidth:  hdFrame,
    frameHeight: hdFrame,
  });
  scene.textures.get(CFG.CAT_TEXTURE_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);
  return true;
}

function srRegisterCatAnims(scene) {
  const key = CFG.CAT_TEXTURE_KEY;
  if (!scene.textures.exists(key)) {
    return;
  }
  const a = scene.anims;
  Object.values(ANIMS).forEach((def) => {
    if (a.exists(def.key)) {
      return;
    }
    a.create({
      key:       def.key,
      frames:    a.generateFrameNumbers(key, { start: def.start, end: def.end }),
      frameRate: def.frameRate,
      repeat:    def.repeat,
    });
  });
}

function srSyncCatHitbox(sprite) {
  if (!sprite || !sprite.body) {
    return;
  }
  sprite.body.setSize(CFG.CAT_BODY_W, CFG.CAT_BODY_H);
  sprite.body.setOffset(CFG.CAT_BODY_OFFSET_X, CFG.CAT_BODY_OFFSET_Y);
  if (typeof sprite.refreshBody === 'function') {
    sprite.refreshBody();
  }
}

/** Crisp UI text helper, matching found's foundUiText convention. */
function srUiText(scene, x, y, content, style) {
  return scene.add.text(x, y, content, Object.assign({
    fontFamily: '"Fredoka", "Segoe UI", system-ui, sans-serif',
    color: '#ffffff',
  }, style || {})).setOrigin(0.5);
}

/** 1x1 white pixel texture for tinted rectangles/particles, no PNG needed. */
function srBuildPixelTexture(scene) {
  if (scene.textures.exists('sr-pixel')) {
    return;
  }
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0xffffff);
  g.fillRect(0, 0, 1, 1);
  g.generateTexture('sr-pixel', 1, 1);
  g.destroy();
}
