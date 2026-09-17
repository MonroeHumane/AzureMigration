// Shared headless bots + geometry for Puppy Skater tuning.
// Imported by tools/tune_puppy_skater.mjs (Node) and dev/sim.js (browser).
// Pure ESM — no DOM.
import { PHYS, WORLD, VIEW } from '../src/config.js';
import { jump, duck } from '../src/engine.js';

export const PAD = 7; // must match engine overlap()
const GY = WORLD.groundY;
const JUMP_MS = PHYS.jumpMs, DUCK_MS = PHYS.duckMs, H = PHYS.jumpHeight;

export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// --- geometry (mirrors engine internals) --------------------------------------
export function playerRect(g) {
  const h = g.action === 'ducking' ? WORLD.duckH : WORLD.standH;
  const x0 = WORLD.playerX - WORLD.playerW / 2;
  const bottom = GY - g.worldY;
  return { x0, x1: x0 + WORLD.playerW, top: bottom - h, bottom };
}
export function obstacleRect(o, camX) {
  const x0 = o.worldX - camX, x1 = x0 + o.w;
  if (o.t === 'blocks') return { x0, x1, top: GY - o.h, bottom: GY };
  if (o.t === 'hang') return { x0, x1, top: -80, bottom: GY - WORLD.hangBottom };
  const top = GY - o.top;
  return { x0, x1, top, bottom: top + o.h };
}
// worldY needed so the pup's feet clear the obstacle's top edge (pad-adjusted)
export function hNeed(o) {
  if (o.t === 'blocks') return o.h - PAD;
  if (o.t === 'fish' || o.t === 'whale') return o.top - PAD;
  return Infinity;
}
export function duckClears(o) {
  if (o.t === 'blocks') return false;
  if (o.t === 'hang') return WORLD.duckH + PAD <= WORLD.hangBottom;
  const belly = o.top - o.h; // flyer underside altitude
  return WORLD.duckH + PAD <= belly;
}
export function jumpClears(o) {
  const need = hNeed(o);
  return need < H && jumpWindowMs(need) > 0;
}
export function describe(o) {
  if (o.t === 'blocks') return `blocks ${Math.round(o.w / WORLD.block)}x${Math.round(o.h / WORLD.block)}`;
  if (o.t === 'hang') return `hang w${Math.round(o.w / WORLD.block)}`;
  if (o.t === 'whale') return 'whale';
  return `fish_${o.top === WORLD.fishLow.top ? 'low' : 'mid'}`;
}

// --- jump-arc math -------------------------------------------------------------
const tRise = h => Math.asin(Math.min(1, Math.max(0, h) / H)) / Math.PI * JUMP_MS;
export function jumpWindowMs(h) { return h >= H ? -1 : JUMP_MS - 2 * tRise(h); }

// Threat timeline for obstacle o: ms until x-overlap starts/ends at current approach speed.
function threatTiming(g, o, pr) {
  const or = obstacleRect(o, g.cameraX);
  const approach = (g.speed + (o.flySpeed || 0)) * 60; // px/s
  const tS = (or.x0 - (pr.x1 - PAD)) / approach * 1000;
  const crossPx = (or.x1 - or.x0) + (pr.x1 - pr.x0) - 2 * PAD;
  return { o, or, approach, tStart: tS, tEnd: tS + crossPx / approach * 1000 };
}
// All unpassed obstacles sorted by overlap-start, soonest first.
export function threats(g) {
  const pr = playerRect(g);
  const out = [];
  for (const o of g.obstacles) {
    if (o.passed) continue;
    const t = threatTiming(g, o, pr);
    if (t.tEnd < -30) continue;
    out.push(t);
  }
  out.sort((a, b) => a.tStart - b.tStart);
  return out;
}

// Action windows in "ms from now" for a threat.
//   jump at J clears iff J ∈ [Jmin, Jmax]; duck at D clears iff D ∈ [Dmin, Dmax].
function windows(t) {
  const need = hNeed(t.o);
  const rise = tRise(Math.max(0, need));
  const win = jumpWindowMs(Math.max(0, need));
  return {
    need, rise, win,
    jumpOk: need < H && win >= (t.tEnd - t.tStart),
    Jmin: t.tEnd - JUMP_MS + rise,
    Jmax: t.tStart - rise,
    duckOk: duckClears(t.o),
    Dmin: t.tEnd - DUCK_MS,
    Dmax: t.tStart,
  };
}

