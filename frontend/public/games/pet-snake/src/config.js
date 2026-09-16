// Pet Snake Adventure — Configuration & System Tables
// Logical playfield coordinate system (640x640 square, crisp scaling on mobile & desktop).

export const GAME_ID = 'petsnake';
export const SAVE_SLOT = 'snake_adv';
export const SCHEMA_VERSION = 1;

export const VIEW = {
  W: 640,
  H: 640,
};

export const BOARD_SIZES = {
  cozy: 15,
  roomy: 19,
  grand: 23,
};

export const DIFFICULTIES = {
  chill: { key: 'chill', label: 'Chill', tick: 210, graceMs: 2500, obstacleDensity: 0.02 },
  normal: { key: 'normal', label: 'Normal', tick: 175, graceMs: 2000, obstacleDensity: 0.04 },
  spicy: { key: 'spicy', label: 'Spicy', tick: 135, graceMs: 1500, obstacleDensity: 0.07 },
  superSpicy: { key: 'superSpicy', label: 'Super Spicy', tick: 105, graceMs: 1000, obstacleDensity: 0.12 },
};

export const STARTING_MODIFIERS = [
  {
    key: 'normal',
    name: 'Normal Adventure',
    pill: 'Standard',
    desc: 'Standard run with 3 hearts and balanced hazards.',
    hearts: 3,
    coinMultiplier: 1.0,
    scoreMultiplier: 1.0,
    tickScalar: 1.0,
    extraUpgrades: 0,
    treatValue: 1.0,
    treatSpawnRate: 1.0,
    enemySpawnRate: 1.0,
    bombImmunity: false,
  },
  {
    key: 'fragile',
    name: 'Fragile Start',
    pill: '1 Heart · 2x Coins',
    desc: 'Glass cannon: start with only 1 heart, but earn 2x coins and 1.5x score.',
    hearts: 1,
    coinMultiplier: 2.0,
    scoreMultiplier: 1.5,
    tickScalar: 1.0,
    extraUpgrades: 0,
    treatValue: 1.0,
    treatSpawnRate: 1.0,
    enemySpawnRate: 1.0,
    bombImmunity: false,
  },
  {
    key: 'speedDemon',
    name: 'Speed Demon',
    pill: '+30% Speed · +1 Draft',
    desc: 'Everything moves 30% faster; draft 1 extra upgrade choice after each floor.',
    hearts: 3,
    coinMultiplier: 1.25,
    scoreMultiplier: 1.3,
    tickScalar: 0.72,
    extraUpgrades: 1,
    treatValue: 1.0,
    treatSpawnRate: 1.0,
    enemySpawnRate: 1.0,
    bombImmunity: false,
  },
  {
    key: 'enemySwarm',
    name: 'Vacuum Swarm',
    pill: 'Frenzy · Bomb Immune',
    desc: 'Vacuums are faster and pursue relentlessly, but you gain permanent bomb immunity.',
    hearts: 3,
    coinMultiplier: 1.5,
    scoreMultiplier: 1.2,
    tickScalar: 1.0,
    extraUpgrades: 0,
    treatValue: 1.0,
    treatSpawnRate: 1.0,
    enemySpawnRate: 1.5,
    bombImmunity: true,
  },
  {
    key: 'resourceScarce',
    name: 'Scarcity Hunter',
    pill: 'Rare Snacks · Double Value',
    desc: 'Treats spawn 40% less frequently, but each treat is worth double score and coins.',
    hearts: 3,
    coinMultiplier: 1.5,
    scoreMultiplier: 1.5,
    tickScalar: 1.0,
    extraUpgrades: 0,
    treatValue: 2.0,
    treatSpawnRate: 0.6,
    enemySpawnRate: 1.0,
    bombImmunity: false,
  }
];

export const TREAT_TYPES = {
  fish: { key: 'fish', label: 'Fish Nibble', icon: '🐟', score: 1, color: '#38bdf8' },
  bone: { key: 'bone', label: 'Crunchy Bone', icon: '🦴', score: 2, color: '#fef08a' },
  biscuit: { key: 'biscuit', label: 'Peanut Biscuit', icon: '🍪', score: 2, color: '#fb923c' },
  steak: { key: 'steak', label: 'Juicy Steak', icon: '🥩', score: 4, color: '#f87171' }
};

