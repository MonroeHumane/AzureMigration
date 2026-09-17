// Pure game model — no DOM, no canvas. Update with dt (seconds).
import { VIEW, PHYS, BIOMES } from './config.js';
import { catEllipse, pipeRects, ellipseHitsRect } from './hitbox.js';

const rand = (a, b) => a + Math.random() * (b - a);

export function biomeForScore(score) {
  let b = BIOMES[0];
  for (const cand of BIOMES) if (score >= cand.min) b = cand;
  return b;
}

// Theme-aware biome: dark launcher theme → the opening stretch flies under
// Night Ice instead of day grass; the palette rejoins the normal cycle at
// the first seam (score 8).
export function biomeForGame(g) {
  if (g.nightStart && g.score < BIOMES[1].min) return BIOMES[BIOMES.length - 1];
  return biomeForScore(g.score);
}

export function createGame() {
  return {
    state: 'READY',            // READY | PLAYING | DYING | GAME_OVER | PAUSED
    score: 0,
    best: 0,
    catY: VIEW.H * 0.42,
    catVy: 0,
    catRot: 0,
    catFrame: 0,
    catFrameT: 0,
    flapPhase: 0,
    pipes: [],                 // {x, gapY, gapH, scored, biomeId}
    puffs: [],                 // {x,y,vx,vy,life}
    sparkles: [],
    groundX: 0,
    cloudX: 0,
    hillsX: 0,
    spawnT: 0,
    time: 0,
    deadT: 0,
    flash: 0,
    shake: 0,
    hitStop: 0,
    popups: [],
    speedlines: [],
    nightStart: false,         // launcher dark theme → opening stretch at night
    onDeath: null,
    onScore: null,
    onFlap: null,
    onNearMiss: null,
  };
}

export function resetRun(g) {
  g.score = 0;
  g.catY = VIEW.H * 0.42;
  g.catVy = 0;
  g.catRot = 0;
  g.pipes = [];
  g.puffs = [];
  g.sparkles = [];
  g.spawnT = 0.65;
  g.deadT = 0;
  g.flash = 0;
  g.shake = 0;
  g.hitStop = 0;
  g.popups = [];
  g.speedlines = [];
  g.state = 'READY';
}

export function flap(g) {
  if (g.state === 'READY') g.state = 'PLAYING';
  if (g.state !== 'PLAYING') return;
  g.catVy = PHYS.flapVy;
  g.flapPhase = 0.35;
  for (let i = 0; i < 3; i++) {
    g.puffs.push({ x: PHYS.catX - 34, y: g.catY + rand(14, 26), vx: rand(-60, -20), vy: rand(20, 60), life: rand(0.35, 0.55) });
  }
  if (g.onFlap) g.onFlap();
}

function spawnPipe(g) {
  const difficulty = Math.min(1, g.score / 40);
  const gapH = PHYS.gapBase - (PHYS.gapBase - PHYS.gapMin) * difficulty;
  const margin = 90;
  const lo = margin + gapH / 2;
  const hi = VIEW.H - VIEW.GROUND - margin - gapH / 2;
  const gapY = rand(lo, hi);
  g.pipes.push({ x: VIEW.W + 60, gapY, gapH, scored: false });
}

function kill(g) {
  if (g.state === 'DYING' || g.state === 'GAME_OVER') return;
  g.state = 'DYING';
  g.deadT = 0;
  g.flash = 1;
  g.shake = 0.55;
  g.hitStop = 0.09;
  // Impact burst — debris kicks off the crash point
  for (let i = 0; i < 10; i++) {
    g.puffs.push({ x: PHYS.catX + rand(-6, 20), y: g.catY + rand(-14, 14),
                   vx: rand(30, 150), vy: rand(-170, -20), life: rand(0.3, 0.55) });
  }
  g.popups.push({ x: PHYS.catX + 20, y: g.catY - 52, text: 'bonk!', t: 0, life: 1.0 });
  if (g.onDeath) g.onDeath(g.score);
}

