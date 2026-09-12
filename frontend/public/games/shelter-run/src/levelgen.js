// Z + lane occupancy obstacle stream — cluster patterns by difficulty band,
// per-biome obstacle pools with a signature hazard, treat lines, and power-up
// pickups gated on owned upgrades.
import { OBSTACLE, PICKUP } from './config.js';

const MIN_GAP = { easy: 660, medium: 450, hard: 300 };
const REACTION_GAP = 230;
const BANDS = [
  { minMeters: 0, key: 'easy' },
  { minMeters: 350, key: 'medium' },
  { minMeters: 1100, key: 'hard' },
];

const COLLECTIBLE_CHANCE = 0.30;
const COLLECT_LINE_CHANCE = 0.22;
const COLLECT_LINE_COUNT = 4;
const COLLECT_LINE_SPACING = 90;

const TREAT_LINE_CHANCE = 0.34;    // of non-pet, non-obstacle clusters
const TREAT_LINE_COUNT = 5;
const TREAT_LINE_SPACING = 70;
const PICKUP_CHANCE = 0.055;       // per cluster roll, needs an owned upgrade

const B = OBSTACLE.LANE_BLOCK, L = OBSTACLE.LOW, H = OBSTACLE.HIGH, G = OBSTACLE.GAP;

const PATTERNS = {
  easy: [
    [{ type: B, lane: 0 }],
    [{ type: B, lane: 2 }],
    [{ type: L, lane: 1 }],
    [{ type: H, lane: 0 }],
    [{ type: H, lane: 2 }],
    [{ type: B, lane: 0 }, { type: B, lane: 2 }],
    [{ type: L, lane: 0 }],
    [{ type: L, lane: 2 }],
  ],
  medium: [
    [{ type: B, lane: 0 }, { type: L, lane: 1 }],
    [{ type: L, lane: 0 }, { type: B, lane: 2 }],
    [{ type: H, lane: 0 }, { type: B, lane: 2 }],
    [{ type: B, lane: 0 }, { type: H, lane: 1 }],
    [{ type: L, lane: 0 }, { type: H, lane: 2 }],
    [{ type: B, lane: 1 }],
    [{ type: L, lane: 0 }, { type: L, lane: 2 }],
    [{ type: H, lane: 1 }, { type: B, lane: 0 }],
  ],
  hard: [
    [{ type: B, lane: 0 }, { type: H, lane: 1 }, { type: B, lane: 2 }],
    [{ type: L, lane: 0 }, { type: B, lane: 1 }, { type: L, lane: 2 }],
    [{ type: H, lane: 0 }, { type: H, lane: 2 }],
    [{ type: B, lane: 0 }, { type: L, lane: 1 }],
    [{ type: L, lane: 0 }, { type: B, lane: 1 }, { type: H, lane: 2 }],
    [{ type: B, lane: 1 }, { type: H, lane: 0 }],
    [{ type: H, lane: 0 }, { type: L, lane: 1 }],
    [{ type: L, lane: 0 }, { type: H, lane: 1 }],
  ],
};

// Per-biome flavor: which obstacle type a cluster's lanes bias toward, plus a
// signature hazard injected as a bonus obstacle. Mirrors the palette table in
// config.js — Meadow puddles, Golden wall-dense, Frost slide-heavy,
// Starlight mixed + tight (gap scaling handled in nextGap).
const BIOME_POOLS = {
  grass:     { bias: [L, L, B, H],    signature: G, signatureChance: 0.30 }, // puddles
  dirt:      { bias: [B, B, L, H],    signature: B, signatureChance: 0.18 }, // extra walls
  snow:      { bias: [H, H, B, L],    signature: H, signatureChance: 0.26 }, // icy overhangs
  starlight: { bias: [B, L, H, G],    signature: G, signatureChance: 0.24 }, // dark gaps
};

export function difficultyKey(meters) {
  let key = BANDS[0].key;
  for (const b of BANDS) if (meters >= b.minMeters) key = b.key;
  return key;
}

