// Obstacle stream for the side-view track — cluster patterns by difficulty band.
// Patterns are authored in TIME (ms between elements) and converted to px at spawn
// using the current approach speed — so the same jump→duck rhythm feels identical
// at 400px/s and 870px/s. World scrolls left; flyers additionally self-propel.
import { WORLD, PHYS } from './config.js';

const B = WORLD.block;
const BANDS = [
  { minMeters: 0, key: 'easy' },
  { minMeters: 350, key: 'medium' },
  { minMeters: 1100, key: 'hard' },
];

const COLLECTIBLE_CHANCE = 0.30;
const COLLECT_LINE_CHANCE = 0.22;
const COLLECT_LINE_COUNT = 4;
const COLLECT_LINE_SPACING = 74;

const BLOCK_COLORS = ['pink', 'yellow', 'teal', 'purple'];

// Rhythm floor (design rule for dt values below): consecutive action-demanding
// obstacles need ≥ ~jumpMs+190ms between overlap-starts (land + rise again), and
// ≥ ~duckMs*0.6+190ms after a duck. All pattern dts respect that floor.
// Pattern entries: [weight, [{ t, dt, ...shape }]]. dt = ms after the cluster
// anchor (approach-scaled at spawn). First element must have dt 0. Weights favor
// readable rhythm patterns; boss shapes stay rare so they spice rather than wall.
const PATTERNS = {
  easy: [
    [3.0, [{ t: 'blocks', dt: 0, w: 1, h: 1 }]],
    [2.5, [{ t: 'blocks', dt: 0, w: 2, h: 1 }]],
    [2.0, [{ t: 'blocks', dt: 0, w: 1, h: 2 }]],
    [2.0, [{ t: 'fish', dt: 0, alt: 'low' }]],
    [1.5, [{ t: 'blocks', dt: 0, w: 1, h: 1 }, { t: 'blocks', dt: 850, w: 1, h: 1 }]],
  ],
  medium: [
    [2.0, [{ t: 'blocks', dt: 0, w: 2, h: 2 }]],
    [2.0, [{ t: 'fish', dt: 0, alt: 'mid' }]],
    [2.0, [{ t: 'hang', dt: 0, w: 1 }]],
    [1.5, [{ t: 'blocks', dt: 0, w: 1, h: 1 }, { t: 'blocks', dt: 800, w: 1, h: 2 }]],
    [1.5, [{ t: 'fish', dt: 0, alt: 'low' }, { t: 'blocks', dt: 880, w: 1, h: 2 }]],
    [1.5, [{ t: 'blocks', dt: 0, w: 3, h: 1 }]],
  ],
  hard: [
    [1.0, [{ t: 'blocks', dt: 0, w: 2, h: 3 }]],                                   // the boss jump — needs the apex
    [2.0, [{ t: 'hang', dt: 0, w: 1 }, { t: 'blocks', dt: 780, w: 2, h: 1 }]],     // duck → jump rhythm
    [2.0, [{ t: 'fish', dt: 0, alt: 'low' }, { t: 'fish', dt: 800, alt: 'mid' }]], // jump → stay up / duck
    [1.5, [{ t: 'whale', dt: 0 }]],
    [1.0, [{ t: 'blocks', dt: 0, w: 3, h: 2 }]],
    [1.2, [{ t: 'hang', dt: 0, w: 2 }]],
    [1.8, [{ t: 'blocks', dt: 0, w: 1, h: 2 }, { t: 'hang', dt: 820, w: 1 }]],
  ],
};
// Precomputed cumulative weight tables per band.
const BAND_CDF = {};
for (const [band, list] of Object.entries(PATTERNS)) {
  let acc = 0;
  BAND_CDF[band] = list.map(([w, pat]) => ({ cdf: (acc += w), pat }));
}
function pickPattern(rand, band) {
  const cdf = BAND_CDF[band] || BAND_CDF.easy;
  const roll = rand() * cdf[cdf.length - 1].cdf;
  for (const e of cdf) if (roll < e.cdf) return e.pat;
  return cdf[cdf.length - 1].pat;
}

