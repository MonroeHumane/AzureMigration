/* ─── Phaser game bootstrap - responsive sizing ─────────────────────────────
   Scale.FIT with a fixed 1280x720 box (found's original pattern) letterboxes
   badly on portrait phones - only a ~375x211 strip renders inside a 375x812
   viewport, wasting ~74% of the screen. Instead the game world is sized to
   match the actual container on every device (Scale.RESIZE), and gameplay
   code reads this.scale.width/height + CFG's *_RATIO constants at runtime
   instead of the fixed design constants - see constants.js, GameScene.js,
   Player.js, TouchControls.js, and the menu/result scenes. */

const srContainer = document.getElementById('game-container');

function srMeasureContainer() {
  const w = srContainer.clientWidth || window.innerWidth;
  const h = srContainer.clientHeight || window.innerHeight;
  return { w, h };
}

const srInitialSize = srMeasureContainer();

const __srGame = new Phaser.Game({
  type:   Phaser.AUTO,
  width:  srInitialSize.w,
  height: srInitialSize.h,
  parent: 'game-container',
  resolution: Math.max(1, Math.min(3, window.devicePixelRatio || 1)),

  backgroundColor: '#1a1a2e',

  render: {
    pixelArt:        false,
    antialias:       true,
    roundPixels:     true,
    powerPreference: 'high-performance',
  },

  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 }, // per-sprite gravity set individually (see Player.js)
      debug:   false,
    },
  },

  scale: {
    mode:       Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width:      srInitialSize.w,
    height:     srInitialSize.h,
  },

  scene: [
    BootScene,
    MainMenuScene,
    GameScene,
    RoundOverScene,
  ],
});

// Scale.RESIZE's own ResizeObserver-driven sizing has already bitten us once
// in Flappy Cat this session (its first delivery can be deferred or missed
// entirely depending on when the observer attaches relative to the host
// settling the iframe's layout) - so don't rely on it alone. Explicitly
// re-measure and push the size on window resize/orientation change too.
function srApplyResize() {
  const { w, h } = srMeasureContainer();
  if (w > 0 && h > 0) {
    __srGame.scale.resize(w, h);
  }
}
window.addEventListener('resize', srApplyResize);
window.addEventListener('orientationchange', srApplyResize);
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(srApplyResize).observe(srContainer);
}
// this.scale isn't usable until Phaser's own boot sequence completes
// (calling resize() any earlier throws - the ScaleManager's internal
// state isn't set up yet), so the one-shot "re-assert current size" call
// waits for 'ready' rather than running synchronously right after
// construction like the window/ResizeObserver listeners above.
__srGame.events.once('ready', srApplyResize);

window.__srGame = __srGame;
