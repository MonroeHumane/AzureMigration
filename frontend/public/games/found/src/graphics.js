/* ─── HD cat textures + crisp UI text ─────────────────────────────────────── */

const FOUND_FONT_DISPLAY = '"Fredoka", "Trebuchet MS", "Segoe UI", sans-serif';
const FOUND_FONT_UI = '"Fredoka", "Segoe UI", system-ui, sans-serif';

/**
 * Render at native canvas resolution to avoid supersample-then-shrink blur.
 * @returns {number}
 */
function foundGetRenderResolution() {
  // Match game resolution (HiDPI) so HUD text stays crisp even under Scale.FIT.
  return Math.max(1, Math.min(3, window.devicePixelRatio || 1));
}

/**
 * Scale UI font sizes from SD-authored px strings to HD canvas.
 * Game canvas is native 1280×720 - sizes are used as-is.
 * @param {string|number} size
 * @returns {string|number}
 */
function foundScaleUiFont(size) {
  return size;
}

/**
 * Nearest-neighbor upscale of the cat sheet for sharper pixels on HiDPI displays.
 *
 * @param {Phaser.Scene} scene
 * @returns {boolean}
 */
function foundBuildHdCatTextures(scene) {
  if (!scene.textures.exists('cat')) {
    return false;
  }
  if (scene.textures.exists('cat-hd')) {
    return true;
  }

  const mul = CFG.CAT_HD_MUL || 2;
  const frame = CFG.CAT_FRAME_PX || 32;
  const hdFrame = frame * mul;
  const srcTex = scene.textures.get('cat');
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

  scene.textures.addSpriteSheet('cat-hd', canvas, {
    frameWidth:  hdFrame,
    frameHeight: hdFrame,
  });
  scene.textures.get('cat-hd').setFilter(Phaser.Textures.FilterMode.NEAREST);
  return true;
}

/**
 * @returns {string}
 */
function foundGetCatTextureKey() {
  return CFG.CAT_TEXTURE_KEY || 'cat-hd';
}

/**
 * Align arcade body to HD frame feet (origin 0.5, 1).
 *
 * @param {Phaser.Physics.Arcade.Sprite} sprite
 */
function foundSyncCatHitbox(sprite) {
  if (!sprite || !sprite.body) {
    return;
  }
  const frame = CFG.CAT_TEXTURE_FRAME || ((CFG.CAT_FRAME_PX || 32) * (CFG.CAT_HD_MUL || 2));
  const bw = CFG.CAT_BODY_W || Math.round(frame * 0.6875);
  const bh = CFG.CAT_BODY_H || Math.round(frame * 0.8125);
  const bx = CFG.CAT_BODY_OFFSET_X ?? Math.round((frame - bw) * 0.5);
  const by = CFG.CAT_BODY_OFFSET_Y ?? (frame - bh);

  sprite.body.setSize(bw, bh);
  sprite.body.setOffset(bx, by);
  if (typeof sprite.refreshBody === 'function') {
    sprite.refreshBody();
  }
}

/**
 * @param {Phaser.Scene} scene
 * @param {string} [textureKey]
 */
function foundRegisterCatAnims(scene, textureKey) {
  const key = textureKey || foundGetCatTextureKey();
  if (!scene.textures.exists(key)) {
    return;
  }
  const a = scene.anims;
  Object.values(ANIMS).forEach((def) => {
    const animKey = def.key;
    if (a.exists(animKey)) {
      return;
    }
    a.create({
      key:       animKey,
      frames:    a.generateFrameNumbers(key, { start: def.start, end: def.end }),
      frameRate: def.frameRate,
      repeat:    def.repeat,
    });
  });
}

/**
 * Crisp UI label (menus, HUD, end screens).
 *
 * @param {Phaser.Scene} scene
 * @param {number} x
 * @param {number} y
 * @param {string} content
 * @param {Phaser.Types.GameObjects.Text.TextStyle} [style]
 * @returns {Phaser.GameObjects.Text}
 */
function foundUiText(scene, x, y, content, style) {
  const merged = Object.assign({}, style || {});
  const nativeSize = merged.useNativeSize === true;
  delete merged.useNativeSize;

  if (merged.fontSize && !nativeSize) {
    merged.fontSize = foundScaleUiFont(merged.fontSize);
  }

  const base = Object.assign({
    fontFamily: FOUND_FONT_UI,
    fontSize:   nativeSize ? '16px' : foundScaleUiFont('16px'),
    color:      '#ffffff',
    align:      'center',
  }, merged);

  // Game config.resolution already handles HiDPI; text resolution stacks on top and blurs UI.
  delete base.resolution;

  const text = scene.add.text(x, y, content, base);
  if (text.setResolution) {
    text.setResolution(1);
  }
  return text;
}

/**
 * Large display heading.
 *
 * @param {Phaser.Scene} scene
 * @param {number} x
 * @param {number} y
 * @param {string} content
 * @param {Phaser.Types.GameObjects.Text.TextStyle} [style]
 * @returns {Phaser.GameObjects.Text}
 */
