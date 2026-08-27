/* eslint-disable no-var */
var __shelterPitGame = new Phaser.Game({
  type: Phaser.AUTO,
  width: CFG.WIDTH,
  height: CFG.HEIGHT,
  parent: 'game-container',
  resolution: Math.max(1, Math.min(2, Math.floor(window.devicePixelRatio || 1))),
  backgroundColor: '#0b1220',
  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    powerPreference: 'high-performance',
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: CFG.WIDTH,
    height: CFG.HEIGHT,
  },
  scene: [
    BootScene,
    MainMenuScene,
    VolunteerSelectScene,
    RunScene,
    DraftScene,
    EnrichmentScene,
    CampusScene,
    HarvestScene,
    ShiftCompleteScene,
  ],
});

if (new URLSearchParams(window.location.search).get('dev') === '1') {
  window.__shelterPitGame = __shelterPitGame;
}
