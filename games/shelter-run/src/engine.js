// Pure game model — no DOM, no canvas. Update with dt (seconds).
import { PHYS, PROJ, BIOMES, BIOME_CYCLE_RESET, OBSTACLE, PICKUP, OBJECTIVES } from './config.js';
import { spawnCluster, nextGap } from './levelgen.js';

const rand = (a, b) => a + Math.random() * (b - a);

export function biomeForMeters(m) {
  const cycled = m % BIOME_CYCLE_RESET;
  let b = BIOMES[0];
  for (const cand of BIOMES) if (cycled >= cand.min) b = cand;
  return b;
}

export function createGame() {
  return {
    state: 'READY',            // READY | PLAYING | DYING | GAME_OVER | PAUSED
    meters: 0,
    score: 0,
    best: 0,
    cameraZ: 0,
    speed: PHYS.speedBase,
    nextSpawnZ: PROJ.spawnZ * 0.35,
    lastWasHard: false,
    obstacles: [],
    collectibles: [],
    // Player
    lane: 1, targetLane: 1, laneT: 1,
    action: 'running',         // running | jumping | sliding
    actionT: 0,
    worldY: 0,
    lives: PHYS.lives,
    invincibleT: 0,
    squashY: 1, stretchX: 1, landFlash: 0,
    catFrame: 0, catFrameT: 0,
    lean: 0,                   // lane-change lean (render)
    hitT: 0,                   // hit-tumble timer (render)
    // Chase — Temple Run two-strike model: first stumble releases the kennel
    // pack; clean play for chaseRecoverSec sends them home; stumbling while
    // they're on screen = caught.
    chase: { active: false, t: 0, intensity: 0 },
    caught: false,
    // Power-up effects — seconds remaining (boost uses boostEndM for distance)
    effects: { magnet: 0, ghost: 0, boost: 0 },
    boostEndM: 0,
    // Owned upgrade levels, synced from server progress
    upgrades: { magnet: 0, golden: 0, ghost: 0, boost: 0, donation: 0 },
    multiplier: 1,
    // FX
    puffs: [], sparkles: [], confetti: [],
    shake: 0, flash: 0, hurtFlash: 0,
    banner: null,              // { text, sub, t, dur } — milestone/biome banner
    biomeId: 'grass',
    time: 0, deadT: 0,
    // Run stats (objective tracking)
    rescued: [],               // [{id,name,photo}] pets picked up this run
    rescuedCount: 0,
    rescueStreak: 0,           // consecutive rescues without a stumble
    streakBest: 0,
    treatsRun: 0,              // treats collected this run
    pickupsRun: 0,             // power-up pickups collected this run
    nearMissRun: 0,
    cleanMeters: 0,            // meters since last stumble
    runsPlayed: 0,             // from progress stats (seeded by main.js)
    rescuesAll: 0,             // all-time rescues (seeded by main.js)
    escapes: 0,                // times the pack was escaped this session
    claimedObjectives: [],     // objective keys already claimed (server or local)
    claimPending: new Set(),   // keys with an in-flight claim — not yet confirmed
    onDeath: null, onHit: null, onCollect: null, onJump: null, onSlide: null, onLane: null, onLand: null,
    onMilestone: null, onNearMiss: null,
    onPickup: null,            // (pickup collectible)
    onTreat: null,             // (treat collectible)
    onChaseStart: null, onChaseEnd: null, onCaught: null,
    onObjective: null,         // (objectiveKey) — claimable now
  };
}

// Sync owned upgrade levels + multiplier + claimed objectives from server progress.
export function applyProgress(g, progress) {
  if (!progress) return;
  const up = progress.upgrades || {};
  for (const k of Object.keys(g.upgrades)) {
    const lvl = up[k] && up[k].level;
    g.upgrades[k] = Math.max(0, Math.min(5, lvl | 0));
  }
  g.multiplier = Math.max(1, progress.multiplier | 0);
  g.claimedObjectives = Array.isArray(progress.objectives) ? progress.objectives.slice() : [];
  const st = progress.stats || {};
  g.runsPlayed = st.runs | 0;
  g.rescuesAll = st.rescues | 0;
}

export function treatTierFor(g, meters) {
  const lvl = g.upgrades.golden | 0;
  const [silverAt, goldAt] = PHYS.goldenThresholds[Math.min(5, lvl)];
  if (meters >= goldAt) return { tier: 'gold', value: 5 };
  if (meters >= silverAt) return { tier: 'silver', value: 3 };
  return { tier: 'bronze', value: 1 };
}

