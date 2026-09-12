// Pure game model — no DOM, no canvas. Update with dt (seconds).
import { PHYS, PROJ, BIOMES, BIOME_CYCLE_RESET, OBSTACLE } from './config.js';
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
    // FX
    puffs: [], sparkles: [], confetti: [],
    shake: 0, flash: 0, hurtFlash: 0,
    banner: null,              // { text, sub, t, dur } — milestone/biome banner
    biomeId: 'grass',
    time: 0, deadT: 0,
    // Run stats
    rescued: [],               // [{id,name,photo}] pets picked up this run
    rescuedCount: 0,
    rescueStreak: 0,           // consecutive rescues without a hit
    onDeath: null, onHit: null, onCollect: null, onJump: null, onSlide: null, onLane: null, onLand: null,
    onMilestone: null, onNearMiss: null,
  };
}

export function resetRun(g) {
  g.meters = 0;
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
  g.puffs = []; g.sparkles = []; g.confetti = [];
  g.shake = 0; g.flash = 0; g.hurtFlash = 0;
  g.banner = null; g.biomeId = 'grass';
  g.deadT = 0;
  g.rescued = []; g.rescuedCount = 0; g.rescueStreak = 0;
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

function hitPlayer(g, obs) {
  obs.passed = true;
  g.lives -= 1;
  g.invincibleT = PHYS.invincibleMs / 1000;
  g.hurtFlash = 1;
  g.shake = 0.5;
  g.hitT = 0.55;
  g.rescueStreak = 0;
  g.action = 'running'; g.actionT = 0; g.worldY = 0;
  if (g.onHit) g.onHit(g.lives);
  if (g.lives <= 0) {
    g.state = 'DYING';
    g.deadT = 0;
    if (g.onDeath) g.onDeath(Math.floor(g.meters));
  }
}

export function update(g, dt) {
  g.time += dt;
  const frames = dt * 60;

  if (g.state === 'PLAYING') {
    g.speed = Math.min(PHYS.speedMax, g.speed + PHYS.speedGain * frames);
    g.cameraZ += g.speed * frames;
    g.meters = g.cameraZ * PHYS.distScale;
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

  // Spawn ahead
  const frontZ = g.cameraZ + PROJ.spawnZ;
  while (g.nextSpawnZ < frontZ) {
    const pack = spawnCluster(Math.random, g.nextSpawnZ, g.meters, g._idc || 0);
    g._idc = pack.idCounter;
    g.obstacles.push(...pack.obstacles);
    g.collectibles.push(...pack.collectibles);
    g.nextSpawnZ += nextGap(Math.random, g.meters, g.lastWasHard);
    g.lastWasHard = !!pack.hard;
  }

  const lane = effectiveLane(g);
  const pz = PROJ.playerZ;

  // Collectibles (pet rescues)
  for (const c of g.collectibles) {
    if (c.collected) continue;
    const d = c.worldZ - g.cameraZ;
    if (Math.abs(d - pz) > PHYS.collectWindow) continue;
    if (c.lane !== lane) continue;
    c.collected = true;
    g.rescuedCount += 1;
    g.rescueStreak += 1;
    if (g.onCollect) g.onCollect(c);
    for (let i = 0; i < 5; i++) {
      g.sparkles.push({ lane: c.lane, x: rand(-20, 20), z: pz + rand(-10, 30), vy: rand(-60, -20), life: rand(0.5, 0.9), rot: rand(0, 6) });
    }
  }

  // Obstacles
  if (g.invincibleT <= 0) {
    for (const o of g.obstacles) {
      if (o.passed) continue;
      const d = o.worldZ - g.cameraZ;
      if (d > pz + PHYS.hitWindowFront || d < pz - PHYS.hitWindowBack) continue;
      if (o.lane !== lane) {
        // Near-miss: dodged past in an adjacent lane right at the player plane.
        if (!o.nearMissed && d < pz && d > pz - 60 && Math.abs(o.lane - lane) === 1) {
          o.nearMissed = true;
          if (g.onNearMiss) g.onNearMiss(o);
        }
        if (d < pz) o.passed = true;
        continue;
      }
      let hit = false;
      if (o.type === OBSTACLE.LANE_BLOCK) hit = g.worldY < PHYS.jumpHeight * 0.72;
      else if (o.type === OBSTACLE.LOW) hit = g.worldY < PHYS.lowWallHeight * 0.85;
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
}