export const POWERUP_TYPES = {
  speed: { key: 'speed', label: 'Zoomies', icon: '⚡', color: '#facc15', duration: 8000 },
  score: { key: 'score', label: 'Double Score', icon: '⭐', color: '#a855f7', duration: 8000 },
  shield: { key: 'shield', label: 'Shield Collar', icon: '🛡️', color: '#38bdf8', duration: 10000 }
};

export const AFFIX_DEFINITIONS = {
  narrowHalls: {
    key: 'narrowHalls',
    name: 'Narrow Halls',
    badge: 'Center Spawns',
    desc: 'Treats spawn only in center lanes; edges remain sparse.',
    impact: -0.3
  },
  zoomies: {
    key: 'zoomies',
    name: 'Zoomies Surge',
    badge: 'Speed +20%',
    desc: 'Game speed +20%; each treat grants +1 bonus score.',
    impact: 0.2
  },
  donationNight: {
    key: 'donationNight',
    name: 'Donation Night',
    badge: '2x Shelter Coins',
    desc: 'Treats give half score, but shelter coin earnings are doubled.',
    impact: 0.1
  },
  hauntedVacuum: {
    key: 'hauntedVacuum',
    name: 'Haunted Vacuum',
    badge: 'Aggressive Vac',
    desc: 'Vacuum turns more erratically and pursues relentlessly.',
    impact: -0.5
  },
  bombAlley: {
    key: 'bombAlley',
    name: 'Bomb Alley',
    badge: 'Extra Bombs',
    desc: 'Bomb spawn frequency is doubled on this floor.',
    impact: -0.4
  },
  dimRoom: {
    key: 'dimRoom',
    name: 'Dim Room',
    badge: 'Lantern Light',
    desc: 'Soft lantern lighting around snake head; outer arena dimmed.',
    impact: -0.3
  },
  snackShortage: {
    key: 'snackShortage',
    name: 'Snack Shortage',
    badge: '+2 Score Snacks',
    desc: 'Treat respawn takes 1s longer, but base score is +2 per treat.',
    impact: 0.1
  },
  abundance: {
    key: 'abundance',
    name: 'Snack Feast',
    badge: 'Multi-Treats',
    desc: 'Multiple treats remain active on the board simultaneously.',
    impact: 0.4
  }
};