// Objectives whose run/all-time stats are now satisfied and unclaimed.
export function claimableObjectives(g) {
  const out = [];
  for (const o of OBJECTIVES) {
    if (g.claimedObjectives.includes(o.key) || g.claimPending.has(o.key)) continue;
    let met = false;
    switch (o.key) {
      case 'rescue_5':      met = g.rescuedCount >= 5; break;
      case 'rescue_15':     met = (g.rescuesAll + g.rescuedCount) >= 15; break;
      case 'clean_1000':    met = g.cleanMeters >= 1000; break;
      case 'streak_8':      met = g.streakBest >= 8; break;
      case 'distance_750':  met = g.meters >= 750; break;
      case 'distance_2500': met = g.meters >= 2500; break;
      case 'nearmiss_3':    met = g.nearMissRun >= 3; break;
      case 'pickups_2':     met = g.pickupsRun >= 2; break;
      case 'runs_5':        met = (g.runsPlayed + 1) >= 5; break; // current run counts
      case 'chase_escape':  met = g.escapes >= 1; break;
    }
    if (met) out.push(o.key);
  }
  return out;
}

export function resetRun(g) {
  g.meters = 0;
  g.score = 0;
  g.cameraZ = 0;
  g.speed = PHYS.speedBase;
  g.nextSpawnZ = PROJ.spawnZ * 0.35;
  g.lastWasHard = false;
  g.obstacles = [];
  g.collectibles = [];
  g.lane = 1; g.targetLane = 1; g.laneT = 1;
  g.action = 'running'; g.actionT = 0; g.worldY = 0;
  g.lives = PHYS.lives; g.invincibleT = 0;
  g.squashY = 1; g.stretchX = 1; g.landFlash = 0; g.lean = 0;
  g.hitT = 0;
  g.chase = { active: false, t: 0, intensity: 0 };
  g.caught = false;
  g.effects = { magnet: 0, ghost: 0, boost: 0 };
  g.boostEndM = 0;
  g.puffs = []; g.sparkles = []; g.confetti = [];
  g.shake = 0; g.flash = 0; g.hurtFlash = 0;
  g.banner = null; g.biomeId = 'grass';
  g.deadT = 0;
  g.rescued = []; g.rescuedCount = 0; g.rescueStreak = 0; g.streakBest = 0;
  g.treatsRun = 0; g.pickupsRun = 0; g.nearMissRun = 0;
  g.cleanMeters = 0; g.escapes = 0;
  g.claimPending = new Set();
  g.state = 'READY';
}

export function startRun(g) { if (g.state === 'READY') g.state = 'PLAYING'; }

// Screen-space celebration helpers (logical 432x768 px)
const CONFETTI_COLS = ['#ffd166', '#ff8fa3', '#7ee0a3', '#8ecae6', '#f4a261', '#cdb4f0'];
export function burstConfetti(g, n = 60) {
  for (let i = 0; i < n; i++) {
    g.confetti.push({
      x: rand(30, 400), y: rand(-50, 130), vx: rand(-70, 70), vy: rand(30, 170),
      rot: rand(0, 6.3), vr: rand(-8, 8), life: rand(1.5, 2.6),
      color: CONFETTI_COLS[i % CONFETTI_COLS.length], w: rand(5, 9), h: rand(7, 13),
    });
  }
}
export function setBanner(g, text, sub = '', dur = 2.4) {
  g.banner = { text, sub, t: dur, dur };
}

export function changeLane(g, dir) {
  if (g.state !== 'PLAYING') return false;
  const next = g.targetLane + dir;
  if (next < 0 || next > 2) return false;
  if (g.laneT < 1) g.lane = g.targetLane;
  g.targetLane = next;
  g.laneT = 0;
  g.lean = dir;
  g.squashY = 0.85; g.stretchX = 1.15;
  if (g.onLane) g.onLane(dir);
  return true;
}

export function jump(g) {
  if (g.state === 'READY') { g.state = 'PLAYING'; return; }
  if (g.state !== 'PLAYING' || g.action !== 'running') return;
  g.action = 'jumping'; g.actionT = 0;
  g.squashY = 1.1; g.stretchX = 0.9;
  for (let i = 0; i < 3; i++) {
    g.puffs.push({ lane: effectiveLane(g), x: 0, z: PROJ.playerZ - 10, vx: rand(-30, 30), vy: rand(15, 50), life: rand(0.3, 0.5) });
  }
  if (g.onJump) g.onJump();
}

export function slide(g) {
  if (g.state !== 'PLAYING' || g.action !== 'running') return;
  g.action = 'sliding'; g.actionT = 0;
  g.squashY = 0.68; g.stretchX = 1.28;
  if (g.onSlide) g.onSlide();
}