function isHardCluster(obstacles) {
  if (obstacles.length < 2) return false;
  const lanes = new Set(obstacles.map(o => o.lane));
  return lanes.size >= 2;
}

export function nextGap(rand, meters, lastWasHard) {
  const base = MIN_GAP[difficultyKey(meters)] || MIN_GAP.easy;
  return base + (lastWasHard ? REACTION_GAP : 0) + rand() * 170;
}

function pickVariant(rand) {
  return Math.floor(rand() * 3);
}

function ownedUpgradeKinds(upgrades) {
  const kinds = [];
  if (upgrades.magnet > 0) kinds.push(PICKUP.MAGNET);
  if (upgrades.ghost > 0) kinds.push(PICKUP.GHOST);
  if (upgrades.boost > 0) kinds.push(PICKUP.BOOST);
  if (upgrades.donation > 0) kinds.push(PICKUP.DONATION);
  return kinds;
}

// Spawns one cluster at worldZ. ctx = { upgrades, biomeId, treatTier }.
export function spawnCluster(rand, atZ, meters, idCounter, ctx = {}) {
  const out = { obstacles: [], collectibles: [], idCounter, hard: false };
  const upgrades = ctx.upgrades || {};
  const pool = BIOME_POOLS[ctx.biomeId] || BIOME_POOLS.grass;

  // Power-up pickup — rare, only for owned upgrades.
  const pickupKinds = ownedUpgradeKinds(upgrades);
  if (pickupKinds.length && rand() < PICKUP_CHANCE) {
    const kind = pickupKinds[Math.floor(rand() * pickupKinds.length)];
    out.collectibles.push({
      id: ++out.idCounter, kind, lane: Math.floor(rand() * 3),
      worldZ: atZ, collected: false,
    });
    return out;
  }

  if (rand() < COLLECTIBLE_CHANCE) {
    const lane = Math.floor(rand() * 3);
    // Treat lines outnumber single pets as the run matures — they feed score.
    if (rand() < TREAT_LINE_CHANCE) {
      const tier = ctx.treatTier || { tier: 'bronze', value: 1 };
      for (let i = 0; i < TREAT_LINE_COUNT; i++) {
        out.collectibles.push({
          id: ++out.idCounter, kind: PICKUP.TREAT, lane,
          worldZ: atZ + i * TREAT_LINE_SPACING, collected: false,
          tier: tier.tier, value: tier.value,
        });
      }
    } else if (rand() < COLLECT_LINE_CHANCE) {
      for (let i = 0; i < COLLECT_LINE_COUNT; i++) {
        out.collectibles.push({ id: ++out.idCounter, kind: 'pet', lane, worldZ: atZ + i * COLLECT_LINE_SPACING, collected: false });
      }
    } else {
      out.collectibles.push({ id: ++out.idCounter, kind: 'pet', lane, worldZ: atZ, collected: false });
    }
    return out;
  }

  const list = PATTERNS[difficultyKey(meters)] || PATTERNS.easy;
  const pattern = list[Math.floor(rand() * list.length)];
  const jitter = (rand() - 0.5) * 40;
  const lanes = new Set();
  for (const p of pattern) {
    // Biome bias: sometimes re-deal the obstacle type from the biome's pool.
    const type = rand() < 0.4 ? pool.bias[Math.floor(rand() * pool.bias.length)] : p.type;
    out.obstacles.push({
      id: ++out.idCounter,
      type, lane: p.lane,
      worldZ: atZ + jitter,
      passed: false,
      variant: pickVariant(rand),
    });
    lanes.add(p.lane);
  }
  // Signature hazard — a bonus obstacle on a free lane so the run stays fair.
  if (rand() < pool.signatureChance && lanes.size < 3) {
    const free = [0, 1, 2].filter(l => !lanes.has(l));
    const lane = free[Math.floor(rand() * free.length)];
    out.obstacles.push({
      id: ++out.idCounter,
      type: pool.signature, lane,
      worldZ: atZ + 130 + rand() * 60,
      passed: false,
      variant: pickVariant(rand),
      signature: true,
    });
  }
  out.hard = isHardCluster(out.obstacles);
  return out;
}
