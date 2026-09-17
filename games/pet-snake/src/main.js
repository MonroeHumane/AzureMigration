// Pet Snake Adventure — Main Coordinator & Bootloader
// Orchestrates RAF loop, input bindings, canvas scaling, audio, and arcade postMessage bridge.

import { VIEW, GAME_ID, MILESTONES } from './config.js';
import { PetSnakeEngine, GAME_PHASES } from './engine.js';
import { CanvasBoardRenderer } from './render.js';
import { UIManager } from './ui.js';
import { sfx, primeAudio, setMuted, playMusic, stopMusic, playDeathMusic, stopDeathMusic } from './audio.js';
import * as arcade from './arcade.js';
import * as pets from './pets.js';

const canvas = document.getElementById('game-canvas');
const uiRoot = document.getElementById('ui-root');

// Canvas DPR sizing
function fitCanvas() {
  if (!canvas) return;
  const shell = document.getElementById('game-shell');
  if (!shell) return;

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const availW = shell.clientWidth || window.innerWidth;
  const availH = shell.clientHeight || window.innerHeight;

  const scale = Math.min((availW - 16) / VIEW.W, (availH - 16) / VIEW.H, 1.2);
  const cssW = Math.max(280, Math.round(VIEW.W * scale));
  const cssH = Math.max(280, Math.round(VIEW.H * scale));

  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);

  const ctx = canvas.getContext('2d');
  ctx.resetTransform?.();
  ctx.scale(canvas.width / VIEW.W, canvas.height / VIEW.H);
}

window.addEventListener('resize', fitCanvas);

// Initialize Engine, Renderer, UI
const engine = new PetSnakeEngine();
const renderer = new CanvasBoardRenderer(canvas);
window.__snake = engine; // Deterministic debug & testing handle

// Theme synchronization
const initialTheme = new URLSearchParams(location.search).get('theme') || localStorage.getItem('humaneGamesTheme') || 'dark';
renderer.setTheme(initialTheme);

window.addEventListener('humane-games-theme', (e) => {
  renderer.setTheme(e.detail?.theme);
});

window.addEventListener('message', (e) => {
  if (e.data?.type === 'arcade:set_theme') {
    renderer.setTheme(e.data.theme);
  } else if (e.data?.type === 'arcade:set_mute') {
    setMuted(!!e.data.muted);
  }
});

// UI Callbacks
const ui = new UIManager(uiRoot, {
  onStart(modifierKey, mascotId) {
    primeAudio();
    stopDeathMusic();
    playMusic('default1.mp3');
    engine.startRun(modifierKey, mascotId);
    ui.setupHUD();
  },

  onTogglePause() {
    engine.togglePause();
    if (engine.phase === GAME_PHASES.PAUSED) {
      ui.showPauseOverlay();
    } else {
      ui.hidePauseOverlay();
    }
  },

  onAbort() {
    stopMusic();
    stopDeathMusic();
    engine.phase = GAME_PHASES.IDLE;
    ui.showTitleScreen({
      bestScore: localStorage.getItem('petSnakeBestScore') || 0,
      bestFloor: localStorage.getItem('petSnakeBestFloor') || 1,
      coins: arcade.localCoins()
    });
  },

  onSkipRoute(upgradeId) {
    if (upgradeId) engine.selectUpgrade(upgradeId);
    engine.skipRoute();
  },

  onReturnToTitle() {
    stopDeathMusic();
    ui.showTitleScreen({
      bestScore: localStorage.getItem('petSnakeBestScore') || 0,
      bestFloor: localStorage.getItem('petSnakeBestFloor') || 1,
      coins: arcade.localCoins()
    });
  },

  onContinueWithCoins() {
    if (engine.continueWithCoins()) {
      stopDeathMusic();
      playMusic('default1.mp3');
      ui.setupHUD();
    }
  }
});

// ── Wire Engine Events to Audio & Economy ───────────────────────────────────
engine.on('treat:eat', () => sfx.eat());
engine.on('health:change', ({ hearts }) => {
  if (hearts > 0) sfx.bonk();
});
engine.on('powerup:collect', () => sfx.powerup());
engine.on('bomb:shield', () => sfx.bonk());
engine.on('effect:feather', () => sfx.powerup());