export function update(g, dt, assets) {
  // Hitstop — brief slow-mo on impact makes the crash read
  if (g.hitStop > 0) { g.hitStop -= dt; dt *= 0.22; }
  const images = (assets && assets.images) || {};
  const catDef = (assets && assets.catDef) || null;
  g.time += dt;
  const scroll = g.state === 'PLAYING' ? Math.min(PHYS.speedMax, PHYS.speedBase + g.score * 2.2) : 0;

  // Ambient parallax always scrolls a little so menus feel alive
  g.cloudX += dt * 14;
  g.hillsX += dt * (scroll * 0.35 + 8);
  if (g.state === 'PLAYING' || g.state === 'DYING') g.groundX += scroll * dt;

  // Cat physics
  if (g.state === 'PLAYING' || g.state === 'DYING') {
    g.catVy = Math.min(PHYS.maxFall, g.catVy + PHYS.gravity * dt);
    g.catY += g.catVy * dt;
    g.catRot = Math.max(-0.45, Math.min(1.35, g.catVy / 620));
  } else if (g.state === 'READY') {
    g.catY = VIEW.H * 0.42 + Math.sin(g.time * 2.4) * 9;
    g.catRot = Math.sin(g.time * 2.4 + 0.6) * 0.08;
  }
  g.flapPhase = Math.max(0, g.flapPhase - dt);
  const fps = g.state === 'PLAYING' ? (g.flapPhase > 0 ? 18 : 10) : 8;
  g.catFrameT += dt;
  if (g.catFrameT > 1 / fps) { g.catFrameT = 0; g.catFrame = (g.catFrame + 1) % 6; }

  // Particles
  for (const p of g.puffs) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt; p.life -= dt; }
  g.puffs = g.puffs.filter(p => p.life > 0);
  for (const s of g.sparkles) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; s.rot += dt * 6; }
  g.sparkles = g.sparkles.filter(s => s.life > 0);
  g.flash = Math.max(0, g.flash - dt * 3.2);
  g.shake = Math.max(0, g.shake - dt * 1.8);

  // Floating popups — rise + fade
  for (const p of g.popups) { p.t += dt; p.y -= 46 * dt; }
  g.popups = g.popups.filter(p => p.t < p.life);

  // Speed lines — stream once the scroll is actually fast
  const speedT = Math.max(0, Math.min(1, (scroll - PHYS.speedBase) / (PHYS.speedMax - PHYS.speedBase)));
  if (g.state === 'PLAYING' && speedT > 0.45) {
    if (Math.random() < dt * (speedT - 0.45) * 30) {
      g.speedlines.push({ x: VIEW.W + rand(0, 120), y: rand(60, VIEW.H - VIEW.GROUND - 140), len: rand(24, 80) * speedT, life: 0.5 });
    }
  }
  for (const l of g.speedlines) { l.x -= (scroll * 2.1 + 120) * dt; l.life -= dt; }
  g.speedlines = g.speedlines.filter(l => l.life > 0 && l.x + l.len > -10);

  if (g.state !== 'PLAYING' && g.state !== 'DYING') return;

  // Pipes
  g.spawnT -= dt;
  if (g.state === 'PLAYING' && g.spawnT <= 0) {
    spawnPipe(g);
    g.spawnT = PHYS.spawnEvery * Math.max(0.82, 1 - g.score * 0.004);
  }
  for (const p of g.pipes) p.x -= scroll * dt;
  g.pipes = g.pipes.filter(p => p.x > -PHYS.pipeW - 40);

  const floorY = VIEW.H - VIEW.GROUND;
  if (g.state === 'PLAYING') {
    // Tight cat ellipse: alpha-derived per frame, offset rotated by cat tilt.
    const catImg = catDef ? images[catDef.sheet] : null;
    const e = catDef
      ? catEllipse(catImg, g.catFrame % catDef.frames, catDef.fw, catDef.fh, 92)
      : { ox: 0, oy: 0, rx: PHYS.catR * 0.9, ry: PHYS.catR * 0.8 };
    const cr = Math.cos(g.catRot), sr = Math.sin(g.catRot);
    const ecx = PHYS.catX + e.ox * cr - e.oy * sr;
    const ecy = g.catY + e.ox * sr + e.oy * cr;

    const biome = biomeForGame(g);
    const topImg = biome.id === 'grass' ? images['rock_top.png'] : images[`rock_top_${biome.id}.png`];
    const botImg = biome.id === 'grass' ? images['rock_bottom.png'] : images[`rock_bottom_${biome.id}.png`];

    for (const p of g.pipes) {
      if (!p.scored && p.x + PHYS.pipeW < PHYS.catX - e.rx) {
        p.scored = true;
        g.score += 1;
        if (g.onScore) g.onScore(g.score);
        for (let i = 0; i < 5; i++) {
          g.sparkles.push({ x: PHYS.catX + rand(-8, 8), y: g.catY - 40, vx: rand(-30, 30), vy: rand(-90, -30), life: rand(0.5, 0.9), rot: rand(0, 6) });
        }
        // Near-miss: squeaked through with <26px of breathing room → praise
        const gapTop = p.gapY - p.gapH / 2, gapBot = p.gapY + p.gapH / 2;
        const clearance = Math.min((g.catY - e.ry) - gapTop, gapBot - (g.catY + e.ry));
        if (clearance < 26) {
          const words = ['close!', 'phew!', 'threaded!'];
          g.popups.push({ x: PHYS.catX + 26, y: g.catY - 60,
                          text: words[(Math.random() * words.length) | 0], t: 0, life: 0.9 });
          if (g.onNearMiss) g.onNearMiss(p);
        }
      }
      // Alpha-banded rock hitboxes vs the cat ellipse
      if (p.x > PHYS.catX + 160 || p.x + PHYS.pipeW < PHYS.catX - 160) continue;
      const gapTop = p.gapY - p.gapH / 2;
      const gapBot = p.gapY + p.gapH / 2;
      const topRects = pipeRects(topImg, PHYS.pipeW, gapTop, true);
      const botRects = pipeRects(botImg, PHYS.pipeW, floorY - gapBot, false);
      let hit = false;
      for (const r of topRects) {
        if (ellipseHitsRect(ecx, ecy, e.rx, e.ry, p.x + r.ox, r.oy, r.w, r.h)) { hit = true; break; }
      }
      if (!hit) {
        for (const r of botRects) {
          if (ellipseHitsRect(ecx, ecy, e.rx, e.ry, p.x + r.ox, gapBot + r.oy, r.w, r.h)) { hit = true; break; }
        }
      }
      if (hit) kill(g);
    }
    // Ceiling: keep the *rotated* sprite fully on-screen. The cat is drawn
    // 92x80 around its center, so its rotated half-height is
    // (w/2)|sin| + (h/2)|cos| — clamp on that, not the hitbox.
    const spriteHalfH = 46 * Math.abs(sr) + 40.25 * Math.abs(cr);
    if (g.catY < spriteHalfH + 4) { g.catY = spriteHalfH + 4; g.catVy = Math.max(0, g.catVy); }
    if (ecy + e.ry >= floorY) { g.catY = floorY - e.ry - (e.ox * sr + e.oy * cr); kill(g); }
  } else if (g.state === 'DYING') {
    g.deadT += dt;
    if (g.catY + PHYS.catR * 0.8 >= floorY) {
      g.catY = floorY - PHYS.catR * 0.8;
      g.catVy = 0;
      if (g.deadT > 0.55) g.state = 'GAME_OVER';
    }
    if (g.deadT > 1.6) g.state = 'GAME_OVER';
  }
}
