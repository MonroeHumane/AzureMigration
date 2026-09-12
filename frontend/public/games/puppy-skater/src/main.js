// Bootstrap: assets → arcade session → input → loop → death pipeline.
import { VIEW, IMAGES, DOGS, MASCOT_TO_DOG, MILESTONES, GAME_ID, PHYS } from './config.js';
import { createGame, resetRun, startRun, jump, duck, update, burstConfetti, setBanner } from './engine.js';
import { drawGame } from './render.js';
import { createUI } from './ui.js';
import { sfx, setMuted, primeAudio, setRoll, startMusic, stopMusic, setMusicTempo } from './audio.js';
import * as arcade from './arcade.js';
import * as pets from './pets.js';

const LS = {
  dog: 'puppySkaterCompanion',
  best: 'puppySkaterBest',
  claimed: 'puppySkaterClaimed',
  mute: 'puppySkaterMuted',
};

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEBUG = new URLSearchParams(location.search).get('debug') === '1';
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const images = {};
let dogId = seedDog();
let claimedThisDevice = readJSON(LS.claimed, []);
let best = readJSON(LS.best, 0) | 0;
let gamesPlayed = 0;
let totalMeters = 0;
let muted = !!readJSON(LS.mute, false);
setMuted(muted);

const g = createGame();
g.best = best;
window.__ps = g; // debug/test hook (same role as shelter-run's __sr)
let petDeck = [];           // pets available to rescue this run
const petImgCache = new Map();

// ── Asset loading ──────────────────────────────────────────────────────────
function loadImage(rel) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => { images[rel] = img; resolve(); };
    img.onerror = () => resolve(); // missing art must never block play
    img.src = 'assets/' + rel;
  });
}
const allImages = [...IMAGES.dogs, ...IMAGES.blocks, ...IMAGES.flyers, ...IMAGES.decor, ...IMAGES.ui, ...IMAGES.numbers];

function petImage(pet) {
  if (!pet || !pet.photo) return null;
  if (petImgCache.has(pet.id)) return petImgCache.get(pet.id);
  // Plain cross-origin draw: pet photos come from blob storage without CORS
  // headers. Drawing a non-CORS image taints the canvas — fine, we never
  // call getImageData/toDataURL on the playfield.
  const img = new Image();
  img.decoding = 'async';
  img.src = pet.photo;
  petImgCache.set(pet.id, img);
  return img;
}

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

// ── Pup selection ──────────────────────────────────────────────────────────
function seedDog() {
  try {
    const saved = localStorage.getItem(LS.dog);
    if (saved && DOGS.some(d => d.id === saved)) return saved;
    const mascot = String(localStorage.getItem('monroeArcadeMascot') || '').toLowerCase();
    if (MASCOT_TO_DOG[mascot]) return MASCOT_TO_DOG[mascot];
  } catch (e) {}
  return 'barnaby';
}
function dogDef() { return DOGS.find(d => d.id === dogId) || DOGS[0]; }

function newPetDeck() {
  petDeck = pets.drawForRun(30).map(p => ({ ...p, img: petImage(p) }));
}

// ── UI ─────────────────────────────────────────────────────────────────────
const ui = createUI({
  onStart() { primeAudio(); ui.hideStart(); ui.resetTicks(); ui.setTicksVisible(true); newPetDeck(); resetRun(g); },
  onRetry() { primeAudio(); ui.hideGameOver(); ui.resetTicks(); newPetDeck(); resetRun(g); ui.setTicksVisible(true); },
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
  onPickDog(id) { dogId = id; try { localStorage.setItem(LS.dog, id); } catch (e) {} sfx.tick(); },
});

// ── Input: keyboard + swipe + on-screen pads ──────────────────────────────
function pressStart() {
  primeAudio();
  if (g.state === 'READY') { startRun(g); }
  else if (g.state === 'GAME_OVER') { ui.hideGameOver(); ui.resetTicks(); newPetDeck(); resetRun(g); ui.setTicksVisible(true); }
}

