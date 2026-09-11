/* ─── Phaser bootstrap — portrait-first Scale.RESIZE, DPR capped ──────── */

const srContainer = document.getElementById('game-container');

function srMeasureContainer() {
  const w = srContainer.clientWidth || window.innerWidth;
  const h = srContainer.clientHeight || window.innerHeight;
  return { w, h };
}

const srInitialSize = srMeasureContainer();

const __srGame = new Phaser.Game({
  type: Phaser.AUTO,
  width: srInitialSize.w,
  height: srInitialSize.h,
  parent: 'game-container',
  resolution: Math.max(1, Math.min(2, window.devicePixelRatio || 1)),
  backgroundColor: '#0a1f2e',
  render: {
    pixelArt: false,
    antialias: true,
    roundPixels: true,
    powerPreference: 'high-performance',
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: srInitialSize.w,
    height: srInitialSize.h,
  },
  scene: [BootScene, MainMenuScene, GameScene, RoundOverScene],
});

function srApplyResize() {
  const { w, h } = srMeasureContainer();
  if (w > 0 && h > 0) __srGame.scale.resize(w, h);
}
window.addEventListener('resize', srApplyResize);
window.addEventListener('orientationchange', srApplyResize);
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(srApplyResize).observe(srContainer);
}
__srGame.events.once('ready', srApplyResize);
window.__srGame = __srGame;

// Arcade light/dark. The temple trail keeps its art — GameScene paints its own
// sky over this — but the bare canvas fill shows through on the boot and menu
// screens, so it has to follow the cabinet instead of staying night-navy.
const SR_CANVAS_BG = { dark: '#0a1f2e', light: '#dbe6e2' };
let srTheme = 'dark';

function srApplyTheme(theme) {
  if (theme === 'light' || theme === 'dark') srTheme = theme;
  const hex = SR_CANVAS_BG[srTheme];
  try {
    if (__srGame.canvas) __srGame.canvas.style.backgroundColor = hex;
    __srGame.scene.scenes.forEach((scene) => {
      scene.cameras?.main?.setBackgroundColor(hex);
    });
  } catch (e) {
    /* ignore */
  }
}

window.addEventListener('humane-games-theme', (e) => srApplyTheme(e?.detail?.theme));
__srGame.events.on('ready', () => srApplyTheme());
srApplyTheme(window.HumaneGamesTheme?.get?.());