export function effectiveLane(g) {
  if (g.laneT < 1) return g.laneT < 0.5 ? g.lane : g.targetLane;
  return g.targetLane;
}

function die(g) {
  g.state = 'DYING';
  g.deadT = 0;
  g.lives = 0;
  if (g.onDeath) g.onDeath(Math.floor(g.meters));
}

function hitPlayer(g, obs) {
  obs.passed = true;
  g.hurtFlash = 1;
  g.shake = 0.5;
  g.hitT = 0.55;
  g.rescueStreak = 0;
  g.cleanMeters = 0;
  g.action = 'running'; g.actionT = 0; g.worldY = 0;
  g.effects.boost = 0; g.effects.ghost = 0; // hits cancel ride-effects
  if (g.chase.active) {
    // Strike two — the pack was already on your tail.
    g.caught = true;
    if (g.onCaught) g.onCaught();
    die(g);
    return;
  }
  // Strike one — release the hounds.
  g.chase.active = true;
  g.chase.t = PHYS.chaseRecoverSec;
  g.speed = Math.max(PHYS.speedBase, g.speed * PHYS.stumbleSpeedMul);
  g.lives = 1;
  g.invincibleT = PHYS.invincibleMs / 1000;
  if (g.onHit) g.onHit(1);
  if (g.onChaseStart) g.onChaseStart();
}