function foundUiTitle(scene, x, y, content, style) {
  return foundUiText(scene, x, y, content, Object.assign({
    fontFamily: FOUND_FONT_DISPLAY,
    fontStyle:  '700',
  }, style || {})).setOrigin(0.5);
}

/**
 * Decorative cat for menu / end screens.
 *
 * @param {Phaser.Scene} scene
 * @param {number} x
 * @param {number} y
 * @param {string} animKey
 * @param {number} [displayScale]
 * @returns {Phaser.GameObjects.Sprite|null}
 */
function foundCreateSceneCat(scene, x, y, animKey, displayScale) {
  const key = foundGetCatTextureKey();
  if (!scene.textures.exists(key)) {
    return null;
  }
  foundRegisterCatAnims(scene, key);
  const scale = displayScale ?? (CFG.CAT_SCENE_SCALE || 4);
  const cat = scene.add.sprite(x, y, key)
    .setScale(scale)
    .setOrigin(0.5, 1)
    .setDepth(8);
  if (animKey && scene.anims.exists(animKey)) {
    cat.play(animKey);
  }
  return cat;
}

/**
 * Soft panel behind end-screen copy for readability.
 *
 * @param {Phaser.Scene} scene
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} color
 * @param {number} alpha
 * @returns {Phaser.GameObjects.Rectangle}
 */
function foundUiPanel(scene, x, y, w, h, color, alpha) {
  return scene.add.rectangle(x, y, w, h, color ?? 0x000000, alpha ?? 0.35)
    .setDepth(0);
}

function foundUiScreenCard(scene, x, y, w, h, opts) {
  const fill = opts?.fill ?? 0xf7f0df;
  const alpha = opts?.alpha ?? 0.96;
  const stroke = opts?.stroke ?? 0x4f6f3a;
  const radius = opts?.radius ?? 28;
  const depth = opts?.depth ?? 20;

  const shadow = scene.add.graphics().setDepth(depth);
  shadow.fillStyle(0x000000, 0.12);
  shadow.fillRoundedRect(x - (w / 2) + 8, y - (h / 2) + 10, w, h, radius);
  shadow.fillStyle(0x000000, 0.06);
  shadow.fillRoundedRect(x - (w / 2) + 11, y - (h / 2) + 13, w - 4, h - 4, Math.max(6, radius - 2));
  const card = scene.add.graphics().setDepth(depth + 1);
  card.fillStyle(fill, alpha);
  card.fillRoundedRect(x - (w / 2), y - (h / 2), w, h, radius);
  card.lineStyle(3, stroke, 0.9);
  card.strokeRoundedRect(x - (w / 2), y - (h / 2), w, h, radius);

  return { shadow, card };
}

function foundUiIconButton(scene, x, y, label, opts) {
  const width = opts?.width ?? 300;
  const height = opts?.height ?? 52;
  const fill = opts?.fill ?? 0x4a7c40;
  const stroke = opts?.stroke ?? 0x2e5228;
  const depth = opts?.depth ?? 30;
  const iconKey = opts?.iconKey;
  const textColor = opts?.textColor ?? '#ffffff';
  const container = scene.add.container(0, 0).setDepth(depth);
  const radius = Math.round(height * 0.5);
  // Match shadow silhouette to the actual button shape so round/pill buttons do not show boxy corners.
  const shadow = scene.add.graphics();
  shadow.fillStyle(0x000000, 0.14);
  shadow.fillRoundedRect(x - (width / 2) + 4, y - (height / 2) + 6, width, height, radius);
  shadow.fillStyle(0x000000, 0.08);
  shadow.fillRoundedRect(x - (width / 2) + 6, y - (height / 2) + 8, width, height, radius);
  const bg = scene.add.graphics();
  bg.fillStyle(fill, 0.98);
  bg.fillRoundedRect(x - (width / 2), y - (height / 2), width, height, radius);
  bg.lineStyle(2, stroke, 1);
  bg.strokeRoundedRect(x - (width / 2), y - (height / 2), width, height, radius);

  container.add([shadow, bg]);

  let icon = null;
  let textX = x;
  if (iconKey && scene.textures && scene.textures.exists(iconKey)) {
    icon = scene.add.image(x - (width / 2) + 28, y, iconKey)
      .setDisplaySize(20, 20)
      .setOrigin(0.5);
    textX = x + 10;
    container.add(icon);
  }

  const text = foundUiText(scene, textX, y, label, {
    useNativeSize: true,
    fontSize: opts?.fontSize ?? '17px',
    fontStyle: opts?.fontStyle ?? '700',
    color: textColor,
  }).setOrigin(0.5);
  container.add(text);

  const hit = scene.add.zone(x, y, width, height)
    .setOrigin(0.5)
    .setDepth(depth + 1)
    .setInteractive({ useHandCursor: true });

  hit.on('pointerover', () => container.setAlpha(0.92));
  hit.on('pointerout', () => container.setAlpha(1));
  hit.on('pointerdown', () => container.setScale(0.985));
  hit.on('pointerup', () => container.setScale(1));

  return { container, shadow, bg, icon, text, hit };
}
