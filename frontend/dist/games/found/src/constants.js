/* ─── Physics constants - native HD design (1280 × 720) ─────────────────────
   All gameplay values are authored at HD. Level generator and playability
   tests read from CFG, so physics stay consistent.                         */

/** @deprecated Legacy SD width; used only to scale UI font strings. */
const FOUND_SD_WIDTH = 800;
const FOUND_LEVEL_COUNT = 24;
const FOUND_LEVELS_PER_ACT = 4;

function foundGetLevelCount() {
  return FOUND_LEVEL_COUNT;
}

function foundGetLevelsPerAct() {
  return FOUND_LEVELS_PER_ACT;
}

function foundGetActCount() {
  return Math.ceil(FOUND_LEVEL_COUNT / FOUND_LEVELS_PER_ACT);
}

function foundGetActForLevel(levelNum) {
  const safe = Math.max(1, Math.min(FOUND_LEVEL_COUNT, Number(levelNum) || 1));
  return Math.ceil(safe / FOUND_LEVELS_PER_ACT);
}

const CFG = {
  // Native canvas (16∶9 HD - do not upscale beyond this in CSS)
  WIDTH:  1280,
  HEIGHT: 720,

  // Core physics (scaled from former 800×450 design ×1.6)
  WALK_SPEED:    320,
  JUMP_VELOCITY: 640,
  GRAVITY:       1280,

  // Level geometry
  GROUND_Y:         608,
  MIN_PLATFORM_Y:   208,
  PLATFORM_HEIGHT:   26,
  PLATFORM_MIN_W:   144,
  PLATFORM_MAX_W:   320,
  WORLD_PADDING:    800,
  START_PLAT_W:     480,
  SHELTER_PLAT_W:   416,
  MIN_GAP:           64,

  IDLE_TIMEOUT_MS: 5000,

  DIFFICULTY: {
    1: 0.50,  2: 0.60,  3: 0.70,  4: 0.80,
    5: 0.86,  6: 0.92,  7: 0.98,  8: 1.04,
    9: 1.10, 10: 1.16, 11: 1.22, 12: 1.28,
   13: 1.32, 14: 1.36, 15: 1.40, 16: 1.44,
   17: 1.48, 18: 1.52, 19: 1.56, 20: 1.60,
   21: 1.62, 22: 1.64, 23: 1.66, 24: 1.68,
  },
  INTERIOR_PLATFORMS: {
    1: 6,  2: 7,  3: 8,  4: 9,
    5: 10, 6: 10, 7: 11, 8: 11,
    9: 12, 10: 12, 11: 13, 12: 13,
   13: 14, 14: 14, 15: 15, 16: 15,
   17: 16, 18: 16, 19: 17, 20: 17,
   21: 18, 22: 18, 23: 19, 24: 20,
  },

  // Cat - 2× source sheet → 64px frames; display scale tuned for 720p
  CAT_TEXTURE_KEY:   'cat-hd',
  CAT_FRAME_PX:      32,
  CAT_HD_MUL:        2,
  CAT_TEXTURE_FRAME: 64,   // HD sheet frame size (CAT_FRAME_PX × CAT_HD_MUL)
  CAT_SCALE:         2.35,
  CAT_SCENE_SCALE:   6.75,
  /* Hitbox in texture pixels - bottom of box aligns with frame bottom (feet) */
  CAT_BODY_W:        44,
  CAT_BODY_H:        52,
  CAT_BODY_OFFSET_X: 10,
  CAT_BODY_OFFSET_Y: 12,
  CAT_FOOT_OFFSET:   0,    // sprite origin is (0.5, 1) → position.y = feet

  COYOTE_MS:      120,
  JUMP_BUFFER_MS: 140,
  MAX_FALL_SPEED: 900,

  LEVEL_NAMES: {
    1: 'Quiet street',
    2: 'Backyard hop',
    3: 'Roofline run',
    4: 'Home stretch',
    5: 'Alley lessons',
    6: 'Porch patrol',
    7: 'Fence dash',
    8: 'Park bound',
    9: 'Skybridge',
   10: 'Courtyard chase',
   11: 'Delivery lane',
   12: 'Crosswind',
   13: 'Lantern row',
   14: 'Garden maze',
   15: 'Service road',
   16: 'Rooftop relay',
   17: 'Rail run',
   18: 'Market block',
   19: 'Storm drain',
   20: 'Midnight sprint',
   21: 'Signal tower',
   22: 'Overpass',
   23: 'Shelter beacon',
   24: 'Safe harbor',
  },
  ACT_NAMES: {
    1: 'First Steps',
    2: 'Neighborhood Watch',
    3: 'Across Town',
    4: 'Dusk Patrol',
    5: 'Night Run',
    6: 'Final Push',
  },
  ACT_PLATFORM_THEMES: {
    1: { color: 'green',  variants: [1, 2, 3, 4, 5, 6] },
    2: { color: 'green',  variants: [7, 8, 9, 10, 11, 12] },
    3: { color: 'brown',  variants: [1, 2, 3, 4, 5, 6] },
    4: { color: 'brown',  variants: [7, 8, 9, 10, 11, 12] },
    5: { color: 'blue',   variants: [1, 2, 3, 4, 5, 6, 7, 8] },
    6: { color: 'yellow', variants: [1, 2, 3, 4, 5, 6, 7, 8] },
  },
  // Graphics-based platform colors (body / top-stripe / shadow, per act)
  ACT_PLATFORM_COLORS: {
    1: { body: 0x5a8a3c, top: 0x7ec84a, shadow: 0x2a4a1c, topH: 5 }, // fresh grass
    2: { body: 0x4a7a30, top: 0x68b040, shadow: 0x263c18, topH: 5 }, // deep forest
    3: { body: 0x906040, top: 0xc88050, shadow: 0x4a2c14, topH: 5 }, // terracotta brick
    4: { body: 0x806858, top: 0xb09878, shadow: 0x3c2c1c, topH: 5 }, // worn stone
    5: { body: 0x2c3c6c, top: 0x4c6cb0, shadow: 0x141c38, topH: 5 }, // night blue
    6: { body: 0x9a8030, top: 0xd4b040, shadow: 0x4c3c10, topH: 5 }, // golden sunrise
  },
  POWERUP_RULES: {
    2: { budget: 1, types: ['shield'] },
    3: { budget: 1, types: ['speed'] },
    4: { budget: 1, types: ['shield', 'jump'] },
    5: { budget: 1, types: ['shield', 'speed'] },
    6: { budget: 2, types: ['shield', 'speed'] },
    7: { budget: 2, types: ['speed', 'jump'] },
    8: { budget: 2, types: ['shield', 'speed'] },
    9: { budget: 2, types: ['jump', 'speed'] },
   10: { budget: 2, types: ['speed', 'jump'] },
   11: { budget: 2, types: ['shield', 'jump'] },
   12: { budget: 2, types: ['shield', 'speed', 'jump'] },
   13: { budget: 2, types: ['shield', 'speed'] },
   14: { budget: 2, types: ['shield', 'jump'] },
   15: { budget: 3, types: ['speed', 'jump'] },
   16: { budget: 3, types: ['shield', 'speed', 'jump'] },
   17: { budget: 2, types: ['shield', 'speed'] },
   18: { budget: 2, types: ['shield', 'jump'] },
   19: { budget: 3, types: ['speed', 'jump'] },
   20: { budget: 3, types: ['shield', 'speed', 'jump'] },
   21: { budget: 2, types: ['shield'] },
   22: { budget: 2, types: ['jump'] },
   23: { budget: 2, types: ['speed'] },
   24: { budget: 3, types: ['shield', 'speed', 'jump'] },
  },
  ENEMY_RULES: {
    5: { budget: 1, types: ['walker'] },
    6: { budget: 1, types: ['walker'] },
    7: { budget: 1, types: ['spikey'] },
    8: { budget: 2, types: ['walker', 'spikey'] },
    9: { budget: 1, types: ['floater'] },
   10: { budget: 2, types: ['walker', 'floater'] },
   11: { budget: 2, types: ['spikey', 'floater'] },
   12: { budget: 2, types: ['walker', 'spikey', 'floater'] },
   13: { budget: 2, types: ['walker', 'flyer'] },
   14: { budget: 2, types: ['spikey', 'flyer'] },
   15: { budget: 3, types: ['walker', 'floater', 'flyer'] },
   16: { budget: 3, types: ['walker', 'spikey', 'flyer'] },
   17: { budget: 3, types: ['walker', 'spikey', 'floater'] },
   18: { budget: 3, types: ['walker', 'spikey', 'flyer'] },
   19: { budget: 4, types: ['walker', 'spikey', 'floater'] },
   20: { budget: 4, types: ['walker', 'spikey', 'flyer'] },
   21: { budget: 4, types: ['walker', 'spikey', 'floater', 'flyer'] },
   22: { budget: 4, types: ['walker', 'spikey', 'flyer'] },
   23: { budget: 5, types: ['walker', 'spikey', 'floater', 'flyer'] },
   24: { budget: 5, types: ['walker', 'spikey', 'floater', 'flyer'] },
  },
};

