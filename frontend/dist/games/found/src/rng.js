/* ─── Seeded RNG (mulberry32) for reproducible levels + tests ─────────────── */

function createSeededRng(seed) {
  let state = (Number(seed) >>> 0) || 1;

  return function rand() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(levelNum, seed) {
  return ((Number(levelNum) * 2654435761) ^ (Number(seed) >>> 0)) >>> 0;
}