addEventListener('keydown', e => {
  if (e.repeat) return;
  switch (e.code) {
    case 'ArrowUp': case 'KeyW': case 'Space':
      e.preventDefault(); primeAudio(); jump(g); break;
    case 'ArrowDown': case 'KeyS':
      e.preventDefault(); primeAudio(); duck(g); break;
    case 'KeyM': {
      muted = !muted; setMuted(muted); writeLS(LS.mute, muted);
      document.getElementById('ps-mute').textContent = muted ? '🔇' : '🔊';
      ui.toast(muted ? 'Muted' : 'Sound on');
      break;
    }
    case 'KeyR': case 'Enter':
      if (g.state === 'GAME_OVER') { ui.hideGameOver(); ui.resetTicks(); newPetDeck(); resetRun(g); ui.setTicksVisible(true); }
      break;
    case 'KeyC': case 'Tab': {
      if (g.state === 'READY' || g.state === 'GAME_OVER') {
        const i = DOGS.findIndex(d => d.id === dogId);
        dogId = DOGS[(i + 1) % DOGS.length].id;
        try { localStorage.setItem(LS.dog, dogId); } catch (err) {}
        ui.selectDog(dogId); sfx.tick();
      }
      if (e.code === 'Tab') e.preventDefault();
      break;
    }
    case 'KeyP': case 'Escape':
      togglePause();
      break;
  }
});

document.getElementById('ps-mute').addEventListener('click', () => {
  muted = !muted; setMuted(muted); writeLS(LS.mute, muted);
  document.getElementById('ps-mute').textContent = muted ? '🔇' : '🔊';
});

// Swipe gestures on the canvas — tap/up = ollie, down = duck
let swipeStart = null;
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  swipeStart = { x: e.clientX, y: e.clientY, t: performance.now() };
});
canvas.addEventListener('pointerup', e => {
  if (!swipeStart) return;
  const dy = e.clientY - swipeStart.y;
  const dt = performance.now() - swipeStart.t;
  swipeStart = null;
  if (g.state === 'READY' || g.state === 'GAME_OVER') { pressStart(); return; }
  if (dt > 450) return;
  if (dy > 24) duck(g);
  else jump(g); // tap or swipe-up
});
canvas.addEventListener('pointercancel', () => { swipeStart = null; });

// On-screen pads for coarse pointers
function bindPad(id, fn) {
  const b = document.getElementById(id);
  if (!b) return;
  b.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation(); primeAudio(); fn();
  });
}
bindPad('ps-pad-jump', () => jump(g));
bindPad('ps-pad-duck', () => duck(g));

function togglePause() {
  if (g.state === 'PLAYING') { g.state = 'PAUSED'; ui.toast('Paused — tap to resume'); }
  else if (g.state === 'PAUSED') { g.state = 'PLAYING'; }
}

// Cabinet ↔ game messaging (same contract as the other arcade games)
addEventListener('message', e => {
  const d = e.data;
  if (!d || typeof d !== 'object') return;
  if (d.type === 'arcade:set_mute') { muted = !!d.muted; setMuted(muted); writeLS(LS.mute, muted); document.getElementById('ps-mute').textContent = muted ? '🔇' : '🔊'; }
  if (d.type === 'arcade:pause' && g.state === 'PLAYING') togglePause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && g.state === 'PLAYING') togglePause();
});

// ── Game event hooks ───────────────────────────────────────────────────────
g.onJump = () => sfx.jump();
g.onDuck = () => sfx.duck();
g.onLand = () => sfx.land();
g.onHit = lives => { sfx.hit(); ui.toast(lives > 0 ? `Ruff! ${lives} ❤ left` : 'Wiped out!'); };
g.onNearMiss = () => { sfx.nearMiss(); };