export function update(g, dt) {
  g.time += dt;
  const frames = dt * 60;

  if (g.state === 'PLAYING') {
    const boosting = g.effects.boost > 0;
    g.speed = boosting ? PHYS.speedMax : Math.min(PHYS.speedMax, g.speed + PHYS.speedGain * frames);
    const dz = g.speed * frames;
    g.cameraZ += dz;
    g.meters = g.cameraZ * PHYS.distScale;
    g.cleanMeters += dz * PHYS.distScale;
    g.score = Math.floor(g.meters * g.multiplier) + g.treatsRun;

    // Chase recovery — clean play sends the pack home.
    if (g.chase.active) {
      g.chase.t -= dt;
      g.chase.intensity = Math.min(1, g.chase.intensity + dt * 3);
      if (g.chase.t <= 0) {
        g.chase.active = false;
        g.chase.intensity = 0;
        g.lives = PHYS.lives;
        g.escapes += 1;
        if (g.onChaseEnd) g.onChaseEnd();
      }
    }

    // Effect timers
    for (const k of ['magnet', 'ghost']) {
      if (g.effects[k] > 0) g.effects[k] = Math.max(0, g.effects[k] - dt);
    }
    if (g.effects.boost > 0 && g.meters >= g.boostEndM) g.effects.boost = 0;
  }

  // Lane interp
  if (g.laneT < 1) {
    g.laneT = Math.min(1, g.laneT + dt / (PHYS.laneChangeMs / 1000));
    if (g.laneT >= 1) g.lane = g.targetLane;
  }
  g.lean *= Math.max(0, 1 - dt * 9);

  // Action timers
  if (g.action !== 'running') {
    const durMs = g.action === 'jumping' ? PHYS.jumpMs : PHYS.slideMs;
    g.actionT = Math.min(1, g.actionT + dt / (durMs / 1000));
    if (g.action === 'jumping') {
      g.worldY = PHYS.jumpHeight * Math.sin(g.actionT * Math.PI);
      if (g.actionT > 0.35 && g.actionT < 0.65) { g.squashY = Math.max(g.squashY, 1.08); g.stretchX = Math.min(g.stretchX, 0.92); }
    } else {
      g.worldY = 0;
    }
    if (g.actionT >= 1) {
      const wasJump = g.action === 'jumping';
      g.action = 'running'; g.actionT = 0; g.worldY = 0;
      if (wasJump) {
        g.squashY = 0.72; g.stretchX = 1.26; g.landFlash = 1;
        if (g.onLand) g.onLand();
      }
    }
  }

  // Ease squash/stretch back
  const ease = Math.min(1, dt / 0.12);
  g.squashY += (1 - g.squashY) * ease;
  g.stretchX += (1 - g.stretchX) * ease;
  g.landFlash = Math.max(0, g.landFlash - dt / 0.22);

  g.invincibleT = Math.max(0, g.invincibleT - dt);
  g.hitT = Math.max(0, g.hitT - dt);

  // Biome-change banner
  const b = biomeForMeters(g.meters);
  if (b.id !== g.biomeId && g.state === 'PLAYING') {
    g.biomeId = b.id;
    g.banner = { text: b.label, sub: 'New trail ahead', t: 2.4, dur: 2.4 };
  }
  if (g.banner) { g.banner.t -= dt; if (g.banner.t <= 0) g.banner = null; }

  // Confetti — gravity + flutter, screen-space (logical px)
  for (const c of g.confetti) {
    c.life -= dt;
    c.vy += 620 * dt;
    c.x += (c.vx + Math.sin(c.life * 9 + c.rot * 7) * 34) * dt;
    c.y += c.vy * dt;
    c.rot += c.vr * dt;
  }
  g.confetti = g.confetti.filter(c => c.life > 0 && c.y < 820);
  g.flash = Math.max(0, g.flash - dt * 3.2);
  g.hurtFlash = Math.max(0, g.hurtFlash - dt * 2.6);
  g.shake = Math.max(0, g.shake - dt * 1.8);

  // Run-cycle anim
  const fps = g.state === 'PLAYING' ? 8 + (g.speed / PHYS.speedMax) * 9 : 7;
  g.catFrameT += dt;
  if (g.catFrameT > 1 / fps) { g.catFrameT = 0; g.catFrame = (g.catFrame + 1) % 6; }

  // Particles drift backward (world motion)
  const scroll = g.state === 'PLAYING' ? g.speed : 0;
  for (const p of g.puffs) { p.z -= scroll * frames; p.vy += 120 * dt; p.life -= dt; }
  g.puffs = g.puffs.filter(p => p.life > 0);
  for (const s of g.sparkles) { s.z -= scroll * frames; s.life -= dt; s.rot += dt * 6; }
  g.sparkles = g.sparkles.filter(s => s.life > 0);

  if (g.state === 'DYING') {
    g.deadT += dt;
    if (g.deadT > 1.1) g.state = 'GAME_OVER';
    return;
  }
  if (g.state !== 'PLAYING') return;

  // Spawn ahead — levelgen gets the upgrade context for pickup pools + tiers.
  const frontZ = g.cameraZ + PROJ.spawnZ;
  while (g.nextSpawnZ < frontZ) {
    const pack = spawnCluster(Math.random, g.nextSpawnZ, g.meters, g._idc || 0, {
      upgrades: g.upgrades,
      biomeId: g.biomeId,
      treatTier: treatTierFor(g, g.meters),
    });
    g._idc = pack.idCounter;
    g.obstacles.push(...pack.obstacles);
    g.collectibles.push(...pack.collectibles);
    g.nextSpawnZ += nextGap(Math.random, g.meters, g.lastWasHard);
    g.lastWasHard = !!pack.hard;
  }

  const lane = effectiveLane(g);
  const pz = PROJ.playerZ;

  // Boost autopilot — scan the road ahead and act like a perfect player.
  if (g.effects.boost > 0) autopilot(g, lane, pz);

  // Collectibles — pet rescues, treats, power-ups.
  const magnetOn = g.effects.magnet > 0 || g.effects.boost > 0;
  for (const c of g.collectibles) {
    if (c.collected) continue;
    const d = c.worldZ - g.cameraZ;
    const window = magnetOn ? PHYS.collectWindow * 1.5 : PHYS.collectWindow;
    if (Math.abs(d - pz) > window) continue;
    const laneOk = c.lane === lane ||
      (magnetOn && Math.abs(c.lane - lane) <= PHYS.magnetRadius);
    if (!laneOk) continue;
    if (c.lane !== lane) c.pulled = true; // render flies it to the player
    collect(g, c, pz);
  }

  // Obstacles — ghost/boost phase through everything.
  const phasing = g.effects.ghost > 0 || g.effects.boost > 0;
  if (g.invincibleT <= 0 && !phasing) {
    for (const o of g.obstacles) {
      if (o.passed) continue;
      const d = o.worldZ - g.cameraZ;
      if (d > pz + PHYS.hitWindowFront || d < pz - PHYS.hitWindowBack) continue;
      if (o.lane !== lane) {
        // Near-miss: dodged past in an adjacent lane right at the player plane.
        if (!o.nearMissed && d < pz && d > pz - 60 && Math.abs(o.lane - lane) === 1) {
          o.nearMissed = true;
          g.nearMissRun += 1;
          if (g.onNearMiss) g.onNearMiss(o);
        }
        if (d < pz) o.passed = true;
        continue;
      }
      let hit = false;
      if (o.type === OBSTACLE.LANE_BLOCK) hit = g.worldY < PHYS.jumpHeight * 0.72;
      else if (o.type === OBSTACLE.LOW || o.type === OBSTACLE.GAP) hit = g.worldY < PHYS.lowWallHeight * 0.85;
      else if (o.type === OBSTACLE.HIGH) hit = g.action !== 'sliding';
      if (hit) { hitPlayer(g, o); break; }
      if (d < pz) o.passed = true;
    }
  } else {
    for (const o of g.obstacles) {
      const d = o.worldZ - g.cameraZ;
      if (d < pz) o.passed = true;
    }
  }

  // Prune behind camera
  const minZ = g.cameraZ - 260;
  g.obstacles = g.obstacles.filter(o => o.worldZ > minZ);
  g.collectibles = g.collectibles.filter(c => !c.collected && c.worldZ > minZ);

  // Slide dust
  if (g.action === 'sliding' && Math.random() < 0.5) {
    g.puffs.push({ lane, x: rand(-14, 14), z: pz - 12, vx: rand(-30, 30), vy: rand(10, 40), life: rand(0.25, 0.45) });
  }

  // Objective polling — cheap scan each frame; callback fires per claimable key.
  if (g.onObjective && (g.frame || 0) % 30 === 0) {
    for (const key of claimableObjectives(g)) {
      g.claimPending.add(key); // main.js moves to claimedObjectives on confirm
      g.onObjective(key);
    }
  }
  g.frame = (g.frame || 0) + 1;
}

