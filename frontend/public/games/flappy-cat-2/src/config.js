// Flappy Cat 2 — tuning + asset manifest. Logical playfield is 432x768 (2:3 portrait).
export const VIEW = { W: 432, H: 768, GROUND: 84 };

export const PHYS = {
  gravity: 2100,
  flapVy: -620,
  maxFall: 980,
  catX: 120,
  catR: 30,
  pipeW: 96,
  gapBase: 235,
  gapMin: 185,
  speedBase: 165,
  speedMax: 275,
  spawnEvery: 1.45,
};

// Score-gated biome sets — same thresholds the v1 variant swapper used.
export const BIOMES = [
  { min: 0,  id: 'grass', sky: ['#71c5cf', '#bfeef2'], ground: '#5fae67', dirt: '#8a6f4d', label: 'Day' },
  { min: 8,  id: 'dirt',  sky: ['#e8a05c', '#f7d9a0'], ground: '#9c7b52', dirt: '#6e5638', label: 'Golden hour' },
  { min: 15, id: 'snow',  sky: ['#8d7fc9', '#e8d5f2'], ground: '#cfe3ee', dirt: '#7d94a8', label: 'Dusk snow' },
  { min: 25, id: 'ice',   sky: ['#1c2a4a', '#4a5f8f'], ground: '#9fd4e8', dirt: '#3d5a78', label: 'Night ice' },
];

// Server REWARD_TABLE for game_id flappy_cat — client only sends reward_key.
export const MILESTONES = [
  { key: 'score_5',  at: 5,  label: 'First flight' },
  { key: 'score_10', at: 10, label: 'Getting the hang of it' },
  { key: 'score_15', at: 15, label: 'Alley ace' },
  { key: 'score_25', at: 25, label: 'Sky prowler' },
  { key: 'score_30', at: 30, label: 'Cloud chaser' },
  { key: 'score_50', at: 50, label: 'Legend of the cattery' },
];

export const MEDALS = [
  { min: 40, img: 'ui/medalGold.png',   label: 'Gold' },
  { min: 30, img: 'ui/medalSilver.png', label: 'Silver' },
  { min: 10, img: 'ui/medalBronze.png', label: 'Bronze' },
];

// Cat run-cycle sheets: 960x140 = 6 frames of 160x140. Mascot seed mirrors v1.
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
  rocks: [
    'rock_top.png','rock_bottom.png','rock_top_dirt.png','rock_bottom_dirt.png',
    'rock_top_ice.png','rock_bottom_ice.png','rock_top_snow.png','rock_bottom_snow.png',
  ],
  ui: ['ui/UIbg.png','ui/buttonLarge.png','ui/medalBronze.png','ui/medalGold.png','ui/medalSilver.png',
       'ui/tap.png','ui/tapTick.png','ui/textGameOver.png','ui/textGetReady.png'],
  numbers: Array.from({ length: 10 }, (_, i) => `numbers/number${i}.png`),
};

export const SAVE_SLOT = 'default';
export const SCHEMA_VERSION = 1;
export const GAME_ID = 'flappy_cat';
