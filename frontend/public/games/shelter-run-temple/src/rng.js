/* ─── Seeded RNG (mulberry32) for reproducible runs - same as found/src/rng.js ─── */

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
