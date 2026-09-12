// Bootstrap: assets → arcade session → input → loop → death pipeline.
import { VIEW, IMAGES, CATS, MASCOT_TO_CAT, MILESTONES, GAME_ID } from './config.js';
import { createGame, resetRun, flap, update } from './engine.js';
import { drawGame } from './render.js';
import { createUI } from './ui.js';
import { sfx, setMuted, primeAudio } from './audio.js';
import * as arcade from './arcade.js';

const LS = {
  cat: 'flappyCat2Companion',
  best: 'flappyCat2Best',
  claimed: 'flappyCat2Claimed',
  mute: 'flappyCat2Muted',
};

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEBUG = new URLSearchParams(location.search).get('debug') === '1';
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const images = {};
let catId = seedCat();
let claimedThisDevice = readJSON(LS.claimed, []);
let best = readJSON(LS.best, 0) | 0;
let gamesPlayed = 0;
let totalScore = 0;
let muted = !!readJSON(LS.mute, false);
setMuted(muted);

const g = createGame();
g.best = best;

// ── Asset loading ──────────────────────────────────────────────────────────
function loadImage(rel) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => { images[rel] = img; resolve(); };
    img.onerror = () => resolve(); // missing art must never block play
    img.src = 'assets/' + rel;
  });
}
const allImages = [...IMAGES.cats, ...IMAGES.decor, ...IMAGES.rocks, ...IMAGES.ui, ...IMAGES.numbers];

// ── Canvas sizing: fixed logical resolution, scaled to fit ─────────────────
function fit() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const shell = document.getElementById('game-shell');
  const availW = shell.clientWidth, availH = shell.clientHeight;
  const scale = Math.min(availW / VIEW.W, availH / VIEW.H);
  const cssW = Math.round(VIEW.W * scale), cssH = Math.round(VIEW.H * scale);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width = Math.round(VIEW.W * scale * dpr);
  canvas.height = Math.round(VIEW.H * scale * dpr);
}
addEventListener('resize', fit);

// ── Cat selection ──────────────────────────────────────────────────────────
function seedCat() {
  try {
    const saved = localStorage.getItem(LS.cat);
    if (saved && CATS.some(c => c.id === saved)) return saved;
    const mascot = String(localStorage.getItem('monroeArcadeMascot') || '').toLowerCase();
    if (MASCOT_TO_CAT[mascot]) return MASCOT_TO_CAT[mascot];
  } catch (e) {}
  return 'calico';
}
function catDef() { return CATS.find(c => c.id === catId) || CATS[0]; }

// ── UI ─────────────────────────────────────────────────────────────────────
const ui = createUI({
  onStart() { primeAudio(); ui.hideStart(); ui.setTicksVisible(true); resetRun(g); },
  onRetry() { primeAudio(); ui.hideGameOver(); resetRun(g); ui.setTicksVisible(true); },
  async onOpenPack() {
    sfx.pack();
    try {
      const result = await arcade.openPack('standard');
      if (result && result.ok) {
        ui.showPackResult(result);
      } else {
        ui.toast((result && result.message) || 'No packs to open.');
      }
    } catch (e) {
      ui.toast(e.message || 'Pack opening failed.');
    }
  },
  onPickCat(id) { catId = id; try { localStorage.setItem(LS.cat, id); } catch (e) {} sfx.tick(); },
});

// ── Input ──────────────────────────────────────────────────────────────────
function press() {
  primeAudio();
  if (g.state === 'READY' || g.state === 'PLAYING') flap(g);
  else if (g.state === 'GAME_OVER') { ui.hideGameOver(); resetRun(g); }
}
canvas.addEventListener('pointerdown', e => { e.preventDefault(); press(); });
document.getElementById('fc-flap').addEventListener('pointerdown', e => {
  e.preventDefault(); e.stopPropagation(); press();
});
addEventListener('keydown', e => {
  if (e.repeat) return;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); press(); }
  if (e.code === 'KeyM') {
    muted = !muted; setMuted(muted); writeLS(LS.mute, muted);
    document.getElementById('fc-mute').textContent = muted ? '🔇' : '🔊';
    ui.toast(muted ? 'Muted' : 'Sound on');
  }
  if ((e.code === 'KeyR' || e.code === 'Enter') && g.state === 'GAME_OVER') {
    ui.hideGameOver(); resetRun(g); ui.setTicksVisible(true);
  }
  if (e.code === 'KeyC' || e.code === 'Tab') {
    if (g.state === 'READY' || g.state === 'GAME_OVER') {
      const i = CATS.findIndex(c => c.id === catId);
      catId = CATS[(i + 1) % CATS.length].id;
      try { localStorage.setItem(LS.cat, catId); } catch (err) {}
      ui.selectCat(catId); sfx.tick();
    }
    if (e.code === 'Tab') e.preventDefault();
  }
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
});
document.getElementById('fc-mute').addEventListener('click', () => {
  muted = !muted; setMuted(muted); writeLS(LS.mute, muted);
  document.getElementById('fc-mute').textContent = muted ? '🔇' : '🔊';
});

function togglePause() {
  if (g.state === 'PLAYING') { g.state = 'PAUSED'; ui.toast('Paused — tap to resume'); }
  else if (g.state === 'PAUSED') { g.state = 'PLAYING'; }
}