export function difficultyKey(meters) {
  let key = BANDS[0].key;
  for (const b of BANDS) if (meters >= b.minMeters) key = b.key;
  return key;
}

function actionOf(p) {
  if (p.t === 'blocks') return 'jump';
  if (p.t === 'fish') return p.alt === 'low' ? 'jump' : 'duck';
  return 'duck'; // hang, whale
}

function isHardCluster(pattern) {
  return pattern.length > 1 || pattern.some(p => p.t === 'whale' || (p.t === 'blocks' && p.h === 3));
}

// Gap between cluster anchors, in ms of approach time. Converted to px by the
// caller via speed. Hard clusters earn a breather after themselves.
export function nextGapMs(rand, meters, lastWasHard) {
  const base = { easy: 1150, medium: 1020, hard: 960 }[difficultyKey(meters)];
  return base + (lastWasHard ? 320 : 0) + rand() * 260;
}

function pickColor(rand) { return BLOCK_COLORS[Math.floor(rand() * BLOCK_COLORS.length)]; }
function pickFish(rand) { return 'fish_red.png'; } // red reads as hazard — the "bird"

// Spawns one cluster anchored at world px atX. `approachPxMs` = world px per ms of
// approach at current speed (speed + flySpeed for flyers is handled per-element).
export function spawnCluster(rand, atX, meters, idCounter, approachPxMs = 0.5) {
  const out = { obstacles: [], collectibles: [], idCounter, hard: false, lastAction: null, endMs: 0 };
  const roll = rand();
  if (roll < COLLECTIBLE_CHANCE) {
    if (roll < COLLECTIBLE_CHANCE * COLLECT_LINE_CHANCE) {
      for (let i = 0; i < COLLECT_LINE_COUNT; i++) {
        // sine arc — you grab the middle two mid-ollie
        const alt = i === 0 || i === COLLECT_LINE_COUNT - 1 ? 34 : 120;
        out.collectibles.push({ id: ++out.idCounter, worldX: atX + i * COLLECT_LINE_SPACING, alt, collected: false });
      }
    } else {
      out.collectibles.push({ id: ++out.idCounter, worldX: atX, alt: 34, collected: false });
    }
    return out;
  }
  const pattern = pickPattern(rand, difficultyKey(meters));
  const jitter = (rand() - 0.5) * 36;
  for (const p of pattern) {
    // flyers close distance faster than the scroll — position them by their own
    // approach speed so dt stays honest in time
    const fly = p.t === 'fish' ? PHYS.fishFly : p.t === 'whale' ? PHYS.whaleFly : 0;
    const pxPerMs = approachPxMs + fly * 0.06; // flySpeed is px/frame → /16.67 per ms
    const wx = atX + p.dt * pxPerMs + jitter;
    if (p.t === 'blocks') {
      out.obstacles.push({ id: ++out.idCounter, t: 'blocks', worldX: wx, w: p.w * B, h: p.h * B,
                           color: pickColor(rand), passed: false });
    } else if (p.t === 'hang') {
      out.obstacles.push({ id: ++out.idCounter, t: 'hang', worldX: wx, w: p.w * B,
                           color: pickColor(rand), passed: false });
    } else if (p.t === 'fish') {
      const band = p.alt === 'low' ? WORLD.fishLow : WORLD.fishMid;
      out.obstacles.push({ id: ++out.idCounter, t: 'fish', worldX: wx, w: 58,
                           top: band.top, h: band.h, sprite: pickFish(rand),
                           flySpeed: PHYS.fishFly, passed: false });
    } else if (p.t === 'whale') {
      out.obstacles.push({ id: ++out.idCounter, t: 'whale', worldX: wx, w: 150,
                           top: WORLD.whale.top, h: WORLD.whale.h,
                           flySpeed: PHYS.whaleFly, passed: false });
    }
    out.lastAction = actionOf(p);
    out.endMs = Math.max(out.endMs, p.dt);
  }
  out.hard = isHardCluster(pattern);
  return out;
}