g.onCollect = c => {
  const pet = c.pet;
  if (pet) {
    g.rescued.push({ id: pet.id, name: pet.name, photo: pet.photo, link: pet.link });
    sfx.rescue();
    ui.toast(`🐾 ${pet.name} rescued!`);
  } else {
    sfx.collect();
  }
  // Rescue-streak coin bonus — every 5th consecutive rescue, server decides.
  if (g.rescueStreak > 0 && g.rescueStreak % 5 === 0) {
    arcade.awardCoins('game_award').then(res => {
      const n = res && (res.awarded || res.coins);
      ui.toast(n ? `🔥 ${g.rescueStreak}-rescue streak! +${n} coins` : `🔥 ${g.rescueStreak}-rescue streak!`, { rare: true });
    });
  }
  try {
    if (window.parent && window.parent !== window && pet) {
      window.parent.postMessage({ type: 'adoptedex:pet_rescue_preview', pet_id: pet.id }, '*');
    }
  } catch (e) {}
};

let deathBusy = false;
g.onDeath = async score => {
  if (deathBusy) return;
  deathBusy = true;
  sfx.hit(); setTimeout(() => sfx.die(), 140);
  ui.setTicksVisible(false);

  gamesPlayed += 1;
  totalMeters += score;
  const isNewBest = score > best;
  if (isNewBest) { best = score; g.best = best; writeLS(LS.best, best); }

  // Score submit + cabinet notify (fire-and-forget)
  if (score > 0) {
    arcade.submitScore(score, { dog: dogId, rescued: g.rescuedCount }).catch(() => {});
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'arcade:score_recorded', game: GAME_ID, gameId: GAME_ID, score, player: arcade.playerName() }, '*');
      }
    } catch (e) {}
  }

  // Settle rescues → packs (every 20 in this run = 1 pack, no carry-over).
  // Rescued pets no longer auto-enter the Binder — they earn packs instead.
  const packsEarned = Math.floor(g.rescuedCount / 20);
  const packSettle = arcade.earnRescuePacks(g.rescuedCount).catch(() => null);

  // Show the panel immediately — the leaderboard fills in when the fetch
  // resolves (a cold Azure container can take 10s+; don't gate the UI on it).
  ui.showGameOver({ score, best, isNewBest, leaders: null, unopenedPacks: 0, rescued: g.rescued, packsEarned });
  arcade.getLeaderboard(10).then(leaders => ui.updateLeaderboard(leaders, score)).catch(() => {});
  const profile = await arcade.fetchProfile().catch(() => null);

  // Milestone claims — server dedupes, claimed:true is the only truth
  const crossed = MILESTONES.filter(m => score >= m.at);
  for (const m of crossed) {
    if (claimedThisDevice.includes(m.key)) continue;
    try {
      const res = await arcade.claimMilestone(m.key, m.tier);
      if (res && res.claimed) {
        claimedThisDevice.push(m.key);
        writeLS(LS.claimed, claimedThisDevice);
        const bits = [];
        if (res.packsAwarded) bits.push(`${res.packsAwarded} ${m.tier} pack${res.packsAwarded > 1 ? 's' : ''}`);
        if (res.coinsAwarded) bits.push(`${res.coinsAwarded} coins`);
        ui.toast(`${m.label} (${m.at}m): ${bits.length ? bits.join(' + ') + ' earned!' : 'milestone claimed!'}`, { rare: m.at >= 3000, ms: 4200 });
        sfx.medal();
      } else if (res) {
        claimedThisDevice.push(m.key);
        writeLS(LS.claimed, claimedThisDevice);
      }
    } catch (e) { /* offline — retry next run */ }
  }

  // Cloud save (best-effort)
  const saveData = { best, gamesPlayed, totalMeters, dogId, claimedMilestones: claimedThisDevice };
  arcade.pushCloudSave(saveData).catch(() => {});

  const settled = await packSettle;
  const unopened = settled && typeof settled.unopened_packs === 'number'
    ? settled.unopened_packs
    : (profile && typeof profile.unopened_packs === 'number'
        ? profile.unopened_packs
        : (profile && profile.profile && profile.profile.unopened_packs) || 0);
  ui.setPacks(unopened);
  if (settled && settled.packsAwarded > 0) {
    ui.toast(`🎁 ${settled.packsAwarded} pack${settled.packsAwarded > 1 ? 's' : ''} earned — open in your Adoptédex!`, { rare: true, ms: 4200 });
  }
  deathBusy = false;
};

