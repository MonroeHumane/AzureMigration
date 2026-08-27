/* ─── Constraint-based level generator ───────────────────────────────────── */

function generateLevel(levelNum, seedOrRng) {
  const factor = CFG.DIFFICULTY[levelNum] ?? 0.90;
  const rng = resolveLevelRng(seedOrRng);

  for (let attempt = 0; attempt < 24; attempt++) {
    const platforms = buildLevelAttempt(levelNum, factor, rng);
    const check = typeof foundVerifyLevelAnalytic === 'function'
      ? foundVerifyLevelAnalytic(platforms, factor)
      : { ok: true };

    if (check.ok) {
      if (typeof foundSimulateLevel === 'function') {
        const sim = foundSimulateLevel(platforms);
        if (sim.ok) {
          return platforms;
        }
      } else {
        return platforms;
      }
    }
  }

  return buildFallbackLevel(levelNum);
}

function resolveLevelRng(seedOrRng) {
  if (typeof seedOrRng === 'function') {
    return seedOrRng;
  }
  if (typeof seedOrRng === 'number' && typeof createSeededRng === 'function') {
    return createSeededRng(seedOrRng);
  }
  return Math.random;
}

function buildLevelAttempt(levelNum, factor, rng) {
  const maxGap = CFG.D_MAX * factor;
  const maxRise = CFG.H_MAX * factor;
  const count = CFG.INTERIOR_PLATFORMS[levelNum] ?? 10;
  const startW = CFG.START_PLAT_W || 480;
  const shelterW = CFG.SHELTER_PLAT_W || 416;
  const minGap = CFG.MIN_GAP || 64;

  const platforms = [];
  let curX = 0;
  let curY = CFG.GROUND_Y;
  let prevRise = 0; // rhythm: tend to continue direction for step-like sequences

  platforms.push({ x: curX, y: curY, width: startW, type: 'start' });
  curX += startW;

  for (let i = 0; i < count; i++) {
    let gap = randBetween(rng, minGap, maxGap);
    // Momentum-based rise: 35% chance to continue previous direction (creates step sequences)
    let rise;
    if (prevRise !== 0 && rng() < 0.35) {
      const dir = prevRise > 0 ? 1 : -1;
      rise = dir * randBetween(rng, maxRise * 0.25, maxRise * 0.6);
    } else {
      rise = randBetween(rng, -maxRise, maxRise);
    }
    prevRise = rise;
    let newY = clamp(curY + rise, CFG.MIN_PLATFORM_Y, CFG.GROUND_Y);

    const heightDiff = curY - newY;
    if (heightDiff > 0) {
      const tAir = airTimeToHeight(heightDiff);
      const reach = CFG.WALK_SPEED * tAir;
      gap = Math.min(gap, reach * 0.88);
    }

    curX += gap;
    curY = newY;
    const width = randBetween(rng, CFG.PLATFORM_MIN_W, CFG.PLATFORM_MAX_W);
    platforms.push({ x: curX, y: curY, width, type: 'normal' });
    curX += width;
  }

  const shelterGap = randBetween(rng, minGap, maxGap * 0.65);
  curX += shelterGap;
  platforms.push({ x: curX, y: CFG.GROUND_Y, width: shelterW, type: 'shelter' });

  return platforms;
}

function buildFallbackLevel(levelNum) {
  const count = CFG.INTERIOR_PLATFORMS[levelNum] ?? 6;
  const startW = CFG.START_PLAT_W || 480;
  const shelterW = CFG.SHELTER_PLAT_W || 416;
  const platforms = [{ x: 0, y: CFG.GROUND_Y, width: startW, type: 'start' }];
  let curX = startW;
  for (let i = 0; i < count; i++) {
    curX += 128;
    platforms.push({ x: curX, y: CFG.GROUND_Y, width: 224, type: 'normal' });
    curX += 224;
  }
  curX += 128;
  platforms.push({ x: curX, y: CFG.GROUND_Y, width: shelterW, type: 'shelter' });
  return platforms;
}

function airTimeToHeight(rise) {
  if (rise >= CFG.H_MAX) {
    return 0;
  }
  const tUp = CFG.JUMP_VELOCITY / CFG.GRAVITY;
  const hFall = CFG.H_MAX - rise;
  const tDown = Math.sqrt((2 * hFall) / CFG.GRAVITY);
  return tUp + tDown;
}

function randBetween(rng, min, max) {
  return min + rng() * (max - min);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