export const UPGRADE_CATALOG = {
  collars: [
    {
      id: 'safety_collar',
      name: 'Safety Collar',
      category: 'Collar',
      icon: '🦺',
      desc: '+1 Max Heart and immediately restores 1 heart.',
      apply(state) {
        state.maxHearts += 1;
        state.hearts = Math.min(state.maxHearts, state.hearts + 1);
      }
    },
    {
      id: 'zoomie_collar',
      name: 'Zoomie Collar',
      category: 'Collar',
      icon: '⚡',
      desc: 'Permanent -10% tick duration; +1 bonus score while speed powerup is active.',
      apply(state) {
        state.persistentTickScalar *= 0.9;
        state.flags.zoomieCollar = true;
      }
    },
    {
      id: 'therapy_collar',
      name: 'Therapy Collar',
      category: 'Collar',
      icon: '💚',
      desc: 'Heals 1 heart for every 8 treats eaten if damaged.',
      apply(state) {
        state.flags.therapyCollar = true;
      }
    },
    {
      id: 'lucky_collar',
      name: 'Lucky Collar',
      category: 'Collar',
      icon: '🍀',
      desc: '25% chance to negate damage when colliding with obstacles or bombs.',
      apply(state) {
        state.flags.luckyCollar = true;
      }
    },
    {
      id: 'iron_collar',
      name: 'Iron Collar',
      category: 'Collar',
      icon: '🛡️',
      desc: 'Deploys an iron shield absorbing the first hit on each floor.',
      apply(state) {
        state.flags.ironCollar = true;
        state.flags.ironShieldActive = true;
      }
    },
    {
      id: 'awareness_collar',
      name: 'Awareness Collar',
      category: 'Collar',
      icon: '👁️',
      desc: 'Pulsing hazard radar warns you when bombs or vacuums are nearby.',
      apply(state) {
        state.flags.awarenessCollar = true;
      }
    }
  ],
  toys: [
    {
      id: 'vacuum_toy',
      name: 'Vacuum Squeaker',
      category: 'Toy',
      icon: '🧸',
      desc: 'When the vacuum sweeps up a treat, it drops a random powerup.',
      apply(state) {
        state.flags.vacuumToy = true;
      }
    },
    {
      id: 'bomb_plushie',
      name: 'Bomb Plushie',
      category: 'Toy',
      icon: '💣',
      desc: 'Bomb hits cut length by only 25% (instead of 50%); shield turns bombs into +3 score.',
      apply(state) {
        state.flags.bombPlushie = true;
      }
    },
    {
      id: 'feather_wand',
      name: 'Feather Wand',
      category: 'Toy',
      icon: '🪶',
      desc: 'Grants 1 ghost-step per floor allowing you to pass safely through your own tail.',
      apply(state) {
        state.flags.featherWand = true;
        state.flags.featherCharge = 1;
      }
    },
    {
      id: 'catnip_mouse',
      name: 'Catnip Mouse',
      category: 'Toy',
      icon: '🐭',
      desc: 'Eating 3 treats within 4 seconds triggers a 3-second Zoomies speed surge.',
      apply(state) {
        state.flags.catnipMouse = true;
      }
    },
    {
      id: 'scratching_post',
      name: 'Scratching Post',
      category: 'Toy',
      icon: '🪵',
      desc: 'Auto-deflects the first bomb explosion on each floor.',
      apply(state) {
        state.flags.scratchingPost = true;
        state.flags.scratchingPostCharge = 1;
      }
    },
    {
      id: 'cozy_blanket',
      name: 'Cozy Blanket',
      category: 'Toy',
      icon: '🧶',
      desc: 'Start-of-floor grace period is extended by +50%.',
      apply(state) {
        state.flags.cozyBlanket = true;
      }
    }
  ],
  perks: [
    {
      id: 'snack_streaks',
      name: 'Snack Streaks',
      category: 'Perk',
      icon: '🔥',
      desc: 'Eating treats without hitting hazards builds a combo multiplier (+1 score per 3 treats).',
      apply(state) {
        state.flags.snackStreaks = true;
      }
    },
    {
      id: 'treat_magnet',
      name: 'Treat Magnet',
      category: 'Perk',
      icon: '🧲',
      desc: 'Treats spawn preferentially closer to the snake head.',
      apply(state) {
        state.flags.treatMagnet = true;
      }
    },
    {
      id: 'gourmet_palate',
      name: 'Gourmet Palate',
      category: 'Perk',
      icon: '🥩',
      desc: 'Steaks grant +4 bonus score and biscuits grant +2 bonus score.',
      apply(state) {
        state.flags.gourmetPalate = true;
      }
    },
    {
      id: 'scavenger',
      name: 'Scavenger',
      category: 'Perk',
      icon: '🪙',
      desc: '20% chance for eaten treats to drop a shiny coin for your wallet.',
      apply(state) {
        state.flags.scavenger = true;
      }
    },
    {
      id: 'second_helping',
      name: 'Second Helping',
      category: 'Perk',
      icon: '🍽️',
      desc: '20% chance for an eaten treat to instantly spawn a bonus snack.',
      apply(state) {
        state.flags.secondHelping = true;
      }
    },
    {
      id: 'efficient_digestion',
      name: 'Efficient Digestion',
      category: 'Perk',
      icon: '🍎',
      desc: 'Every 6th treat eaten restores 1 heart if damaged.',
      apply(state) {
        state.flags.efficientDigestion = true;
      }
    }
  ]
};

export const ALL_UPGRADES = [
  ...UPGRADE_CATALOG.collars,
  ...UPGRADE_CATALOG.toys,
  ...UPGRADE_CATALOG.perks
];

