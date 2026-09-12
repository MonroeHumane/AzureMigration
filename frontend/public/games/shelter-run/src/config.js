// Shelter Run — tuning + asset manifest. Logical playfield is 432x768 (2:3 portrait).
export const VIEW = { W: 432, H: 768 };

// Pseudo-3D projection constants (Temple Run-style chase camera).
export const PROJ = {
  horizonRatio: 0.30,     // horizon line as fraction of view height
  focal: 400,
  cameraHeight: 190,
  playerZ: 200,           // fixed depth of the runner ahead of the camera
  laneWorldX: [-78, 0, 78],
  trackHalfW: 150,
  farZ: 2400,             // draw distance
  spawnZ: 2000,           // obstacles materialize just inside farZ
};

export const PHYS = {
  speedBase: 7.0,         // world units per 60fps frame
  speedMax: 23,
  speedGain: 0.0021,      // per frame
  distScale: 0.009,       // world units -> meters
  jumpHeight: 135,        // world units
  jumpMs: 580,
  slideMs: 520,
  laneChangeMs: 150,
  hitWindowFront: 120,    // depth window around playerZ for collisions
  hitWindowBack: 90,
  collectWindow: 75,
  lowWallHeight: 95,      // jump must clear this
  highBarBottom: 95,      // slide must be under this
  lives: 2,
  invincibleMs: 1600,
};

// Distance-gated biomes — palettes harmonized with flappy-cat-2's set.
export const BIOMES = [
  {
    min: 0, id: 'grass', label: 'Morning Meadow',
    sky: ['#63b8d8', '#cdeef0'], sun: '#fff3c4',
    trackA: '#8a6f4d', trackB: '#7d6444', edge: '#5fae67', lane: '#e8d9b0',
    sideA: '#4e9e58', sideB: '#45915150', sideStrip: '#57b065',
    fog: 'rgba(205,238,240,0.55)', particle: '#e8d9b0', collect: '#ffd166',
  },
  {
    min: 500, id: 'dirt', label: 'Golden Hour',
    sky: ['#e8975a', '#f8dca0'], sun: '#ffe9a8',
    trackA: '#9c7b52', trackB: '#8d6d47', edge: '#b58a4a', lane: '#f0d9a8',
    sideA: '#a8845a', sideB: '#97754c', sideStrip: '#bb9260',
    fog: 'rgba(248,220,160,0.5)', particle: '#ffd4a0', collect: '#ffe08a',
  },
  {
    min: 1400, id: 'snow', label: 'Dusk Frost',
    sky: ['#8d7fc9', '#e8d5f2'], sun: '#f4e8ff',
    trackA: '#b8c9d6', trackB: '#a7bccb', edge: '#8fb6d0', lane: '#eef5fa',
    sideA: '#cfe3ee', sideB: '#bcd5e4', sideStrip: '#dcebf4',
    fog: 'rgba(232,213,242,0.5)', particle: '#e0ecf4', collect: '#ffd166',
  },
  {
    min: 2600, id: 'ice', label: 'Starlight Run',
    sky: ['#182646', '#3d5a78'], sun: '#cfe4ff',
    trackA: '#5b7a94', trackB: '#4e6b84', edge: '#7fb0d8', lane: '#bfe0f4',
    sideA: '#3d5a78', sideB: '#324f6c', sideStrip: '#4a6a8c',
    fog: 'rgba(61,90,120,0.55)', particle: '#a0c0ff', collect: '#c0e0ff',
  },
];
export const BIOME_CYCLE_RESET = 4200; // meters; wraps back to grass

// Server REWARD_TABLE for game_id shelter_run — client only sends reward_key.
export const MILESTONES = [
  { key: 'distance_500',  at: 500,  label: 'Trail Blazer',   tier: 'standard' },
  { key: 'distance_1500', at: 1500, label: 'Rescue Ranger',  tier: 'standard' },
  { key: 'distance_3000', at: 3000, label: 'Marathon Meow',  tier: 'duo' },
];

export const MEDALS = [
  { min: 3000, img: 'ui/medalGold.png',   label: 'Gold' },
  { min: 1500, img: 'ui/medalSilver.png', label: 'Silver' },
  { min: 500,  img: 'ui/medalBronze.png', label: 'Bronze' },
];

// Cat run-cycle sheets: 960x140 = 6 frames of 160x140 (shared with flappy-cat-2).
export const CATS = [
  { id: 'calico', name: 'Calico',    sheet: 'cat_calico.png',            frames: 6, fw: 160, fh: 140 },
  { id: 'ginger', name: 'Marmalade', sheet: 'cat_ginger.png',            frames: 6, fw: 160, fh: 140 },
  { id: 'tuxedo', name: 'Tuxedo',    sheet: 'cat_tuxedo.png',            frames: 6, fw: 160, fh: 140 },
  { id: 'tabby',  name: 'Smokey',    sheet: 'remastered_grey_tabby.png', frames: 6, fw: 160, fh: 140 },
];
export const MASCOT_TO_CAT = { smokey: 'tabby', marmalade: 'ginger' };
// Frames 3-5 had chopped edge art repaired by shifting content left inside
// the cell; sample that many px earlier so the sprite lands identically.
export const FRAME_SHIFT = { 3: 6, 4: 6, 5: 6 };

export const IMAGES = {
  cats: CATS.map(c => c.sheet),
  decor: ['cloud1.png','cloud2.png','cloud3.png','cloud4.png','cloud5.png','cloud6.png',
          'house1.png','houseSmall1.png','tree.png','sun.png','star.png','puff.png'],
  rocks: ['rock.png', 'rockGrass.png', 'rockIce.png', 'rockSnow.png'],
  ui: ['ui/medalBronze.png','ui/medalGold.png','ui/medalSilver.png',
       'ui/tap.png','ui/textGameOver.png','ui/textGetReady.png'],
  numbers: Array.from({ length: 10 }, (_, i) => `numbers/number${i}.png`),
};

export const OBSTACLE = { LANE_BLOCK: 'lane_block', LOW: 'low', HIGH: 'high' };

export const SAVE_SLOT = 'default';
export const SCHEMA_VERSION = 1;
export const GAME_ID = 'shelter_run';
