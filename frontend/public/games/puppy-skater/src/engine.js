// Pure game model — no DOM, no canvas. Update with dt (seconds).
// Side-view: the world scrolls past a fixed player at WORLD.playerX.
import { PHYS, WORLD, VIEW, BIOMES, BIOME_CYCLE_RESET } from './config.js';
import { spawnCluster, nextGapMs } from './levelgen.js';

const rand = (a, b) => a + Math.random() * (b - a);
const GY = WORLD.groundY;

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
    cameraX: 0,
    speed: PHYS.speedBase,
    nextSpawnX: VIEW.W + 160,
    lastWasHard: false,
    obstacles: [],
    collectibles: [],
    // Player
    action: 'running',         // running | jumping | ducking
    actionT: 0,
    worldY: 0,                 // height above the pavement
    lives: PHYS.lives,
    invincibleT: 0,
    squashY: 1, stretchX: 1, landFlash: 0,
    dogFrame: 0, dogFrameT: 0,
    lean: 0,                   // ollie back-lean (render)
    hitT: 0,                   // hit-tumble timer (render)
    // FX
    puffs: [], sparkles: [], confetti: [],
    shake: 0, flash: 0, hurtFlash: 0,
    banner: null,              // { text, sub, t, dur }
    biomeId: 'city',
    time: 0, deadT: 0,
    // Run stats
    rescued: [],               // [{id,name,photo}] pets picked up this run
    rescuedCount: 0,
    rescueStreak: 0,
    onDeath: null, onHit: null, onCollect: null, onJump: null, onDuck: null,
    onMilestone: null, onNearMiss: null, onLand: null,
  };
}

