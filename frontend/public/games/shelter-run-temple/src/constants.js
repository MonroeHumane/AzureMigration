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
  /** Distance meters between biome/time-of-day shifts (cycles). */
  BIOME_METERS: 420,
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
  /** Fallback palette (day). Prefer CFG.BIOMES[i].colors via Perspective.activeColors. */
  COLORS: Object.freeze({
    skyTop: '#0a1f2e', skyMid: '#163a4a', skyBottom: '#2a5a4a',
    trackDark: '#1a2e28', trackLight: '#243a32',
    laneDiv: 0x6bc4a6, trackEdge: 0xffb347,
    wall: 0xd9534f, low: 0xe67e22, high: 0xf0ad4e, collect: 0xffd166,
  }),
  /**
   * Time-of-day / biome palettes — cycled by distance (BIOME_METERS).
   * rockKey maps to BootScene Kenney CC0 textures (optional visual only).
   */
  BIOMES: Object.freeze([
    Object.freeze({
      id: 'dawn', label: 'Dawn',
      colors: Object.freeze({
        skyTop: '#1a1030', skyMid: '#c45c3a', skyBottom: '#f0a060',
        trackDark: '#2a3428', trackLight: '#3a4836',
        laneDiv: 0xe8a060, trackEdge: 0xffc878,
        wall: 0xc45c48, low: 0xd47840, high: 0xe8b060, collect: 0xffe08a,
        haze: 0xffb080, particle: 0xffd4a0,
      }),
      rockKey: 'sr-rock-grass', camBg: '#1a1030',
    }),
    Object.freeze({
      id: 'day', label: 'Day',
      colors: Object.freeze({
        skyTop: '#1a4a6e', skyMid: '#3a7ca8', skyBottom: '#7ec8a0',
        trackDark: '#1a2e28', trackLight: '#243a32',
        laneDiv: 0x6bc4a6, trackEdge: 0xffb347,
        wall: 0xd9534f, low: 0xe67e22, high: 0xf0ad4e, collect: 0xffd166,
        haze: 0x6bc4a6, particle: 0xd4c4a0,
      }),
      rockKey: 'sr-rock', camBg: '#1a4a6e',
    }),
    Object.freeze({
      id: 'dusk', label: 'Dusk',
      colors: Object.freeze({
        skyTop: '#1a1238', skyMid: '#6a2860', skyBottom: '#e07040',
        trackDark: '#241e2a', trackLight: '#322830',
        laneDiv: 0xd080a0, trackEdge: 0xff9060,
        wall: 0xb84860, low: 0xd06840, high: 0xe89850, collect: 0xffc070,
        haze: 0xe07080, particle: 0xffa070,
      }),
      rockKey: 'sr-rock', camBg: '#1a1238',
    }),
    Object.freeze({
      id: 'night', label: 'Night',
      colors: Object.freeze({
        skyTop: '#050818', skyMid: '#0c1838', skyBottom: '#1a2850',
        trackDark: '#121820', trackLight: '#1a2430',
        laneDiv: 0x5080c0, trackEdge: 0x70a0e0,
        wall: 0x6a7088, low: 0x8898b0, high: 0xa0b8d8, collect: 0xc0e0ff,
        haze: 0x4060a0, particle: 0xa0c0ff,
      }),
      rockKey: 'sr-rock-ice', camBg: '#050818',
    }),
  ]),
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

/** Shape/tint variant indices used by Perspective.drawObstacle. */
const SR_OBS_VARIANTS = Object.freeze({
  lane_block: Object.freeze([0, 1, 2]), // pillar / boulder / crate
  low: Object.freeze([0, 1, 2]),        // curb / log / mound
  high: Object.freeze([0, 1, 2]),       // bar / vines / banners
});

function srBiomeAtMeters(meters) {
  var list = CFG.BIOMES;
  var idx = Math.floor(Math.max(0, meters) / CFG.BIOME_METERS) % list.length;
  return list[idx];
}