CFG.CAT_FOOT_WORLD = CFG.CAT_FOOT_OFFSET * CFG.CAT_SCALE;
CFG.CAT_HALF_WIDTH_WORLD = (CFG.CAT_BODY_W * CFG.CAT_SCALE) * 0.5;

CFG.T_AIR = (2 * CFG.JUMP_VELOCITY) / CFG.GRAVITY;
CFG.H_MAX = (CFG.JUMP_VELOCITY ** 2) / (2 * CFG.GRAVITY);
CFG.D_MAX = CFG.WALK_SPEED * CFG.T_AIR;

const ANIMS = {
  IDLE_1:  { key: 'idle_1',  start:  0, end:  3, frameRate:  8, repeat: -1 },
  IDLE_2:  { key: 'idle_2',  start:  8, end: 11, frameRate:  8, repeat: -1 },
  JUMP:    { key: 'jump',    start: 16, end: 19, frameRate: 12, repeat:  0 },
  SCARED:  { key: 'scared',  start: 24, end: 27, frameRate: 10, repeat:  0 },
  WALK:    { key: 'walk',    start: 32, end: 39, frameRate: 10, repeat: -1 },
  RUN:     { key: 'run',     start: 40, end: 47, frameRate: 12, repeat: -1 },
  SLEEP:   { key: 'sleep',   start: 48, end: 51, frameRate:  6, repeat: -1 },
  PAW:     { key: 'paw',     start: 56, end: 60, frameRate: 10, repeat:  0 },
  CLEAN_1: { key: 'clean_1', start: 64, end: 67, frameRate:  8, repeat:  0 },
  CLEAN_2: { key: 'clean_2', start: 72, end: 79, frameRate:  8, repeat: -1 },
};
