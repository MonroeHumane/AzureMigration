/* ─── Phaser game bootstrap - native 1280×720 HD ──────────────────────────── */

const __foundGame = new Phaser.Game({
  type:   Phaser.AUTO,
  width:  CFG.WIDTH,
  height: CFG.HEIGHT,
  parent: 'game-container',
  // HiDPI internal buffer - sharp UI/background; cat sheet keeps NEAREST in BootScene.
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
      gravity: { y: CFG.GRAVITY },
      debug:   false,
    },
  },

  scale: {
    mode:       Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width:      CFG.WIDTH,
    height:     CFG.HEIGHT,
  },

  scene: [
    BootScene,
    MainMenuScene,
    GameScene,
    RoundOverScene,
    LevelCompleteScene,
  ],
});

if (new URLSearchParams(window.location.search).get('dev') === '1') {
  window.__foundGame = __foundGame;
}

window.addEventListener('blur', () => {
  if (typeof FoundAudio !== 'undefined' && FoundAudio.ctx) {
    FoundAudio.ctx.suspend().catch(() => {});
  }
});

window.addEventListener('focus', () => {
  if (typeof FoundAudio !== 'undefined' && FoundAudio.ctx) {
    FoundAudio.ctx.resume().catch(() => {});
  }
});
