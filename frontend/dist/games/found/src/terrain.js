/* ─── World terrain - layered parallax, platform-aware placement ──────────── */

const FOUND_DEPTH = {
  SKY:      -30,
  CLOUD_FAR:-28,
  CLOUD_MID:-26,
  HILL_FAR: -22,
  HILL_MID: -18,
  HOUSES:   -14,
  GROUND:   -12,
  HILL_NEAR:-10,
  SIDEWALK:  -9,
  FENCE:     -8,
  GROUND_DEC:-6,
  SUPPORTS:   2,
};

const FOUND_BG_CLOUD_KEYS = [
  'found-bg-cloud-1', 'found-bg-cloud-2', 'found-bg-cloud-3',
  'found-bg-cloud-4', 'found-bg-cloud-5', 'found-bg-cloud-6',
  'found-bg-cloud-7', 'found-bg-cloud-8',
];
const FOUND_BG_MOUNTAIN_KEYS = [
  'found-bg-mountain-a', 'found-bg-mountain-b', 'found-bg-mountain-c',
  'found-bg-hills', 'found-bg-hills-large',
];
const FOUND_BG_HOUSE_KEYS = [
  'found-bg-house-1', 'found-bg-house-2',
  'found-bg-house-alt-1', 'found-bg-house-alt-2',
  'found-bg-house-small-1', 'found-bg-house-small-2',
  'found-bg-house-small-alt-1', 'found-bg-house-small-alt-2',
  'found-bg-tower', 'found-bg-tower-small',
];
const FOUND_BG_SUBURB_BUILDING_KEYS = [
  'found-bg-suburb-building-a', 'found-bg-suburb-building-b',
  'found-bg-suburb-building-c', 'found-bg-suburb-building-d',
  'found-bg-suburb-building-e',
];
const FOUND_BG_TREE_KEYS = [
  'found-bg-tree', 'found-bg-tree-long', 'found-bg-tree-pine',
  'found-bg-tree-small-1', 'found-bg-tree-small-3',
  'found-bg-tree-small-green-1', 'found-bg-tree-small-green-2', 'found-bg-tree-small-green-3',
  'found-bg-tree-small-green-alt-1', 'found-bg-tree-small-green-alt-2',
  'found-bg-suburb-tree-large',
];
const FOUND_BG_TREE_MID_KEYS = [
  'found-bg-tree', 'found-bg-tree-long', 'found-bg-tree-orange', 'found-bg-tree-dead',
  'found-bg-tree-pine', 'found-bg-tree-small-green-1', 'found-bg-tree-small-green-2',
];
const FOUND_BG_BUSH_KEYS = [
  'found-bg-bush-1', 'found-bg-bush-2', 'found-bg-bush-3', 'found-bg-bush-4',
  'found-bg-bush-alt-2', 'found-bg-bush-alt-3', 'found-bg-bush-alt-4',
];
const FOUND_BG_FOLIAGE_KEYS = [
  'found-bg-foliage-1', 'found-bg-foliage-2', 'found-bg-foliage-3',
  'found-bg-foliage-4', 'found-bg-foliage-5', 'found-bg-foliage-6',
];

function foundPickTextureKey(scene, keys, rng) {
  if (!scene || !scene.textures || !Array.isArray(keys)) {
    return null;
  }
  const choices = keys.filter((key) => scene.textures.exists(key));
  if (!choices.length) {
    return null;
  }
  return choices[Math.floor(rng() * choices.length) % choices.length];
}

