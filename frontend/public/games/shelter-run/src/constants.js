/* ─── Shelter Run constants - native HD design (1280 × 720) ───────────────
   Mirrors found/src/constants.js's CFG convention: all gameplay values
   authored at HD, read by the level generator so difficulty stays
   consistent regardless of display scale. */

const CFG = {
  // Design reference only - actual canvas size is whatever the device
  // viewport provides (see main.js's Scale.RESIZE setup). Every on-screen
  // position below is expressed as a ratio of the ACTUAL width/height at
  // runtime (this.scale.width/height in each scene), not these numbers,
  // so the game fills a portrait phone instead of letterboxing to a fixed
  // 16:9 box. Kept here only as the baseline these ratios were tuned against.
  WIDTH:  1280,
  HEIGHT: 720,

  // Side-view runner (matching the reused side-profile cat sprite) - the
  // player stays at a fixed screen X while the world scrolls under it.
  // "Lanes" in the Temple-Run sense don't translate to a side-view sprite
  // (that needs a forward-facing or top-down view), so left/right input is
  // a quick sidestep DODGE with a brief invulnerability window instead of
  // a literal lane change - still 3 distinct evasion inputs (jump/duck/dodge)
  // matching the genre's feel without a geometry that fights the art.
  PLAYER_X_RATIO: 300 / 1280,
  DODGE_DURATION_MS: 320,
  DODGE_INVULN_MS: 260,

  GROUND_Y_RATIO: 560 / 720,

  // Core run physics
  BASE_SCROLL_SPEED: 420,     // px/sec at distance 0
  MAX_SCROLL_SPEED:  760,     // px/sec cap, reached ~3000m
  SPEED_RAMP_PER_M:  0.115,   // scroll speed gain per meter travelled
  JUMP_VELOCITY: -820,
  GRAVITY: 2200,
  DUCK_SCALE_Y: 0.55,         // squash factor while ducking (no dedicated art)

  // World-space distance -> on-screen "meters" shown to the player.
  // 1 world-meter = 40px of scroll travel, tuned so milestones (500/1500/3000)
  // land at readable, not-too-quick, not-too-slow run lengths.
  PX_PER_METER: 40,

  // Cat sprite - reused from found/assets/cat-sheet.png (32px frames),
  // same 2x HD upscale technique as found/src/graphics.js.
  CAT_TEXTURE_KEY:   'sr-cat-hd',
  CAT_FRAME_PX:      32,
  CAT_HD_MUL:        2,
  CAT_TEXTURE_FRAME: 64,
  CAT_SCALE: 2.1,
  CAT_BODY_W: 44,
  CAT_BODY_H: 52,
  CAT_BODY_OFFSET_X: 10,
  CAT_BODY_OFFSET_Y: 12,

  // Obstacle/collectible spawn geometry (world-space, scrolls right-to-left)
  SPAWN_X: 1400,
  DESPAWN_X: -200,
  MIN_SPAWN_GAP_PX: 480,     // minimum distance between spawn points
  REACTION_GAP_PX: 620,      // minimum gap after a full-width obstacle

  // Difficulty scaling: obstacle density increases with distance (meters)
  DIFFICULTY_BANDS: [
    { minMeters: 0,    spawnGapMul: 1.35, fullWidthChance: 0.10 },
    { minMeters: 250,  spawnGapMul: 1.15, fullWidthChance: 0.16 },
    { minMeters: 600,  spawnGapMul: 1.00, fullWidthChance: 0.22 },
    { minMeters: 1200, spawnGapMul: 0.88, fullWidthChance: 0.28 },
    { minMeters: 2000, spawnGapMul: 0.78, fullWidthChance: 0.34 },
    { minMeters: 3000, spawnGapMul: 0.70, fullWidthChance: 0.38 },
  ],

  // Distance milestones -> pack rewards, claimed via the shared
  // rewards/claim endpoint (see dex-integration.js). Same tier shape as
  // match.js's LEVEL_MILESTONES.
  DISTANCE_MILESTONES: {
    500:  { tier: 'standard', rewardKey: 'distance_500' },
    1500: { tier: 'duo',      rewardKey: 'distance_1500' },
    3000: { tier: 'deluxe',   rewardKey: 'distance_3000' },
  },

  // Companion tint colors - same badgeColor values as
  // packages/reference-game/src/game.ts:47-50 (Flappy Cat), applied via
  // Phaser sprite.setTint() over the shared cat-sheet rather than 4
  // separately-drawn sprite sheets.
  COMPANIONS: [
    { id: 'smokey',    name: 'Smokey',    breed: 'Silver Tabby',      tint: 0x4f7285 },
    { id: 'marmalade', name: 'Marmalade', breed: 'Ginger Tabby',      tint: 0xd46f17 },
    { id: 'patches',   name: 'Patches',   breed: 'Calico Sweetheart', tint: 0xb85d30 },
    { id: 'oreo',      name: 'Oreo',      breed: 'Tuxedo Acrobat',    tint: 0x2f3b4c },
  ],
};

const ANIMS = {
  IDLE: { key: 'sr-idle', start: 0,  end: 3,  frameRate: 8,  repeat: -1 },
  JUMP: { key: 'sr-jump', start: 16, end: 19, frameRate: 14, repeat: 0 },
  RUN:  { key: 'sr-run',  start: 40, end: 47, frameRate: 14, repeat: -1 },
};
