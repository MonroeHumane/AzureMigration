/* ─── Shelter Run Temple – pseudo-3D chase constants ─────────────────────
   Parallel remake under shelter-run-temple/ (brief §5). GameHelix-style
   projection patterns only — no licensed assets. Portrait logical 480×800. */

const CFG = {
  WIDTH: 480,
  HEIGHT: 800,
  HORIZON_Y_RATIO: 0.32,
  PLAYER_SCREEN_Y_RATIO: 0.88,
  FOCAL: 444,
  CAMERA_HEIGHT: 200,
  PLAYER_Z: 200,
  LANE_WORLD_X: Object.freeze([-72, 0, 72]),
  TRACK_HALF_W: 160,
  FAR_Z: 2200,
  NEAR_Z: 80,
  SPAWN_Z: 1950,
  INITIAL_SPEED: 7.2,
  MAX_SPEED: 24,
  SPEED_INCREASE: 0.0020,
  DIST_SCALE: 0.0072,
  INITIAL_LIVES: 2,
  INVINCIBLE_MS: 1500,
  JUMP_HEIGHT: 130,
  JUMP_MS: 560,
  SLIDE_MS: 480,
  LANE_CHANGE_MS: 140,
  PLAYER_WORLD_HEIGHT: 160,
  WALL_HEIGHT: 220,
  LOW_WALL_HEIGHT: 95,
  HIGH_BAR_BOTTOM: 95,
  HIGH_BAR_THICKNESS: 42,
  MIN_GAP: Object.freeze({ easy: 640, medium: 430, hard: 290 }),
  REACTION_GAP: 220,
  DIFFICULTY_BANDS: Object.freeze([
    { minMeters: 0, key: 'easy' },
    { minMeters: 350, key: 'medium' },
    { minMeters: 1100, key: 'hard' },
  ]),
  COLLECTIBLE_CHANCE: 0.18,
  COLLECT_LINE_CHANCE: 0.08,
  COLLECT_LINE_COUNT: 4,
  COLLECT_LINE_SPACING: 85,
  CAT_TEXTURE_KEY: 'sr-cat-hd',
  CAT_FRAME_PX: 32,
  CAT_HD_MUL: 2,
  CAT_TEXTURE_FRAME: 64,
  CAT_SCALE: 2.0,
  DISTANCE_MILESTONES: {
    500:  { tier: 'standard', rewardKey: 'distance_500' },
    1500: { tier: 'duo',      rewardKey: 'distance_1500' },
    3000: { tier: 'deluxe',   rewardKey: 'distance_3000' },
  },
  COMPANIONS: [
    { id: 'smokey',    name: 'Smokey',    breed: 'Silver Tabby',      tint: 0x4f7285 },
    { id: 'marmalade', name: 'Marmalade', breed: 'Ginger Tabby',      tint: 0xd46f17 },
    { id: 'patches',   name: 'Patches',   breed: 'Calico Sweetheart', tint: 0xb85d30 },
    { id: 'oreo',      name: 'Oreo',      breed: 'Tuxedo Acrobat',    tint: 0x2f3b4c },
  ],
  COLORS: Object.freeze({
    skyTop: '#0a1f2e', skyMid: '#163a4a', skyBottom: '#2a5a4a',
    trackDark: '#1a2e28', trackLight: '#243a32',
    laneDiv: 0x6bc4a6, trackEdge: 0xffb347,
    wall: 0xd9534f, low: 0xe67e22, high: 0xf0ad4e, collect: 0xffd166,
  }),
};

const ANIMS = {
  IDLE: { key: 'srt-idle', start: 0,  end: 3,  frameRate: 8,  repeat: -1 },
  JUMP: { key: 'srt-jump', start: 16, end: 19, frameRate: 14, repeat: 0 },
  RUN:  { key: 'srt-run',  start: 40, end: 47, frameRate: 14, repeat: -1 },
};

const SR_OBSTACLE_TYPES = Object.freeze({
  LANE_BLOCK: 'lane_block',
  LOW: 'low',
  HIGH: 'high',
});