// Live milestone ticks as distance crosses thresholds
let lastMilestoneCheck = 0;
function checkMilestoneTicks() {
  for (const m of MILESTONES) {
    if (g.meters >= m.at && lastMilestoneCheck < m.at) {
      ui.markMilestone(m.key);
      setBanner(g, `${m.at}m — ${m.label}!`, m.at >= 3000 ? 'Duo pack at the finish!' : 'Milestone reached');
      burstConfetti(g, m.at >= 3000 ? 90 : 55);
      sfx.fanfare();
    }
  }
  lastMilestoneCheck = g.meters;
}

// ── Main loop ──────────────────────────────────────────────────────────────
let last = performance.now();
let lastPhase = '';
let lastRollFrame = -1;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (g.state !== 'PAUSED') {
    update(g, dt);
    if (g.state === 'PLAYING') checkMilestoneTicks();
    else if (g.state === 'READY') lastMilestoneCheck = 0;
  }

  // Wheel-tick rhythm synced to the ride cycle + board rumble follows speed.
  if (g.state === 'PLAYING' && g.action === 'running' && g.dogFrame !== lastRollFrame) {
    lastRollFrame = g.dogFrame;
    if (g.dogFrame % 2 === 0) sfx.roll();
  }
  const speedT = Math.max(0, Math.min(1, (g.speed - PHYS.speedBase) / (PHYS.speedMax - PHYS.speedBase)));
  setRoll(g.state === 'PLAYING' ? speedT : 0);
  setMusicTempo(speedT);
  if (g.state === 'PLAYING') startMusic(); else stopMusic();

  const phase = g.state === 'PLAYING' || g.state === 'DYING' ? 'playing'
    : g.state === 'GAME_OVER' ? 'over' : 'menu';
  if (phase !== lastPhase) { ui.setPhase(phase); lastPhase = phase; }

  const sx = canvas.width / VIEW.W, sy = canvas.height / VIEW.H;
  ctx.setTransform(sx, 0, 0, sy, 0, 0);
  ctx.imageSmoothingEnabled = true;
  drawGame(ctx, g, { images, dogDef: dogDef(), petDeck }, reducedMotion, DEBUG);
  requestAnimationFrame(frame);
}

function readJSON(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
function writeLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

// ── Boot ───────────────────────────────────────────────────────────────────
(async function boot() {
  fit();
  document.getElementById('ps-mute').textContent = muted ? '🔇' : '🔊';
  await Promise.all(allImages.map(loadImage));

  // Pet catalog warms in parallel — run is playable without it
  pets.fetchPets().then(list => { if (!petDeck.length) newPetDeck(); }).catch(() => {});

  arcade.ensureSession();
  const cloud = await arcade.loadCloudSave().catch(() => null);
  if (cloud) {
    if ((cloud.best | 0) > best) { best = cloud.best | 0; g.best = best; writeLS(LS.best, best); }
    if (Array.isArray(cloud.claimedMilestones)) {
      claimedThisDevice = Array.from(new Set([...claimedThisDevice, ...cloud.claimedMilestones]));
      writeLS(LS.claimed, claimedThisDevice);
    }
    if (cloud.dogId && DOGS.some(d => d.id === cloud.dogId) && !localStorage.getItem(LS.dog)) dogId = cloud.dogId;
    gamesPlayed = cloud.gamesPlayed || 0;
    totalMeters = cloud.totalMeters || 0;
  }

  newPetDeck();
  ui.showStart(best, dogId);
  requestAnimationFrame(frame);
})();