// Cabinet ↔ game messaging (same contract as v1)
addEventListener('message', e => {
  const d = e.data;
  if (!d || typeof d !== 'object') return;
  if (d.type === 'arcade:set_mute') { muted = !!d.muted; setMuted(muted); writeLS(LS.mute, muted); }
  if (d.type === 'arcade:pause' && g.state === 'PLAYING') togglePause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && g.state === 'PLAYING') togglePause();
});

// ── Death pipeline: score → leaderboard → milestones → save ────────────────
g.onFlap = () => sfx.flap();
g.onScore = score => {
  sfx.point();
  const m = MILESTONES.find(x => x.at === score);
  if (m) { ui.markMilestone(m.key); sfx.tick(); }
};

let deathBusy = false;
g.onDeath = async score => {
  if (deathBusy) return;
  deathBusy = true;
  sfx.hit(); setTimeout(() => sfx.die(), 140);
  ui.setTicksVisible(false);

  gamesPlayed += 1;
  totalScore += score;
  const isNewBest = score > best;
  if (isNewBest) { best = score; g.best = best; writeLS(LS.best, best); }

  // Fire-and-forget score submit + cabinet notify (same contract as v1)
  if (score > 0) {
    arcade.submitScore(score, { cat: catId, biome: score >= 25 ? 'ice' : score >= 15 ? 'snow' : score >= 8 ? 'dirt' : 'grass' }).catch(() => {});
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'arcade:score_recorded', game: GAME_ID, gameId: GAME_ID, score, player: arcade.playerName() }, '*');
      }
    } catch (e) {}
  }

  const [leaders, profile] = await Promise.all([
    arcade.getLeaderboard(10).catch(() => []),
    arcade.fetchProfile().catch(() => null),
  ]);

  // Milestone claims — server dedupes, claimed:true is the only truth
  const crossed = MILESTONES.filter(m => score >= m.at);
  for (const m of crossed) {
    if (claimedThisDevice.includes(m.key)) continue;
    try {
      const res = await arcade.claimMilestone(m.key);
      if (res && res.claimed) {
        claimedThisDevice.push(m.key);
        writeLS(LS.claimed, claimedThisDevice);
        const bits = [];
        if (res.packsAwarded) bits.push(`${res.packsAwarded} pack${res.packsAwarded > 1 ? 's' : ''}`);
        if (res.coinsAwarded) bits.push(`${res.coinsAwarded} coins`);
        ui.toast(`${m.label}: ${bits.length ? bits.join(' + ') + ' earned!' : 'milestone claimed!'}`, { rare: m.at >= 30, ms: 4200 });
        sfx.medal();
      } else if (res) {
        claimedThisDevice.push(m.key); // already claimed on server — stop retrying
        writeLS(LS.claimed, claimedThisDevice);
      }
    } catch (e) { /* offline — retry next run */ }
  }

  // Cloud save (best-effort)
  const saveData = { best, gamesPlayed, totalScore, catId, claimedMilestones: claimedThisDevice };
  arcade.pushCloudSave(saveData).catch(() => {});

  const unopened = profile && typeof profile.unopened_packs === 'number'
    ? profile.unopened_packs
    : (profile && profile.profile && profile.profile.unopened_packs) || 0;

  ui.showGameOver({ score, best, isNewBest, leaders, unopenedPacks: unopened });
  deathBusy = false;
};

// ── Main loop ──────────────────────────────────────────────────────────────
let last = performance.now();
let lastPhase = '';
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (g.state !== 'PAUSED') update(g, dt, { images, catDef: catDef() });

  // Keep key hints honest: only surface what works in this phase.
  const phase = g.state === 'PLAYING' || g.state === 'DYING' ? 'playing'
    : g.state === 'GAME_OVER' ? 'over' : 'menu';
  if (phase !== lastPhase) { ui.setPhase(phase); lastPhase = phase; }

  const sx = canvas.width / VIEW.W, sy = canvas.height / VIEW.H;
  ctx.setTransform(sx, 0, 0, sy, 0, 0);
  ctx.imageSmoothingEnabled = true;
  drawGame(ctx, g, images, catDef(), reducedMotion, DEBUG);
  requestAnimationFrame(frame);
}

function readJSON(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
function writeLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

// ── Boot ───────────────────────────────────────────────────────────────────
(async function boot() {
  fit();
  document.getElementById('fc-mute').textContent = muted ? '🔇' : '🔊';
  await Promise.all(allImages.map(loadImage));

  // Arcade session + cloud save restore (best score wins across devices)
  arcade.ensureSession();
  const cloud = await arcade.loadCloudSave().catch(() => null);
  if (cloud) {
    if ((cloud.best | 0) > best) { best = cloud.best | 0; g.best = best; writeLS(LS.best, best); }
    if (Array.isArray(cloud.claimedMilestones)) {
      claimedThisDevice = Array.from(new Set([...claimedThisDevice, ...cloud.claimedMilestones]));
      writeLS(LS.claimed, claimedThisDevice);
    }
    if (cloud.catId && CATS.some(c => c.id === cloud.catId) && !localStorage.getItem(LS.cat)) catId = cloud.catId;
    gamesPlayed = cloud.gamesPlayed || 0;
    totalScore = cloud.totalScore || 0;
  }

  ui.showStart(best, catId);
  requestAnimationFrame(frame);
})();