export const FLOOR_SCRIPT = [
  // Act 1: Meadow Morning (Floors 1-4)
  { floor: 1, board: 'roomy', difficulty: 'normal', goal: { type: 'forage', target: 8 }, affixes: [], vacuum: false },
  { floor: 2, board: 'roomy', difficulty: 'normal', goal: { type: 'forage', target: 10 }, affixes: ['narrowHalls'], vacuum: false },
  { floor: 3, board: 'roomy', difficulty: 'normal', goal: { type: 'forage', target: 12 }, affixes: ['abundance'], vacuum: false },
  { floor: 4, board: 'roomy', difficulty: 'normal', goal: { type: 'rescue', target: 2 }, affixes: ['zoomies'], vacuum: false },
  // Act 2: Golden Hour (Floors 5-9) — Vacuums introduced!
  { floor: 5, board: 'roomy', difficulty: 'normal', goal: { type: 'forage', target: 14 }, affixes: ['hauntedVacuum'], vacuum: { difficulty: 'chill', count: 1 } },
  { floor: 6, board: 'roomy', difficulty: 'spicy', goal: { type: 'rescue', target: 3 }, affixes: ['snackShortage'], vacuum: false },
  { floor: 7, board: 'roomy', difficulty: 'spicy', goal: { type: 'forage', target: 16 }, affixes: ['bombAlley'], vacuum: { difficulty: 'normal', count: 1 } },
  { floor: 8, board: 'roomy', difficulty: 'spicy', goal: { type: 'rescue', target: 3 }, affixes: ['dimRoom'], vacuum: false },
  { floor: 9, board: 'roomy', difficulty: 'spicy', goal: { type: 'forage', target: 18 }, affixes: ['donationNight'], vacuum: { difficulty: 'normal', count: 1 } },
  // Act 3: Twilight Gauntlet (Floors 10-14)
  { floor: 10, board: 'roomy', difficulty: 'spicy', goal: { type: 'survive', targetMs: 35000 }, affixes: ['hauntedVacuum', 'zoomies'], vacuum: { difficulty: 'spicy', count: 1 } },
  { floor: 11, board: 'roomy', difficulty: 'spicy', goal: { type: 'vacuumHunt', targetMs: 40000 }, affixes: ['bombAlley'], vacuum: { difficulty: 'spicy', count: 1 } },
  { floor: 12, board: 'roomy', difficulty: 'spicy', goal: { type: 'rescue', target: 4 }, affixes: ['dimRoom', 'narrowHalls'], vacuum: { difficulty: 'normal', count: 1 } },
  { floor: 13, board: 'roomy', difficulty: 'superSpicy', goal: { type: 'survive', targetMs: 45000 }, affixes: ['bombAlley', 'hauntedVacuum'], vacuum: { difficulty: 'spicy', count: 1 } },
  { floor: 14, board: 'roomy', difficulty: 'superSpicy', goal: { type: 'survive', targetMs: 50000 }, affixes: ['snackShortage', 'dimRoom'], vacuum: { difficulty: 'spicy', count: 1 } },
  // Act 4: The Boss Room (Floor 15)
  {
    floor: 15,
    board: 'roomy',
    difficulty: 'superSpicy',
    goal: { type: 'boss', targetMs: 60000 },
    affixes: ['hauntedVacuum', 'dimRoom'],
    vacuum: { difficulty: 'boss', count: 1 }
  }
];

export const MILESTONES = [
  { key: 'floor_5', at: 5, label: 'Trail Scout', tier: 'standard', coins: 2 },
  { key: 'floor_10', at: 10, label: 'Rescue Captain', tier: 'duo', coins: 5 },
  { key: 'boss_clear', at: 15, label: 'Vacuum Conqueror', tier: 'deluxe', coins: 15 }
];

export const MASCOTS = [
  { id: 'cat', name: 'Marmalade', species: 'cat', head: '🐱', bodyColor: '#f97316', eyeColor: '#0f172a' },
  { id: 'dog', name: 'Barnaby', species: 'dog', head: '🐶', bodyColor: '#d97706', eyeColor: '#0f172a' },
  { id: 'bunny', name: 'Pippin', species: 'bunny', head: '🐰', bodyColor: '#e2e8f0', eyeColor: '#f43f5e' },
];

export const CONTINUE_COST = 10;
export const ROUTE_SKIP_COINS = 2;