export function resetRun(g) {
  g.meters = 0;
  g.cameraX = 0;
  g.speed = PHYS.speedBase;
  g.nextSpawnX = VIEW.W + 160;
  g.lastWasHard = false;
  g.obstacles = [];
  g.collectibles = [];
  g.action = 'running'; g.actionT = 0; g.worldY = 0;
  g.lives = PHYS.lives; g.invincibleT = 0;
  g.squashY = 1; g.stretchX = 1; g.landFlash = 0; g.lean = 0;
  g.hitT = 0;
  g.puffs = []; g.sparkles = []; g.confetti = [];
  g.shake = 0; g.flash = 0; g.hurtFlash = 0;
  g.banner = null; g.biomeId = 'city';
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

export function jump(g) {
  if (g.state === 'READY') { g.state = 'PLAYING'; return; }
  if (g.state !== 'PLAYING' || g.action !== 'running') return;
  g.action = 'jumping'; g.actionT = 0;
  g.squashY = 1.1; g.stretchX = 0.9;
  g.lean = -1;
  for (let i = 0; i < 3; i++) {
    g.puffs.push({ x: WORLD.playerX + rand(-24, 6), y: GY, vx: rand(-40, -10), vy: rand(-40, -10), life: rand(0.3, 0.5) });
  }
  if (g.onJump) g.onJump();
}

export function duck(g) {
  if (g.state === 'READY') { g.state = 'PLAYING'; return; }
  if (g.state !== 'PLAYING' || g.action !== 'running') return;
  g.action = 'ducking'; g.actionT = 0;
  g.squashY = 0.68; g.stretchX = 1.28;
  g.lean = 0.6;
  if (g.onDuck) g.onDuck();
}

// Player hitbox in screen space: bottom sits at ground - worldY.
function playerRect(g) {
  const h = g.action === 'ducking' ? WORLD.duckH : WORLD.standH;
  const x0 = WORLD.playerX - WORLD.playerW / 2;
  const bottom = GY - g.worldY;
  return { x0, x1: x0 + WORLD.playerW, top: bottom - h, bottom };
}

// Obstacle rect in screen space. `top`/`h` are heights above ground for flyers;
// blocks rise from the ground; hangs drop from the sky to WORLD.hangBottom.
function obstacleRect(o, camX) {
  const x0 = o.worldX - camX, x1 = x0 + o.w;
  if (o.t === 'blocks') return { x0, x1, top: GY - o.h, bottom: GY };
  if (o.t === 'hang') return { x0, x1, top: -80, bottom: GY - WORLD.hangBottom };
  const top = GY - o.top, bottom = top + o.h;  // flyers: top = altitude of upper edge
  return { x0, x1, top, bottom };
}

function overlap(a, b) {
  const pad = 7; // forgiveness margin — reads fair at speed
  return a.x0 + pad < b.x1 && a.x1 - pad > b.x0 && a.top + pad < b.bottom && a.bottom - pad > b.top;
}

function hitPlayer(g, o) {
  o.passed = true;
  g.lives -= 1;
  g.invincibleT = PHYS.invincibleMs / 1000;
  g.hurtFlash = 1;
  g.shake = 0.5;
  g.hitT = 0.55;
  g.rescueStreak = 0;
  g.action = 'running'; g.actionT = 0; g.worldY = 0;
  if (g.onHit) g.onHit(g.lives, o);
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
    g.cameraX += g.speed * frames;
    g.meters = g.cameraX * PHYS.distScale;
  }

  // Action timers — sine-arc ollie, timed crouch.
  if (g.action !== 'running') {
    const durMs = g.action === 'jumping' ? PHYS.jumpMs : PHYS.duckMs;
    g.actionT = Math.min(1, g.actionT + dt / (durMs / 1000));
    g.worldY = g.action === 'jumping' ? PHYS.jumpHeight * Math.sin(g.actionT * Math.PI) : 0;
    if (g.action === 'jumping' && g.actionT > 0.35 && g.actionT < 0.65) {
      g.squashY = Math.max(g.squashY, 1.08); g.stretchX = Math.min(g.stretchX, 0.92);
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
  g.lean *= Math.max(0, 1 - dt * 9);

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
    g.banner = { text: b.label, sub: 'New block ahead', t: 2.4, dur: 2.4 };
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

  // Ride-cycle anim — tail wag/bob speeds up with pace
  const fps = g.state === 'PLAYING' ? 8 + (g.speed / PHYS.speedMax) * 9 : 7;
  g.dogFrameT += dt;
  if (g.dogFrameT > 1 / fps) { g.dogFrameT = 0; g.dogFrame = (g.dogFrame + 1) % 6; }

  // Screen-space particles drift left with the world
  const scroll = g.state === 'PLAYING' ? g.speed : 0;
  for (const p of g.puffs) { p.x += (p.vx - scroll) * frames; p.y += p.vy * frames; p.vy += 300 * dt; p.life -= dt; }
  g.puffs = g.puffs.filter(p => p.life > 0);
  for (const s of g.sparkles) { s.x -= scroll * frames; s.life -= dt; s.rot += dt * 6; }
  g.sparkles = g.sparkles.filter(s => s.life > 0);

  if (g.state === 'DYING') {
    g.deadT += dt;
    if (g.deadT > 1.1) g.state = 'GAME_OVER';
    return;
  }
  if (g.state !== 'PLAYING') return;

  // Flyers self-propel toward the pup on top of world scroll
  for (const o of g.obstacles) {
    if (o.flySpeed) o.worldX -= o.flySpeed * frames;
  }

  // Spawn ahead of the right edge (g.rand lets sims run deterministically).
  // Gaps are authored in ms of breathing room AFTER the previous cluster's last
  // element (pack.endMs), converted at the fastest approach a next obstacle could
  // have — a fish arrives sooner than the scroll, so the floor must cover it.
  const srand = g.rand || Math.random;
  const pxPerMs = g.speed * 0.06;               // scroll speed, px/ms
  const maxPxPerMs = (g.speed + PHYS.fishFly) * 0.06; // worst-case approach
  const frontX = g.cameraX + VIEW.W + WORLD.spawnAhead;
  while (g.nextSpawnX < frontX) {
    const pack = spawnCluster(srand, g.nextSpawnX, g.meters, g._idc || 0, pxPerMs);
    g._idc = pack.idCounter;
    g.obstacles.push(...pack.obstacles);
    g.collectibles.push(...pack.collectibles);
    g.nextSpawnX += (pack.endMs + nextGapMs(srand, g.meters, g.lastWasHard)) * maxPxPerMs;
    g.lastWasHard = !!pack.hard;
  }

  const pr = playerRect(g);

  // Collectibles (pet rescues) — token circle vs player rect
  for (const c of g.collectibles) {
    if (c.collected) continue;
    const cx = c.worldX - g.cameraX;
    if (Math.abs(cx - WORLD.playerX) > 44) continue;
    const cy = GY - c.alt;
    const near = { x0: cx - 24, x1: cx + 24, top: cy - 24, bottom: cy + 24 };
    if (!overlap(pr, near)) continue;
    c.collected = true;
    g.rescuedCount += 1;
    g.rescueStreak += 1;
    if (g.onCollect) g.onCollect(c);
    for (let i = 0; i < 5; i++) {
      g.sparkles.push({ x: cx + rand(-18, 18), y: cy + rand(-18, 10), vy: rand(-60, -20), life: rand(0.5, 0.9), rot: rand(0, 6) });
    }
  }

  // Obstacles
  for (const o of g.obstacles) {
    if (o.passed) continue;
    const or = obstacleRect(o, g.cameraX);
    if (or.x1 < pr.x0 - 60 || or.x0 > pr.x1 + 400) {
      if (or.x1 < pr.x0 - 10) o.passed = true;
      continue;
    }
    if (g.invincibleT <= 0 && overlap(pr, or)) { hitPlayer(g, o); break; }
    if (!o.passed && or.x1 < pr.x0) {
      o.passed = true;
      // Near-miss: cleared with <34px of breathing room → "Nice!" feel
      const gap = Math.max(or.top - pr.bottom, pr.top - or.bottom);
      if (!o.nearMissed && gap < 34 && g.action !== 'running') {
        o.nearMissed = true;
        if (g.onNearMiss) g.onNearMiss(o);
      }
    }
  }

  // Prune behind the left edge
  const minX = g.cameraX - WORLD.cullBehind;
  g.obstacles = g.obstacles.filter(o => o.worldX + o.w > minX);
  g.collectibles = g.collectibles.filter(c => !c.collected && c.worldX > minX);

  // Duck spray — board sparks while crouched
  if (g.action === 'ducking' && Math.random() < 0.5) {
    g.puffs.push({ x: WORLD.playerX + rand(-30, -14), y: GY - 4, vx: rand(-90, -40), vy: rand(-60, -15), life: rand(0.22, 0.4) });
  }
}