engine.on('floor:complete', async ({ floor }) => {
  sfx.victory();

  // Check Milestone Rewards
  const milestone = MILESTONES.find(m => m.at === floor);
  if (milestone) {
    try {
      await arcade.claimMilestone(milestone.key, milestone.tier);
    } catch (e) {}
  }

  ui.showDraftModal(engine.draftUpgrades, engine.routeChoices, (upgradeId, routeIndex) => {
    if (upgradeId) engine.selectUpgrade(upgradeId);
    engine.chooseRoute(routeIndex);
    engine.advanceToNextFloor();
  });
});

engine.on('run:end', async (summary) => {
  if (summary.victory) {
    sfx.victory();
  } else {
    playDeathMusic();
  }

  // Update local bests
  const bestScore = Math.max(summary.score, Number(localStorage.getItem('petSnakeBestScore') || 0));
  const bestFloor = Math.max(summary.floor, Number(localStorage.getItem('petSnakeBestFloor') || 0));
  localStorage.setItem('petSnakeBestScore', String(bestScore));
  localStorage.setItem('petSnakeBestFloor', String(bestFloor));

  // Show Field Journal immediately — never block UI on network
  ui.showFieldJournal(summary);

  // Submit results asynchronously in the background
  arcade.submitScore(summary.score, {
    floor: summary.floor,
    victory: summary.victory,
    treats: summary.treatsCollected
  }).catch(() => {});

  if (summary.rescuedPets.length > 0) {
    const petIds = summary.rescuedPets.map(p => p.id);
    arcade.reportDiscoveries(petIds).catch(() => {});
  }

  arcade.pushCloudSave({
    best: bestScore,
    bestFloor: bestFloor,
    gamesPlayed: 1
  }).catch(() => {});
});

// ── Input Controls ──────────────────────────────────────────────────────────
const KEY_MAP = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right'
};

window.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.code === 'Space') {
    if (engine.phase === GAME_PHASES.PLAYING || engine.phase === GAME_PHASES.PAUSED) {
      e.preventDefault();
      ui.cb.onTogglePause();
      return;
    }
  }

  const dir = KEY_MAP[e.code] || KEY_MAP[e.key];
  if (dir) {
    e.preventDefault();
    engine.enqueueDirection(dir);
  }
});

// Mobile D-Pad Buttons
document.querySelectorAll('[data-snake-dir]').forEach(btn => {
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const dir = btn.getAttribute('data-snake-dir');
    if (dir) engine.enqueueDirection(dir);
  });
});

// Touch Swipe detection on Canvas
let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
}, { passive: true });

canvas.addEventListener('touchend', (e) => {
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (Math.max(absX, absY) > 24) {
    if (absX > absY) {
      engine.enqueueDirection(dx > 0 ? 'right' : 'left');
    } else {
      engine.enqueueDirection(dy > 0 ? 'down' : 'up');
    }
  }
}, { passive: true });

// ── Bootstrapping ───────────────────────────────────────────────────────────
async function boot() {
  fitCanvas();

  // Pre-fetch real shelter pets
  try {
    await pets.fetchPets();
  } catch (e) {}

  // Show title screen immediately — never block UI on network
  ui.showTitleScreen({
    bestScore: localStorage.getItem('petSnakeBestScore') || 0,
    bestFloor: localStorage.getItem('petSnakeBestFloor') || 1,
    coins: arcade.localCoins()
  });

  // Warm up session & stream cloud save in background
  arcade.ensureSession().then(() => arcade.loadCloudSave()).then(cloud => {
    if (cloud) {
      if (cloud.best) localStorage.setItem('petSnakeBestScore', String(cloud.best));
      if (cloud.bestFloor) localStorage.setItem('petSnakeBestFloor', String(cloud.bestFloor));
    }
  }).catch(() => {});

  // RAF Loop
  let lastTime = performance.now();

  function loop(now) {
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    engine.update(dt);
    const snapshot = engine.getRenderSnapshot(1.0);
    renderer.render(snapshot, dt);

    if (engine.phase === GAME_PHASES.PLAYING || engine.phase === GAME_PHASES.PAUSED) {
      ui.updateHUD(snapshot, engine.coinsEarned);
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

boot();
