/* ─── Optional treat coins (score only, never block win) ─────────────────── */

/**
 * @param {Phaser.Scene} scene
 * @param {Array<{x:number,y:number,width:number,type?:string}>} platforms
 * @param {number} seed
 * @returns {{ group: Phaser.Physics.Arcade.StaticGroup, total: number, collected: number }}
 */
function foundSpawnTreats(scene, platforms, seed) {
  const group = scene.physics.add.staticGroup();
  const rng = typeof createSeededRng === 'function'
    ? createSeededRng(hashSeed(seed, 0x7ea7))
    : Math.random;

  let total = 0;
  platforms.forEach((plat) => {
    if (plat.type === 'start' || plat.type === 'shelter') {
      return;
    }
    if (rng() > 0.62) {
      return;
    }
    const x = plat.x + 20 + rng() * Math.max(20, plat.width - 40);
    const y = plat.y - 16;
    const coinKey = scene.textures && scene.textures.exists('found-item-treat-coin')
      ? 'found-item-treat-coin'
      : 'pixel';
    const coin = group.create(x, y, coinKey);
    if (coinKey === 'found-item-treat-coin') {
      // 20px — large enough to see clearly, small enough not to clutter platforms.
      coin.setDisplaySize(20, 20);
      // DO NOT call setScale after setDisplaySize — it would undo the size and
      // make the visual much larger than the physics body, causing coins to look
      // like they fall through platforms.
      if (coin.preFX && coin.preFX.addGlow) {
        coin.preFX.addGlow(0xffd970, 1.2, 0, false, 0.03, 10);
      }

      // Spin: only modify scaleX/scaleY — these do not move the body position.
      const flipDelay = Math.floor(rng() * 280);
      // Store base scale so tweens work relative to setDisplaySize result.
      const baseScaleX = coin.scaleX;
      const baseScaleY = coin.scaleY;
      scene.tweens.add({
        targets: coin,
        scaleX: { from: baseScaleX, to: baseScaleX * 0.18 },
        scaleY: { from: baseScaleY, to: baseScaleY * 1.06 },
        alpha: { from: 1, to: 0.88 },
        duration: 230,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
        delay: flipDelay,
        repeatDelay: 40,
      });

      // Bob: shift displayOriginY instead of y so the physics body never moves.
      const baseOriginY = coin.displayOriginY ?? (coin.height / 2);
      const bobDelay = Math.floor(rng() * 180);
      scene.tweens.add({
        targets: coin,
        displayOriginY: { from: baseOriginY, to: baseOriginY + 2 },
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
        delay: bobDelay,
      });

      // Ambient sparkle pulse around each coin (auto-stops once pickup disables it).
      const sparkleTick = scene.time.addEvent({
        delay: 240 + Math.floor(rng() * 160),
        loop: true,
        callback: () => {
          if (!coin.active) {
            sparkleTick.remove(false);
            return;
          }
          if (typeof foundEmitCoinTrailSparkle === 'function') {
            foundEmitCoinTrailSparkle(scene, coin.x, coin.y);
          }
        },
      });
    } else {
      coin.setDisplaySize(10, 10);
      coin.setTint(0xffc857);
    }
    coin.refreshBody();
    coin.setData('treat', true);
    total += 1;
  });

  return { group, total, collected: 0 };
}

/**
 * @param {Phaser.Scene} scene
 * @param {number} x
 * @param {number} y
 */
function foundEmitTreatSparkle(scene, x, y) {
  if (!scene.add.particles) {
    return;
  }
  const emitter = scene.add.particles(x, y, 'pixel', {
    speed: { min: 30, max: 90 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.4, end: 0 },
    lifespan: 220,
    quantity: 6,
    tint: [0xffc857, 0xffe4a8, 0xffffff],
  });
  emitter.setDepth(12);
  scene.time.delayedCall(260, () => emitter.destroy());
}

/**
 * Tiny ambient sparkle around a live coin.
 * @param {Phaser.Scene} scene
 * @param {number} x
 * @param {number} y
 */
function foundEmitCoinTrailSparkle(scene, x, y) {
  if (!scene.add.particles) {
    return;
  }
  const emitter = scene.add.particles(x, y, 'pixel', {
    speed: { min: 8, max: 26 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.25, end: 0 },
    lifespan: 180,
    quantity: 2,
    tint: [0xffd970, 0xfff2bd, 0xffffff],
  });
  emitter.setDepth(12);
  scene.time.delayedCall(200, () => emitter.destroy());
}

/**
 * Coin pickup burst with ring pop + sparkle.
 * @param {Phaser.Scene} scene
 * @param {number} x
 * @param {number} y
 */
function foundEmitTreatPickupBurst(scene, x, y) {
  foundEmitTreatSparkle(scene, x, y);

  const ring = scene.add.circle(x, y, 2, 0xffe8a6, 0.18)
    .setStrokeStyle(2, 0xffd970, 0.95)
    .setDepth(13);
  scene.tweens.add({
    targets: ring,
    scale: { from: 0.6, to: 3.2 },
    alpha: { from: 0.9, to: 0 },
    duration: 230,
    ease: 'Cubic.Out',
    onComplete: () => ring.destroy(),
  });
}