function foundAddBackdropSprite(scene, key, x, y, opts) {
  if (!key || !scene || !scene.textures || !scene.textures.exists(key)) {
    return null;
  }
  const sprite = scene.add.image(x, y, key)
    .setOrigin(opts?.originX ?? 0.5, opts?.originY ?? 1)
    .setDepth(opts?.depth ?? 0);

  if (opts?.scrollX !== undefined || opts?.scrollY !== undefined) {
    sprite.setScrollFactor(opts?.scrollX ?? 1, opts?.scrollY ?? 1);
  }
  if (opts?.alpha !== undefined) {
    sprite.setAlpha(opts.alpha);
  }
  if (opts?.rotation !== undefined) {
    sprite.setRotation(opts.rotation);
  }
  if (opts?.displayWidth !== undefined && opts?.displayHeight !== undefined) {
    sprite.setDisplaySize(opts.displayWidth, opts.displayHeight);
  } else if (opts?.fitHeight !== undefined && sprite.height > 0) {
    const scale = opts.fitHeight / sprite.height;
    sprite.setScale(scale);
  } else if (opts?.scale !== undefined) {
    sprite.setScale(opts.scale);
  }
  return sprite;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {Array<{x:number,y:number,width:number}>} platforms
 * @param {number} [padX]
 * @param {number} [padY]
 */
function foundPointNearPlatform(x, y, platforms, padX, padY) {
  if (!platforms || !platforms.length) {
    return false;
  }
  const mx = padX ?? 48;
  const my = padY ?? 100;
  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i];
    if (
      x >= p.x - mx
      && x <= p.x + p.width + mx
      && y >= p.y - my
      && y <= p.y + CFG.PLATFORM_HEIGHT + 24
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Screen-fixed sky with parallax clouds (scrollFactor 0).
 *
 * @param {Phaser.Scene} scene
 */
function foundBuildSky(scene) {
  const W = CFG.WIDTH;
  const H = CFG.HEIGHT;
  const horizon = Math.round(H * 0.72);

  const sky = scene.add.graphics().setScrollFactor(0).setDepth(FOUND_DEPTH.SKY);
  sky.fillGradientStyle(0x4a9fd4, 0x4a9fd4, 0x87ceeb, 0xb8e8f8, 1);
  sky.fillRect(0, 0, W, horizon);
  sky.fillStyle(0xd4edc4, 1);
  sky.fillRect(0, horizon - 24, W, 24);
  sky.fillStyle(0xe8f5dc, 1);
  sky.fillRect(0, horizon, W, H - horizon);

  const sunX = W * 0.78;
  const sunY = Math.round(H * 0.14);
  scene.add.circle(sunX, sunY, 64, 0xfff4a8, 0.18).setScrollFactor(0).setDepth(FOUND_DEPTH.SKY);
  scene.add.circle(sunX, sunY, 48, 0xfff4a8, 0.28).setScrollFactor(0).setDepth(FOUND_DEPTH.SKY);
  scene.add.circle(sunX, sunY, 36, 0xfff8d0, 0.95).setScrollFactor(0).setDepth(FOUND_DEPTH.SKY);

  const birds = scene.add.graphics().setScrollFactor(0.04, 0).setDepth(FOUND_DEPTH.CLOUD_MID);
  birds.lineStyle(2, 0x2a3a48, 0.35);
  for (let i = 0; i < 6; i++) {
    const bx = 80 + i * (W / 6) + (i % 2) * 30;
    const by = 56 + (i % 3) * 18;
    birds.beginPath();
    birds.moveTo(bx - 8, by);
    birds.lineTo(bx, by - 4);
    birds.lineTo(bx + 8, by);
    birds.strokePath();
  }

  const cloudRng = typeof createSeededRng === 'function' ? createSeededRng(90210) : Math.random;
  for (let layer = 0; layer < 2; layer++) {
    const depth = layer === 0 ? FOUND_DEPTH.CLOUD_FAR : FOUND_DEPTH.CLOUD_MID;
    const scroll = layer === 0 ? 0.06 : 0.14;
    const count = layer === 0 ? 4 : 5;
    for (let i = 0; i < count; i++) {
      const cx = cloudRng() * (W + 120) - 60;
      const cy = 40 + cloudRng() * (horizon - 100);
      const ew = 100 + cloudRng() * 80;
      const key = foundPickTextureKey(scene, FOUND_BG_CLOUD_KEYS, cloudRng);
      if (key) {
        foundAddBackdropSprite(scene, key, cx, cy, {
          originX: 0.5,
          originY: 0.5,
          depth,
          scrollX: scroll,
          scrollY: 0,
          alpha: layer === 0 ? 0.35 : 0.5,
          displayWidth: ew,
          displayHeight: 36 + cloudRng() * 20,
        });
      } else {
        scene.add.ellipse(cx, cy, ew, 36 + cloudRng() * 20, 0xffffff, layer === 0 ? 0.35 : 0.5)
          .setScrollFactor(scroll, 0).setDepth(depth);
      }
    }
  }

  return { horizon };
}

/**
 * @param {Phaser.Scene} scene
 * @param {number} baseX
 * @param {number} baseY
 * @param {number} w
 * @param {number} h
 * @param {number} wallColor
 * @param {number} depth
 * @param {number} scrollX
 */
function foundDrawHouse(scene, baseX, baseY, w, h, wallColor, depth, scrollX) {
  const left = baseX - w / 2;
  const g = scene.add.graphics().setScrollFactor(scrollX, 0).setDepth(depth);

  g.fillStyle(0x4a3a2a, 0.35);
  g.fillRect(left + 6, baseY + 2, w - 4, 8);

  g.fillStyle(0x8a7a6a, 1);
  g.fillRect(left - 2, baseY - 2, w + 4, 5);

  g.fillStyle(wallColor, 1);
  g.fillRect(left, baseY - h, w, h);

  g.fillStyle(0x5c3010, 1);
  g.fillTriangle(
    left - 8, baseY - h,
    left + w + 8, baseY - h,
    left + w / 2, baseY - h - Math.round(h * 0.4)
  );

  g.fillStyle(0x2a1408, 1);
  g.fillRect(left + w / 2 - 14, baseY - Math.round(h * 0.45), 28, Math.round(h * 0.45));
  g.fillEllipse(left + w / 2, baseY - Math.round(h * 0.45), 28, 18);

  g.fillStyle(0xb8e4ff, 1);
  g.fillRect(left + 14, baseY - h + 18, 22, 20);
  g.lineStyle(2, 0x4a6070, 1);
  g.strokeRect(left + 14, baseY - h + 18, 22, 20);
  g.beginPath();
  g.moveTo(left + 25, baseY - h + 18);
  g.lineTo(left + 25, baseY - h + 38);
  g.moveTo(left + 14, baseY - h + 28);
  g.lineTo(left + 36, baseY - h + 28);
  g.strokePath();

  if (w > 100) {
    g.fillStyle(0xb8e4ff, 1);
    g.fillRect(left + w - 38, baseY - h + 18, 20, 16);
    g.lineStyle(2, 0x4a6070, 1);
    g.strokeRect(left + w - 38, baseY - h + 18, 20, 16);
  }

  return g;
}

/**
 * Far mountain silhouettes (furthest parallax layer, scroll 0.10-0.14).
 */
function foundBuildParallaxMountains(scene, worldW, groundY, rng) {
  // Try sprite-based mountains first; fall back to drawn ellipses.
  const hasMtnSprites = FOUND_BG_MOUNTAIN_KEYS.some((k) => scene.textures && scene.textures.exists(k));
  if (hasMtnSprites) {
    // Tile mountain sprites across the world at two sub-layers.
    const configs = [
      { scroll: 0.09, depth: FOUND_DEPTH.HILL_FAR - 2, alpha: 0.55, fitH: 180, step: 340, yOff: 30 },
      { scroll: 0.13, depth: FOUND_DEPTH.HILL_FAR,     alpha: 0.72, fitH: 140, step: 280, yOff: 12 },
    ];
    configs.forEach(({ scroll, depth, alpha, fitH, step, yOff }) => {
      for (let x = -80; x < worldW + step; x += step + Math.floor(rng() * 120)) {
        const key = foundPickTextureKey(scene, FOUND_BG_MOUNTAIN_KEYS, rng);
        if (key) {
          foundAddBackdropSprite(scene, key, x, groundY - yOff, {
            originX: 0,
            originY: 1,
            depth,
            scrollX: scroll,
            scrollY: 0,
            alpha,
            fitHeight: fitH,
          });
        }
      }
    });
  } else {
    // Fallback: drawn silhouette mountains.
    const farMtn = scene.add.graphics().setScrollFactor(0.09, 0).setDepth(FOUND_DEPTH.HILL_FAR - 2);
    farMtn.fillStyle(0x3a5c36, 0.45);
    for (let x = -200; x < worldW + 400; x += 360) {
      farMtn.fillTriangle(x, groundY, x + 240, groundY - 180, x + 480, groundY);
    }
  }
}

/**
 * Parallax hills behind neighborhood.
 *
 * @param {Phaser.Scene} scene
 * @param {number} worldW
 * @param {number} groundY
 * @param {Phaser.Scene} rng
 */
function foundBuildParallaxHills(scene, worldW, groundY, rng) {
  const far = scene.add.graphics().setScrollFactor(0.22, 0).setDepth(FOUND_DEPTH.HILL_FAR);
  far.fillStyle(0x3d6b38, 0.55);
  for (let x = -100; x < worldW + 200; x += 220) {
    const hx = x + Math.floor(rng() * 60);
    far.fillEllipse(hx, groundY + 20, 280, 90);
  }

  const mid = scene.add.graphics().setScrollFactor(0.38, 0).setDepth(FOUND_DEPTH.HILL_MID);
  mid.fillStyle(0x4a7a44, 0.7);
  for (let x = 0; x < worldW + 160; x += 180) {
    const hx = x + Math.floor(rng() * 50);
    mid.fillEllipse(hx, groundY + 8, 220, 64);
  }
}

/**
 * Mid-ground tree canopy row (scroll 0.58) — sits between houses and near-hills.
 */
function foundBuildMidGroundTrees(scene, worldW, groundY, rng) {
  const step = 110;
  for (let x = 40; x < worldW + step; x += step + Math.floor(rng() * 80)) {
    const key = foundPickTextureKey(scene, FOUND_BG_TREE_MID_KEYS, rng);
    if (!key) {
      continue;
    }
    const treeH = 72 + Math.floor(rng() * 48);
    foundAddBackdropSprite(scene, key, x, groundY - 4, {
      originX: 0.5,
      originY: 1,
      depth: FOUND_DEPTH.HOUSES + 2,
      scrollX: 0.58,
      scrollY: 0,
      alpha: 0.82,
      fitHeight: treeH,
    });
  }
}

/**
 * Near-ground foliage fill row (scroll 0.80) — just behind ground-level trees.
 */
function foundBuildNearFoliage(scene, worldW, groundY, rng, platforms) {
  const step = 72;
  for (let x = 24; x < worldW - 24; x += step + Math.floor(rng() * 48)) {
    if (foundPointNearPlatform(x, groundY, platforms, 40, 80)) {
      continue;
    }
    const key = foundPickTextureKey(scene, FOUND_BG_FOLIAGE_KEYS, rng);
    if (!key) {
      continue;
    }
    foundAddBackdropSprite(scene, key, x, groundY, {
      originX: 0.5,
      originY: 1,
      depth: FOUND_DEPTH.GROUND_DEC - 1,
      scrollX: 0.80,
      scrollY: 0,
      alpha: 0.75,
      fitHeight: 22 + Math.floor(rng() * 14),
    });
  }
}

/**
 * Sparse houses - never placed under platforms.
 *
 * @param {Phaser.Scene} scene
 * @param {number} worldW
 * @param {number} sidewalkY
 * @param {*} rng
 * @param {Array} platforms
 */
function foundGetShelterPlatform(platforms) {
  if (!platforms || !platforms.length) {
    return null;
  }
  for (let i = platforms.length - 1; i >= 0; i--) {
    if (platforms[i].type === 'shelter') {
      return platforms[i];
    }
  }
  return platforms[platforms.length - 1];
}

function foundPlaceBackgroundHouses(scene, worldW, sidewalkY, rng, platforms) {
  const palette = [0xc49a6c, 0xb89068, 0xd4a574, 0xa88458, 0xc8a880];
  const shelter = foundGetShelterPlatform(platforms);
  let x = 120;
  let guard = 0;

  while (x < worldW - 200 && guard < 80) {
    guard += 1;
    const hw = 90 + Math.floor(rng() * 50);
    const hh = 72 + Math.floor(rng() * 40);
    const cx = x + hw / 2;

    const nearShelter = shelter
      && cx >= shelter.x - 260
      && cx <= shelter.x + shelter.width + 260;

    if (!nearShelter && !foundPointNearPlatform(cx, sidewalkY, platforms, 100, 140)) {
      const key = foundPickTextureKey(scene, FOUND_BG_HOUSE_KEYS, rng);
      if (key) {
        foundAddBackdropSprite(scene, key, cx, sidewalkY + 3, {
          depth: FOUND_DEPTH.HOUSES,
          scrollX: 0.48,
          scrollY: 0,
          fitHeight: hh + 48,
        });
      } else {
        const col = palette[Math.floor(rng() * palette.length)];
        foundDrawHouse(scene, cx, sidewalkY, hw, hh, col, FOUND_DEPTH.HOUSES, 0.48);
      }
    }
    x += hw + 80 + Math.floor(rng() * 90);
  }
}

/**
 * Ground strip + sparse decor (platform-aware).
 *
 * @param {Phaser.Scene} scene
 * @param {number} worldW
 * @param {number} groundY
 * @param {*} rng
 * @param {Array} platforms
 */
function foundBuildGroundStrip(scene, worldW, groundY, rng, platforms) {
  const H = CFG.HEIGHT;
  const sidewalkY = groundY - 20;

  const earth = scene.add.graphics().setDepth(FOUND_DEPTH.GROUND);
  earth.fillStyle(0x2d4a26, 1);
  earth.fillRect(0, sidewalkY, worldW, H + 400);
  earth.fillStyle(0x4d7a38, 1);
  earth.fillRect(0, groundY, worldW, 36);
  earth.fillStyle(0x62a048, 1);
  earth.fillRect(0, groundY, worldW, 14);
  earth.fillStyle(0x9a8b7a, 1);
  earth.fillRect(0, sidewalkY, worldW, 18);
  earth.fillStyle(0xc4b4a4, 1);
  earth.fillRect(0, sidewalkY + 3, worldW, 5);

  const nearHills = scene.add.graphics().setScrollFactor(0.72, 0).setDepth(FOUND_DEPTH.HILL_NEAR);
  nearHills.fillStyle(0x568c48, 0.85);
  for (let x = -60; x < worldW + 100; x += 160) {
    nearHills.fillEllipse(x + Math.floor(rng() * 40), groundY - 4, 180, 40);
  }

  const decor = scene.add.graphics().setDepth(FOUND_DEPTH.GROUND_DEC);
  for (let x = 64; x < worldW - 64; x += 52 + Math.floor(rng() * 48)) {
    if (foundPointNearPlatform(x, groundY, platforms, 56, 90)) {
      continue;
    }
    if (rng() > 0.52) {
      const th = 44 + Math.floor(rng() * 28);
      const key = foundPickTextureKey(scene, FOUND_BG_TREE_KEYS, rng);
      if (key) {
        foundAddBackdropSprite(scene, key, x + 6, groundY + 2, {
          depth: FOUND_DEPTH.GROUND_DEC,
          scrollX: 0.88,
          scrollY: 0,
          fitHeight: th + 28,
        });
      } else {
        decor.fillStyle(0x4a3820, 1);
        decor.fillRect(x, groundY - th, 10, th);
        decor.fillStyle(0x3d7a2c, 1);
        decor.fillEllipse(x + 5, groundY - th - 10, 36 + rng() * 14, 38 + rng() * 12);
      }
    } else if (rng() > 0.4) {
      const key = foundPickTextureKey(scene, FOUND_BG_BUSH_KEYS, rng);
      if (key) {
        foundAddBackdropSprite(scene, key, x, groundY + 2, {
          depth: FOUND_DEPTH.GROUND_DEC,
          scrollX: 0.93,
          scrollY: 0,
          fitHeight: 26 + rng() * 10,
        });
      } else {
        decor.fillStyle(0x4a8a32, 1);
        decor.fillEllipse(x, groundY - 8, 28, 18);
      }
    }
  }

  return { sidewalkY, groundY };
}

/**
 * Full world backdrop for GameScene.
 *
 * @param {Phaser.Scene} scene
 * @param {number} worldW
 * @param {number} groundY
 * @param {number} seed
 * @param {Array<{x:number,y:number,width:number}>} [platforms]
 */
function foundBuildWorldClouds(scene, worldW, groundY, rng) {
  for (let layer = 0; layer < 2; layer++) {
    const scroll = layer === 0 ? 0.08 : 0.16;
    const depth = layer === 0 ? FOUND_DEPTH.CLOUD_FAR : FOUND_DEPTH.CLOUD_MID;
    const count = Math.floor(worldW / 320) + 2;
    for (let i = 0; i < count; i++) {
      const cx = 80 + i * (280 + rng() * 120) + rng() * 60;
      const cy = groundY - 220 - layer * 40 - rng() * 80;
      const ew = 120 + rng() * 100;
      const key = foundPickTextureKey(scene, FOUND_BG_CLOUD_KEYS, rng);
      if (key) {
        foundAddBackdropSprite(scene, key, cx, cy, {
          originX: 0.5,
          originY: 0.5,
          depth,
          scrollX: scroll,
          scrollY: 0,
          alpha: layer === 0 ? 0.28 : 0.42,
          displayWidth: ew,
          displayHeight: 40 + rng() * 24,
        });
      } else {
        scene.add.ellipse(cx, cy, ew, 40 + rng() * 24, 0xffffff, layer === 0 ? 0.28 : 0.42)
          .setScrollFactor(scroll, 0).setDepth(depth);
      }
    }
  }
}

function foundBuildWorldTerrain(scene, worldW, groundY, seed, platforms) {
  const rng = typeof createSeededRng === 'function' ? createSeededRng(seed ^ 0x7e4e) : Math.random;
  const plats = platforms || [];

  foundBuildParallaxMountains(scene, worldW, groundY, rng);
  foundBuildParallaxHills(scene, worldW, groundY, rng);
  foundBuildWorldClouds(scene, worldW, groundY, rng);
  foundPlaceBackgroundHouses(scene, worldW, groundY - 20, rng, plats);
  foundBuildMidGroundTrees(scene, worldW, groundY, rng);
  const result = foundBuildGroundStrip(scene, worldW, groundY, rng, plats);
  foundBuildNearFoliage(scene, worldW, groundY, rng, plats);
  return result;
}

/**
 * Platform stilts - drawn behind platform bodies.
 *
 * @param {Phaser.Scene} scene
 * @param {Array} platforms
 * @param {number} groundY
 */
function foundBuildPlatformSupports(scene, platforms, groundY) {
  const g = scene.add.graphics().setDepth(FOUND_DEPTH.SUPPORTS);
  const PH = CFG.PLATFORM_HEIGHT;

  platforms.forEach((plat) => {
    if (plat.type === 'shelter' || plat.y >= groundY - 24) {
      return;
    }

    const topY = plat.y + PH;
    const bottomY = Math.min(groundY - 24, topY + 160);
    const cx = plat.x + plat.width / 2;

    g.fillStyle(0x4a3428, 1);
    g.fillRect(plat.x - 6, topY, plat.width + 12, bottomY - topY);

    g.fillStyle(0x6b5040, 0.4);
    for (let py = topY + 10; py < bottomY; py += 18) {
      g.fillRect(plat.x, py, plat.width, 5);
    }

    [plat.x + 16, plat.x + plat.width - 16].forEach((px) => {
      g.fillStyle(0x6b4a2a, 1);
      g.fillRect(px - 4, topY, 8, bottomY - topY);
      g.fillStyle(0x8a6a4a, 1);
      g.fillRect(px - 5, topY - 5, 10, 6);
    });

    g.fillStyle(0x4a8a32, 1);
    g.fillEllipse(cx, bottomY - 6, plat.width * 0.5, 18);
  });
}

/**
 * Menu backdrop (fixed width).
 *
 * @param {Phaser.Scene} scene
 */
function foundBuildMenuTerrain(scene) {
  const W = CFG.WIDTH;
  const H = CFG.HEIGHT;
  const groundY = H - 128;
  const sidewalkY = groundY - 20;
  const rng = typeof createSeededRng === 'function' ? createSeededRng(42) : Math.random;

  foundBuildSky(scene);

  const earth = scene.add.graphics().setDepth(-8);
  earth.fillStyle(0x2d4a26, 1);
  earth.fillRect(0, sidewalkY, W, H - sidewalkY + 60);
  earth.fillStyle(0x4d7a38, 1);
  earth.fillRect(0, groundY, W, 36);
  earth.fillStyle(0x62a048, 1);
  earth.fillRect(0, groundY, W, 14);
  earth.fillStyle(0x9a8b7a, 1);
  earth.fillRect(0, sidewalkY, W, 18);

  foundBuildParallaxMountains(scene, W + 200, groundY, rng);
  foundBuildParallaxHills(scene, W + 200, groundY, rng);

  let hx = 100;
  while (hx < W - 90) {
    const hw = 90 + Math.floor(rng() * 40);
    const hh = 70 + Math.floor(rng() * 30);
    const key = foundPickTextureKey(scene, FOUND_BG_HOUSE_KEYS, rng);
    if (key) {
      foundAddBackdropSprite(scene, key, hx, sidewalkY + 3, {
        depth: FOUND_DEPTH.HOUSES,
        scrollX: 0.5,
        scrollY: 0,
        fitHeight: hh + 48,
      });
    } else {
      const col = 0xc49a6c + Math.floor(rng() * 0x80808);
      foundDrawHouse(scene, hx, sidewalkY, hw, hh, col, FOUND_DEPTH.HOUSES, 0.5);
    }
    hx += hw + 70 + Math.floor(rng() * 50);
  }

  const decor = scene.add.graphics().setDepth(FOUND_DEPTH.GROUND_DEC);
  for (let x = 50; x < W - 50; x += 70 + Math.floor(rng() * 40)) {
    if (rng() > 0.5) {
      const th = 40 + Math.floor(rng() * 24);
      const key = foundPickTextureKey(scene, FOUND_BG_TREE_KEYS, rng);
      if (key) {
        foundAddBackdropSprite(scene, key, x + 4, groundY + 2, {
          depth: FOUND_DEPTH.GROUND_DEC,
          fitHeight: th + 24,
        });
      } else {
        decor.fillStyle(0x4a3820, 1);
        decor.fillRect(x, groundY - th, 8, th);
        decor.fillStyle(0x3d7a2c, 1);
        decor.fillEllipse(x + 4, groundY - th - 8, 32, 34);
      }
    }
  }

  return { groundY, sidewalkY };
}
