/* ─── Platform decor, particles, HUD helpers ─────────────────────────────── */

function foundPlatformHash32(plat, levelNum, levelSeed) {
  let h = ((levelSeed >>> 0) ^ ((levelNum || 1) * 2654435761)) >>> 0;
  h = Math.imul(h ^ ((Math.floor(plat.x) + 17) >>> 0), 2246822507) >>> 0;
  h = Math.imul(h ^ ((Math.floor(plat.y) + 31) >>> 0), 3266489909) >>> 0;
  h = Math.imul(h ^ ((Math.floor(plat.width) + 47) >>> 0), 668265263) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function foundGetPlatformTheme(levelNum) {
  const act = typeof foundGetActForLevel === 'function'
    ? foundGetActForLevel(levelNum || 1)
    : Math.ceil((levelNum || 1) / 4);
  const themes = CFG.ACT_PLATFORM_THEMES || {};
  return themes[act] || themes[1] || { color: 'green', variants: [1, 2, 3, 4] };
}

/** Returns the graphics colour palette for the given level number. */
function foundGetPlatformColors(levelNum) {
  const act = typeof foundGetActForLevel === 'function'
    ? foundGetActForLevel(levelNum || 1)
    : Math.ceil((levelNum || 1) / 4);
  const palette = (CFG.ACT_PLATFORM_COLORS || {})[act]
    || (CFG.ACT_PLATFORM_COLORS || {})[1]
    || { body: 0x5a8a3c, top: 0x7ec84a, shadow: 0x2a4a1c, topH: 5 };
  return palette;
}

/** Colours used for shelter / walkway platforms everywhere. */
const FOUND_SHELTER_PLAT_COLORS = { body: 0x8a6040, top: 0xc09060, shadow: 0x4a2c10, topH: 5 };

/**
 * Draw a single platform band using Phaser graphics (no tileSprite).
 * @param {Phaser.GameObjects.Graphics} g
 * @param {number} x  left edge
 * @param {number} y  top edge
 * @param {number} w  width
 * @param {number} h  height (PLATFORM_HEIGHT)
 * @param {{ body:number, top:number, shadow:number, topH:number }} c
 */
function _foundDrawPlatBand(g, x, y, w, h, c) {
  const topH = c.topH || 5;
  // Bottom shadow strip
  g.fillStyle(c.shadow, 1);
  g.fillRect(x, y + h - 2, w, 2);
  // Body
  g.fillStyle(c.body, 1);
  g.fillRect(x, y, w, h - 2);
  // Top surface stripe
  g.fillStyle(c.top, 1);
  g.fillRect(x, y, w, topH);
  // Subtle top highlight
  g.fillStyle(0xffffff, 0.18);
  g.fillRect(x + 2, y + 1, w - 4, 1);
}

function foundGetPlatformTextureKey(plat, opts) {
  if (!plat) {
    return 'found-platform-green';
  }
  if (plat.type === 'shelter') {
    return 'found-platform-brown';
  }

  const levelNum = opts?.levelNum || 1;
  const levelSeed = opts?.levelSeed || 0;
  const theme = foundGetPlatformTheme(levelNum);

  // If the act theme specifies a proper tiling surface, use it directly.
  // foundDrawPlatformSurface will fall back if the texture failed to load.
  if (theme.surfaceKey) {
    return theme.surfaceKey;
  }

  const variants = Array.isArray(theme.variants) && theme.variants.length
    ? theme.variants
    : [1, 2, 3, 4];
  const hash = foundPlatformHash32(plat, levelNum, levelSeed);
  const variant = variants[hash % variants.length];
  const num = String(variant).padStart(2, '0');
  const key = `found-platform-${theme.color}-${num}`;
  return key;
}

function foundDrawPlatformSurface(scene, plat, opts) {
  if (!scene || !scene.add) return null;
  const PH = opts?.height ?? CFG.PLATFORM_HEIGHT;
  const depth = opts?.depth ?? 9;
  const levelNum = opts?.levelNum || 1;
  const c = (plat.type === 'shelter')
    ? FOUND_SHELTER_PLAT_COLORS
    : foundGetPlatformColors(levelNum);
  const g = scene.add.graphics().setDepth(depth);
  _foundDrawPlatBand(g, plat.x, plat.y, plat.width, PH, c);
  if (opts?.scrollFactor !== undefined) {
    g.setScrollFactor(opts.scrollFactor, 0);
  }
  return g;
}

/**
 * Grass cap + edge highlight on platforms (single graphics per platform).
 *
 * @param {Phaser.Scene} scene
 * @param {Array<{x:number,y:number,width:number,type?:string}>} platforms
 */
function foundDecoratePlatforms(scene, platforms, opts) {
  if (!scene || !scene.add) return;
  const PH = CFG.PLATFORM_HEIGHT;
  const levelNum = opts?.levelNum || scene?.levelNum || 1;
  const colors = foundGetPlatformColors(levelNum);
  const g = scene.add.graphics().setDepth(9);
  platforms.forEach((plat) => {
    const c = (plat.type === 'shelter') ? FOUND_SHELTER_PLAT_COLORS : colors;
    _foundDrawPlatBand(g, plat.x, plat.y, plat.width, PH, c);
  });
}

function foundCreateCatShadow(scene, followSprite) {
  const scale = CFG.CAT_SCALE;
  const shadow = scene.add.ellipse(
    followSprite.x,
    followSprite.y + 4,
    24 * scale,
    8 * scale,
    0x1a2830,
    0.28
  );
  shadow.setDepth(9);
  return shadow;
}

function foundUpdateCatShadow(shadow, sprite, onGround) {
  if (!shadow || !sprite) {
    return;
  }
  shadow.x = Math.round(sprite.x);
  shadow.y = Math.round(sprite.y + 4);
  const air = onGround ? 0 : 1;
  shadow.setScale(1 - air * 0.15, 1 - air * 0.35);
  shadow.setAlpha(onGround ? 0.3 : 0.16);
}

function foundEmitLandDust(scene, x, y) {
  if (!scene.add.particles) {
    return;
  }
  const emitter = scene.add.particles(x, y, 'pixel', {
    speed: { min: 20, max: 70 },
    angle: { min: 200, max: 340 },
    scale: { start: 0.35, end: 0 },
    lifespan: 280,
    quantity: 5,
    tint: [0xc4a574, 0x8b7355, 0x6b8e4e],
    gravityY: 120,
  });
  emitter.setDepth(11);
  scene.time.delayedCall(320, () => emitter.destroy());
}

function foundEmitShelterCelebration(scene, x, y) {
  const colors = [0xffd700, 0xff6b9d, 0x7ec8e3, 0x98d98e, 0xffffff];
  for (let i = 0; i < 3; i++) {
    scene.time.delayedCall(i * 120, () => {
      const emitter = scene.add.particles(x, y - 20, 'pixel', {
        speed: { min: 40, max: 160 },
        angle: { min: 200, max: 340 },
        scale: { start: 0.5, end: 0 },
        lifespan: 700,
        quantity: 12,
        tint: colors,
        gravityY: 200,
      });
      emitter.setDepth(25);
      scene.time.delayedCall(750, () => emitter.destroy());
    });
  }
}

/**
 * Animal shelter facade (game goal + end screen).
 *
 * @param {Phaser.Scene} scene
 * @param {number} wallX left edge of brick wall
 * @param {number} platformY top of platform surface
 * @param {{ depth?: number, signDepth?: number }} [opts]
 * @returns {{ wallX: number, wallY: number, wallW: number, wallH: number, doorX: number }}
 */
function foundDrawShelterBuilding(scene, wallX, platformY, opts) {
  const wallW = 208;
  const wallH = 160;
  const wallY = platformY - wallH;
  const depth = opts?.depth ?? 6;
  const signDepth = opts?.signDepth ?? 10;

  const g = scene.add.graphics().setDepth(depth);

  g.fillStyle(0x9a5828, 0.35);
  g.fillRect(wallX + 8, platformY, wallW - 10, 14);

  g.fillStyle(0xC8722A);
  g.fillRect(wallX, wallY, wallW, wallH);

  g.fillStyle(0x5c3010, 1);
  g.fillTriangle(
    wallX - 6, wallY,
    wallX + wallW + 6, wallY,
    wallX + wallW / 2, wallY - Math.round(wallH * 0.22)
  );

  const brickW = 40;
  const brickH = 18;
  const mortar = 2;
  const inset = 6;
  let row = 0;
  for (let by = wallY + 10; by + brickH < wallY + wallH - 34; by += brickH + mortar) {
    const shift = (row % 2) * Math.round(brickW / 2);
    for (let bx = wallX + inset + shift; bx + brickW <= wallX + wallW - inset; bx += brickW + mortar) {
      g.fillStyle(0xbe6828, 1);
      g.fillRect(bx, by, brickW, brickH);
      g.fillStyle(0x9a5520, 0.45);
      g.fillRect(bx, by + brickH - 3, brickW, 3);
    }
    row += 1;
  }
  g.lineStyle(1, 0x7a4518, 0.35);
  g.strokeRect(wallX + 1, wallY + 1, wallW - 2, wallH - 2);

  g.fillStyle(0x3a1800, 1);
  g.fillRect(wallX + wallW / 2 - 26, platformY - 78, 52, 78);
  g.fillEllipse(wallX + wallW / 2, platformY - 78, 52, 28);

  g.fillStyle(0xaadcff, 1);
  g.fillRect(wallX + 18, wallY + 32, 32, 28);
  g.lineStyle(2, 0x3a6080, 1);
  g.strokeRect(wallX + 18, wallY + 32, 32, 28);
  g.fillRect(wallX + wallW - 50, wallY + 32, 28, 24);
  g.strokeRect(wallX + wallW - 50, wallY + 32, 28, 24);

  const plaqueY = wallY - 28;
  g.fillStyle(0x5c3010, 1);
  g.fillRect(wallX + wallW / 2 - 72, plaqueY, 144, 22);
  g.lineStyle(2, 0x3a1800, 1);
  g.strokeRect(wallX + wallW / 2 - 72, plaqueY, 144, 22);

  if (typeof foundUiText === 'function') {
    foundUiText(scene, wallX + wallW / 2, plaqueY + 4, 'ANIMAL SHELTER', {
      useNativeSize: true,
      fontSize: '11px',
      fontStyle: '600',
      color: '#ffe8c8',
      letterSpacing: 1,
    }).setOrigin(0.5, 0).setDepth(signDepth);
  }

  return {
    wallX,
    wallY,
    wallW,
    wallH,
    doorX: wallX + wallW / 2,
    platformY,
  };
}

/**
 * Sky + ground + platform for LevelComplete (matches in-game shelter read).
 *
 * @param {Phaser.Scene} scene
 * @returns {{ groundY: number, platformY: number }}
 */
function foundBuildLevelCompleteBackdrop(scene) {
  const W = CFG.WIDTH;
  const H = CFG.HEIGHT;
  const platformY = Math.round(H * 0.54);
  const groundY = platformY + 8;
  const platW = 248;

  if (typeof foundBuildSky === 'function') {
    foundBuildSky(scene);
  }

  const earth = scene.add.graphics().setDepth(-8);
  earth.fillStyle(0x2d4a26, 1);
  earth.fillRect(0, groundY - 20, W, H - groundY + 80);
  earth.fillStyle(0x4d7a38, 1);
  earth.fillRect(0, groundY, W, 36);
  earth.fillStyle(0x62a048, 1);
  earth.fillRect(0, groundY, W, 14);
  earth.fillStyle(0x9a8b7a, 1);
  earth.fillRect(0, groundY - 20, W, 18);

  const platX = W / 2 - platW / 2;
  const platform = { x: platX, y: platformY, width: platW, type: 'shelter' };
  if (!foundDrawPlatformSurface(scene, platform, {
    height: CFG.PLATFORM_HEIGHT || 24,
    depth: 4,
    levelNum: scene?.levelNum || 1,
    levelSeed: scene?.levelSeed || 0,
  })) {
    const platG = scene.add.graphics().setDepth(4);
    platG.fillStyle(0xC8722A, 1);
    platG.fillRect(platX, platformY, platW, CFG.PLATFORM_HEIGHT || 24);
    platG.fillStyle(0x5a9a38, 1);
    const tufts = 6;
    for (let i = 0; i < tufts; i++) {
      const gx = platX + 12 + i * (platW / tufts);
      platG.fillTriangle(gx, platformY + 2, gx + 7, platformY - 8, gx + 14, platformY + 2);
    }
  }

  const wallX = W / 2 - 104;
  foundDrawShelterBuilding(scene, wallX, platformY, { depth: 6, signDepth: 11 });

  return { groundY, platformY, doorX: W / 2 };
}

/**
 * Rounded HUD card (level info, progress, etc.).
 *
 * @param {Phaser.Scene} scene
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} [radius]
 * @returns {Phaser.GameObjects.Graphics}
 */
function foundDrawHudCard(scene, x, y, w, h, radius) {
  const r = radius ?? 10;
  const g = scene.add.graphics().setScrollFactor(0);
  g.fillStyle(0xffffff, 0.92);
  g.lineStyle(2, 0x4a7c40, 0.35);
  g.fillRoundedRect(x, y, w, h, r);
  g.strokeRoundedRect(x, y, w, h, r);
  return g;
}

function foundShowLevelBanner(scene, levelNum) {
  const W = CFG.WIDTH;
  const name = (CFG.LEVEL_NAMES && CFG.LEVEL_NAMES[levelNum]) || `Level ${levelNum}`;
  const label = `Level ${levelNum} - ${name}`;

  const banner = typeof foundUiText === 'function'
    ? foundUiText(scene, W / 2, 142, label, {
      useNativeSize: true,
      fontSize: '20px',
      fontStyle: '600',
      color: '#2a1800',
      backgroundColor: '#ffffffdd',
      padding: { x: 18, y: 10 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(45).setAlpha(0)
    : scene.add.text(W / 2, 88, label, {
      fontSize: '22px',
      color: '#2a1800',
      backgroundColor: '#ffffffdd',
      padding: { x: 18, y: 10 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(45).setAlpha(0);

  scene.tweens.add({
    targets: banner,
    alpha: 1,
    y: 148,
    duration: 400,
    ease: 'Quad.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: banner,
        alpha: 0,
        y: 132,
        delay: 1200,
        duration: 500,
        onComplete: () => banner.destroy(),
      });
    },
  });
}
