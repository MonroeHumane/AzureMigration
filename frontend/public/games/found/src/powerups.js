/* ─── Power-up planning + seeded spawn helpers ───────────────────────────── */

const FOUND_POWERUP_DEFS = {
  shield: {
    key: 'found-item-shield',
    label: 'Shield',
    tint: 0xffffff,
    durationMs: 0,
  },
  speed: {
    key: 'found-item-speed',
    label: 'Zoomies',
    tint: 0xffffff,
    durationMs: 8000,
    speedMultiplier: 1.2,
  },
  jump: {
    key: 'found-item-jump',
    label: 'Spring Paws',
    tint: 0xffffff,
    durationMs: 8000,
    jumpMultiplier: 1.16,
  },
};

function foundGetPowerUpPlan(levelNum) {
  return (CFG.POWERUP_RULES && CFG.POWERUP_RULES[levelNum]) || { budget: 0, types: [] };
}

function foundApplyPowerUp(player, type) {
  if (!player || !type) {
    return false;
  }
  if (type === 'shield' && typeof player.addShield === 'function') {
    player.addShield(1);
    return true;
  }
  const def = FOUND_POWERUP_DEFS[type];
  if (!def || typeof player.applyBuff !== 'function') {
    return false;
  }
  player.applyBuff(type, def.durationMs, {
    speedMultiplier: def.speedMultiplier,
    jumpMultiplier: def.jumpMultiplier,
  });
  return true;
}

function foundSpawnPowerUps(scene, platforms, seed, levelNum) {
  const group = scene.physics.add.staticGroup();
  const plan = foundGetPowerUpPlan(levelNum);
  if (!plan || !plan.budget || !Array.isArray(plan.types) || plan.types.length === 0) {
    return { group, total: 0 };
  }

  const rng = typeof createSeededRng === 'function'
    ? createSeededRng(hashSeed(seed, 0x51f2))
    : Math.random;
  const candidates = (platforms || []).filter((plat) => plat.type === 'normal' && plat.width >= 160);
  let total = 0;

  for (let i = 0; i < plan.budget && candidates.length > 0; i++) {
    const platIndex = Math.floor(rng() * candidates.length);
    const plat = candidates.splice(platIndex, 1)[0];
    const type = plan.types[Math.floor(rng() * plan.types.length)];
    const def = FOUND_POWERUP_DEFS[type];
    if (!plat || !def || !scene.textures.exists(def.key)) {
      continue;
    }

    const x = plat.x + 24 + rng() * Math.max(24, plat.width - 48);
    const y = plat.y - 20;
    const pickup = group.create(x, y, def.key);
    pickup.setDisplaySize(22, 22);
    pickup.setData('powerUpType', type);
    pickup.setData('powerUpLabel', def.label);
    pickup.refreshBody();
    total += 1;
  }

  return { group, total };
}

/* ─── Hidden power-up blocks (levels 5+) ────────────────────────────────── */

/**
 * Spawn floating ! blocks above platforms for levels >= 5.
 * When hit from below by the player the block pops and ejects a collectible
 * powerup into the existing powerUpsGroup so the normal overlap handler picks
 * it up automatically.
 *
 * @param {Phaser.Scene} scene
 * @param {Array}  platforms  - level platform data
 * @param {number} seed
 * @param {number} levelNum
 * @param {Phaser.Physics.Arcade.StaticGroup} powerUpsGroup - the live group to inject pickups into
 * @returns {{ group: Phaser.Physics.Arcade.StaticGroup }}
 */
function foundSpawnPowerUpBlocks(scene, platforms, seed, levelNum, powerUpsGroup) {
  const group = scene.physics.add.staticGroup();
  if (levelNum < 5) {
    return { group };
  }
  if (!scene.textures.exists('found-item-block-question')) {
    return { group };
  }

  const plan = foundGetPowerUpPlan(levelNum);
  if (!plan || !plan.budget || !Array.isArray(plan.types) || plan.types.length === 0) {
    return { group };
  }

  const rng = typeof createSeededRng === 'function'
    ? createSeededRng(hashSeed(seed, 0xb10c))
    : Math.random;

  // Only place blocks on wide platforms that have room to jump under.
  const candidates = (platforms || []).filter((p) => p.type === 'normal' && p.width >= 140);
  const blockCount = Math.min(plan.budget, candidates.length);

  for (let i = 0; i < blockCount; i++) {
    const idx = Math.floor(rng() * candidates.length);
    const plat = candidates.splice(idx, 1)[0];
    const type = plan.types[Math.floor(rng() * plan.types.length)];
    const def = FOUND_POWERUP_DEFS[type];
    if (!plat || !def) {
      continue;
    }

    // Float the block 3 tile-heights above the platform surface.
    const blockSize = 28;
    const x = Math.round(plat.x + plat.width * 0.5);
    const y = plat.y - blockSize * 3;

    const block = group.create(x, y, 'found-item-block-question');
    block.setDisplaySize(blockSize, blockSize);
    block.refreshBody();
    block.setDepth(10);
    block.setData('powerUpType', type);
    block.setData('powerUpDef', def);
    block.setData('powerUpsGroup', powerUpsGroup);

    // Idle wobble so the block is clearly interactive.
    scene.tweens.add({
      targets: block,
      scaleX: block.scaleX * 1.04,
      scaleY: block.scaleY * 0.96,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
      delay: Math.floor(rng() * 300),
    });
  }

  return { group };
}

/**
 * Call this when the player bonks a block from below.
 * Swaps the texture, bounces the block, and injects the powerup into the live group.
 *
 * @param {Phaser.Scene} scene
 * @param {Phaser.GameObjects.Image} block
 */
function foundActivatePowerUpBlock(scene, block) {
  if (!block.active || block.getData('activated')) {
    return;
  }
  block.setData('activated', true);

  // Swap texture: flash active → settle on empty.
  if (scene.textures.exists('found-item-block-question-active')) {
    block.setTexture('found-item-block-question-active');
  }
  scene.time.delayedCall(120, () => {
    if (block && block.active && scene.textures.exists('found-item-block-empty')) {
      block.setTexture('found-item-block-empty');
    }
  });

  // Bounce pop upward.
  const origY = block.y;
  scene.tweens.killTweensOf(block);
  scene.tweens.add({
    targets: block,
    y: origY - 10,
    duration: 80,
    yoyo: true,
    ease: 'Quad.Out',
    onComplete: () => {
      block.y = origY;
      block.refreshBody();
    },
  });

  // Spawn the powerup pickup above the block so the standard collector grabs it.
  const def = block.getData('powerUpDef');
  const type = block.getData('powerUpType');
  const pg = block.getData('powerUpsGroup');
  if (!def || !type || !pg || !scene.textures.exists(def.key)) {
    return;
  }

  const pickup = pg.create(block.x, block.y - 36, def.key);
  pickup.setDisplaySize(22, 22);
  pickup.setData('powerUpType', type);
  pickup.setData('powerUpLabel', def.label);
  pickup.setAlpha(0);
  pickup.refreshBody();

  // Float the pickup upward into view.
  scene.tweens.add({
    targets: pickup,
    y: block.y - 52,
    alpha: 1,
    duration: 340,
    ease: 'Back.Out',
    onComplete: () => pickup.refreshBody(),
  });
}