// --- Oracle: feasibility probe --------------------------------------------------
// For each threat computes the action window and picks the timing that CENTERS the
// clearance window over the crossing (max slack on both edges). Then verifies every
// later obstacle that could overlap our busy period still has a feasible window
// after we're free. Records 'impossible' (single unsurvivable obstacle) and
// 'sequence' (actions that starve the next obstacle) in log.
function feasibleAfter(t, freeAt) {
  // can obstacle t be cleared by an action starting at/after freeAt?
  const w = windows(t);
  if (w.jumpOk && t.tStart - w.rise >= freeAt - 8) return true;  // jump window still open
  if (w.duckOk && t.tStart >= freeAt - 8) return true;           // duck anytime before overlap
  return false;
}

export function oracleAct(g, log) {
  if (g.action !== 'running') return;
  const ts = threats(g);
  if (!ts.length) return;
  const t = ts[0];
  const w = windows(t);
  const cross = t.tEnd - t.tStart;

  const cands = [];
  if (w.duckOk && t.tStart > -8) {
    // center the duck over the crossing (equal slack front/back)
    const at = Math.max(0, (t.tStart + t.tEnd - DUCK_MS) / 2);
    cands.push({ kind: 'duck', at, free: at + DUCK_MS });
  }
  if (w.jumpOk && t.tStart - w.rise > -8) {
    // center the above-need window over the crossing
    const at = Math.max(0, t.tStart - w.rise - (w.win - cross) / 2);
    cands.push({ kind: 'jump', at, free: at + JUMP_MS });
  }
  if (!cands.length) {
    if (t.tStart < 200 && !log._flagged.has(t.o.id)) {
      log._flagged.add(t.o.id);
      log.impossible.push({ m: g.meters | 0, desc: describe(t.o), need: w.need | 0, win: w.win | 0, crossMs: cross | 0, speed: +g.speed.toFixed(1) });
    }
    return;
  }
  cands.sort((a, b) => a.free - b.free);

  // Lookahead over every obstacle whose window could collide with our busy time.
  for (const c of cands) {
    let conflict = null;
    for (let i = 1; i < ts.length && ts[i].tStart < c.free + 900; i++) {
      if (!feasibleAfter(ts[i], c.free)) { conflict = ts[i]; break; }
    }
    if (conflict && c !== cands[cands.length - 1]) continue; // try the other action
    if (conflict && !log._flagged.has(conflict.o.id)) {
      log._flagged.add(conflict.o.id);
      log.sequence.push({ m: g.meters | 0, a: describe(t.o), b: describe(conflict.o), freeAt: c.free | 0, itsStart: conflict.tStart | 0, speed: +g.speed.toFixed(1) });
    }
    if (c.at <= 8) { if (c.kind === 'jump') jump(g); else duck(g); }
    return; // not yet time — wait for the window to open
  }
}

// --- Human-sim -------------------------------------------------------------------
// skill ∈ [0,1]: raises reaction time, timing jitter, misread + panic-jump rates.
export function makeHuman(rng, skill) {
  const react = 60 + (1 - skill) * 160;          // ms of perceptual lag
  const jit = () => (rng() + rng() - 1) * (30 + (1 - skill) * 70); // ±ms noise
  const pMisread = 0.015 + (1 - skill) * 0.11;
  const pPanic = 0.02 + (1 - skill) * 0.15;      // jump when a duck was needed
  return {
    skill, plan: null,
    act(g, log) {
      if (g.action !== 'running') { this.plan = null; return; }
      const ts = threats(g);
      if (!ts.length) return;
      const t = ts[0], w = windows(t);
      if (!this.plan || this.plan.id !== t.o.id) {
        const misread = rng() < pMisread;
        const panic = !misread && w.duckOk && !w.jumpOk && rng() < pPanic;
        this.plan = { id: t.o.id, kind: (misread || panic) ? (w.duckOk ? 'jump' : 'duck') : (w.duckOk ? 'duck' : 'jump'), j: jit() };
      }
      const p = this.plan;
      if (p.kind === 'duck' && w.duckOk) {
        // duck on approach; low-skill players sometimes duck too early and stand back up into it
        const trig = 100 + (1 - skill) * 90 + p.j;
        if (t.tStart <= trig && (t.tEnd <= DUCK_MS - 20 || rng() < 0.35 * (1 - skill))) duck(g);
      } else if (p.kind === 'jump' && w.jumpOk) {
        // jump when the obstacle is ~tRise + margin ms away; taller stacks trigger earlier naturally
        const trig = w.rise + 45 + (1 - skill) * 70 + p.j;
        if (t.tStart <= trig) jump(g);
      } else {
        // committed to an action that can't work — take it anyway (human mistake)
        if (t.tStart <= 60 + p.j) (p.kind === 'jump' ? jump(g) : duck(g));
      }
    },
  };
}
