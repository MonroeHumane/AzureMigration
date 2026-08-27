/* ─── Playability validation - same physics limits as the live player ───────
   Used by tools/playability-test.mjs and optional in-game debug checks.     */

const FOUND_PLAYER = {
  /** Sprite origin is bottom-center; py is feet on platform surface */
  get FOOT_OFFSET() { return CFG.CAT_FOOT_OFFSET || 0; },
  get HALF_WIDTH()  { return CFG.CAT_HALF_WIDTH_WORLD || ((CFG.CAT_BODY_W || 44) * (CFG.CAT_SCALE || 1)) * 0.5; },
  START_OFFSET_X: 128,
  SHELTER_ZONE_X: 112,
};

/**
 * Analytic max horizontal gap between platform surfaces (matches levelgen).
 *
 * @param {number} fromY
 * @param {number} toY
 * @param {number} factor
 * @returns {number}
 */
function foundMaxReachableGap(fromY, toY, factor) {
  const rise = fromY - toY;
  const hMax = CFG.H_MAX * factor;
  const dMax = CFG.D_MAX * factor;

  if (rise > hMax) {
    return 0;
  }
  if (rise <= 0) {
    return dMax;
  }
  const tAir = airTimeToHeight(rise);
  return CFG.WALK_SPEED * tAir * 0.88;
}

/**
 * Pairwise analytic verification (fast gate before physics sim).
 *
 * @param {Array<{x:number,y:number,width:number}>} platforms
 * @param {number} factor
 * @returns {{ok:boolean, pair?:number, gap?:number, maxGap?:number, reason?:string}}
 */
function foundVerifyLevelAnalytic(platforms, factor) {
  for (let i = 0; i < platforms.length - 1; i++) {
    const a = platforms[i];
    const b = platforms[i + 1];
    const gap = b.x - (a.x + a.width);
    const maxGap = foundMaxReachableGap(a.y, b.y, factor);
    if (gap > maxGap + 0.5) {
      return {
        ok: false,
        pair: i,
        gap: Math.round(gap * 10) / 10,
        maxGap: Math.round(maxGap * 10) / 10,
        reason: `Platform ${i} → ${i + 1} gap ${gap.toFixed(1)}px exceeds max ${maxGap.toFixed(1)}px`,
      };
    }
  }
  return { ok: true };
}

/**
 * Simulate a human-like run: hold walk-right, jump at platform edges when needed.
 * Uses the same CFG walk speed, jump velocity, and gravity as Phaser arcade.
 *
 * @param {Array<{x:number,y:number,width:number,type?:string}>} platforms
 * @returns {{ok:boolean, frames:number, reason?:string}}
 */
function foundSimulateLevel(platforms) {
  if (!platforms || platforms.length < 2) {
    return { ok: false, frames: 0, reason: 'Level has fewer than 2 platforms' };
  }

  const DT = 1 / 60;
  const MAX_FRAMES = 90000;
  const start = platforms[0];
  const shelter = platforms[platforms.length - 1];

  let px = start.x + FOUND_PLAYER.START_OFFSET_X;
  let py = start.y - FOUND_PLAYER.FOOT_OFFSET;
  let vx = 0;
  let vy = 0;
  let platIdx = 0;
  let jumpQueued = false;
  let coyoteFrames = 0;
  let jumpBufferFrames = 0;
  const COYOTE_FRAMES = Math.ceil((CFG.COYOTE_MS || 90) / (1000 / 60));
  const BUFFER_FRAMES = Math.ceil((CFG.JUMP_BUFFER_MS || 110) / (1000 / 60));

  const footBottom = () => py + FOUND_PLAYER.FOOT_OFFSET;
  const shelterX = shelter.x + shelter.width - FOUND_PLAYER.SHELTER_ZONE_X;

  function platformUnder(feet) {
    for (let i = platforms.length - 1; i >= 0; i--) {
      const p = platforms[i];
      if (
        feet >= p.y - 1
        && feet <= p.y + CFG.PLATFORM_HEIGHT + 2
        && px + FOUND_PLAYER.HALF_WIDTH > p.x
        && px - FOUND_PLAYER.HALF_WIDTH < p.x + p.width
      ) {
        return i;
      }
    }
    return -1;
  }

  for (let frame = 0; frame < MAX_FRAMES; frame++) {
    const current = platforms[platIdx];
    const next = platforms[platIdx + 1] || null;
    const onIdx = platformUnder(footBottom());
    const onGround = onIdx >= 0 && vy >= 0;

    if (onGround) {
      platIdx = Math.max(platIdx, onIdx);
      vy = 0;
      py = platforms[platIdx].y - FOUND_PLAYER.FOOT_OFFSET;
      coyoteFrames = COYOTE_FRAMES;

      vx = CFG.WALK_SPEED;

      if (next) {
        const edgeX = current.x + current.width - 29;
        const needJump = next.y < current.y - 1 || next.x > px + 8;
        if (px >= edgeX && needJump) {
          jumpQueued = true;
          jumpBufferFrames = BUFFER_FRAMES;
        }
      }
    } else if (coyoteFrames > 0) {
      coyoteFrames -= 1;
    }

    if (jumpQueued && !onGround) {
      jumpBufferFrames = BUFFER_FRAMES;
    }

    const canJump = onGround || coyoteFrames > 0;
    if (jumpBufferFrames > 0 && canJump) {
      vy = -CFG.JUMP_VELOCITY;
      jumpQueued = false;
      jumpBufferFrames = 0;
      coyoteFrames = 0;
    } else if (jumpBufferFrames > 0) {
      jumpBufferFrames -= 1;
    }

    if (!onGround) {
      vx = CFG.WALK_SPEED;
    }

    vy += CFG.GRAVITY * DT;
    px += vx * DT;
    py += vy * DT;

    if (footBottom() > CFG.HEIGHT + 128) {
      return { ok: false, frames: frame, reason: 'Simulated fall off world' };
    }

    if (
      shelter.type === 'shelter'
      && px >= shelterX
      && footBottom() <= shelter.y + 4
      && footBottom() >= shelter.y - 6
    ) {
      return { ok: true, frames: frame };
    }
  }

  return { ok: false, frames: MAX_FRAMES, reason: 'Simulation timed out before shelter' };
}

/**
 * Full check for one generated level.
 *
 * @param {number} levelNum
 * @param {number} seed
 * @returns {{ok:boolean, seed:number, levelNum:number, analytic:object, sim:object, platforms?:Array}}
 */
function foundTestLevel(levelNum, seed) {
  const factor = CFG.DIFFICULTY[levelNum] ?? 0.90;
  const platforms = generateLevel(levelNum, seed);
  const analytic = foundVerifyLevelAnalytic(platforms, factor);
  if (!analytic.ok) {
    return { ok: false, seed, levelNum, analytic, sim: null, platforms };
  }
  const sim = foundSimulateLevel(platforms);
  return {
    ok: sim.ok,
    seed,
    levelNum,
    analytic,
    sim,
    platforms,
  };
}
