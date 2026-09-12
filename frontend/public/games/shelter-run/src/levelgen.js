// Z + lane occupancy obstacle stream — cluster patterns by difficulty band.
import { OBSTACLE } from './config.js';

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

const B = OBSTACLE.LANE_BLOCK, L = OBSTACLE.LOW, H = OBSTACLE.HIGH;

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

function pickVariant(rand, type) {
  return Math.floor(rand() * 3);
}

// Spawns one cluster at worldZ. Collectible clusters are pet-rescue tokens.
export function spawnCluster(rand, atZ, meters, idCounter) {
  const out = { obstacles: [], collectibles: [], idCounter, hard: false };
  if (rand() < COLLECTIBLE_CHANCE) {
    const lane = Math.floor(rand() * 3);
    if (rand() < COLLECT_LINE_CHANCE) {
      for (let i = 0; i < COLLECT_LINE_COUNT; i++) {
        out.collectibles.push({ id: ++out.idCounter, lane, worldZ: atZ + i * COLLECT_LINE_SPACING, collected: false });
      }
    } else {
      out.collectibles.push({ id: ++out.idCounter, lane, worldZ: atZ, collected: false });
    }
    return out;
  }
  const list = PATTERNS[difficultyKey(meters)] || PATTERNS.easy;
  const pattern = list[Math.floor(rand() * list.length)];
  const jitter = (rand() - 0.5) * 40;
  for (const p of pattern) {
    out.obstacles.push({
      id: ++out.idCounter,
      type: p.type, lane: p.lane,
      worldZ: atZ + jitter,
      passed: false,
      variant: pickVariant(rand, p.type),
    });
  }
  out.hard = isHardCluster(out.obstacles);
  return out;
}