function collect(g, c, pz) {
  c.collected = true;
  const kind = c.kind || 'pet';
  if (kind === 'pet') {
    g.rescuedCount += 1;
    g.rescueStreak += 1;
    g.streakBest = Math.max(g.streakBest, g.rescueStreak);
    if (g.onCollect) g.onCollect(c);
  } else if (kind === PICKUP.TREAT) {
    const mult = g.effects.magnet > 0 && g.upgrades.magnet >= 5 ? 3 : 1;
    g.treatsRun += (c.value || 1) * mult;
    if (g.onTreat) g.onTreat(c);
  } else {
    g.pickupsRun += 1;
    activatePickup(g, kind);
    if (g.onPickup) g.onPickup(c);
  }
  for (let i = 0; i < 5; i++) {
    g.sparkles.push({ lane: c.lane, x: rand(-20, 20), z: pz + rand(-10, 30), vy: rand(-60, -20), life: rand(0.5, 0.9), rot: rand(0, 6) });
  }
}

function activatePickup(g, kind) {
  if (kind === PICKUP.MAGNET) {
    g.effects.magnet = 8 + g.upgrades.magnet * 3;          // 11–23s
  } else if (kind === PICKUP.GHOST) {
    g.effects.ghost = 4 + g.upgrades.ghost * PHYS.ghostSecPerLevel; // 5.6–12s
  } else if (kind === PICKUP.BOOST) {
    const dist = 100 + g.upgrades.boost * PHYS.boostMetersPerLevel; // L5 ≈ 850m
    g.effects.boost = dist / PHYS.speedMax / PHYS.distScale / 60 + 1;
    g.boostEndM = g.meters + dist;
    g.invincibleT = Math.max(g.invincibleT, g.effects.boost);
  } else if (kind === PICKUP.DONATION) {
    g._donationPending = true; // main.js calls arcade.donation()
  }
}

// Perfect-player autopilot for the boost effect: dodge walls, jump lows/gaps,
// slide highs, using the same public moves a player would.
function autopilot(g, lane, pz) {
  const look = 260;                      // scan this far ahead of the player plane
  let urgent = null, urgentD = Infinity;
  for (const o of g.obstacles) {
    if (o.passed) continue;
    const d = o.worldZ - g.cameraZ;
    if (d < pz - 40 || d > pz + look) continue;
    if (o.lane === lane && d - pz < urgentD) { urgent = o; urgentD = d - pz; }
  }
  if (!urgent) return;
  const d = urgentD;
  if (urgent.type === OBSTACLE.LANE_BLOCK) {
    if (d < 190 && g.laneT >= 1) {
      // pick the adjacent lane with nothing in the danger band
      for (const cand of [lane - 1, lane + 1, lane + 2, lane - 2]) {
        if (cand < 0 || cand > 2) continue;
        const clear = !g.obstacles.some(o => {
          if (o.passed || o.lane !== cand) return false;
          const od = o.worldZ - g.cameraZ - pz;
          return od > -60 && od < 220 && o.type === OBSTACLE.LANE_BLOCK;
        });
        if (clear) { changeLane(g, cand - lane); break; }
      }
    }
  } else if (urgent.type === OBSTACLE.HIGH) {
    if (d < 110 && g.action === 'running') slide(g);
  } else { // LOW / GAP — jump
    if (d < 115 && g.action === 'running') jump(g);
  }
}
