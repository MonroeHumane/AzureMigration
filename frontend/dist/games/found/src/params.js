/* ─── Launch params, seeds, shareable layout URLs ─────────────────────────── */

/**
 * @returns {{ level: number|null, seed: number|null, daily: boolean, forceTouch: boolean }}
 */
function foundParseLaunchParams() {
  const p = new URLSearchParams(window.location.search);
  const levelRaw = Number(p.get('level'));
  const seedRaw = Number(p.get('seed'));
  const maxLevel = typeof foundGetLevelCount === 'function' ? foundGetLevelCount() : 24;
  return {
    level: Number.isFinite(levelRaw) && levelRaw >= 1 && levelRaw <= maxLevel
      ? Math.floor(levelRaw)
      : null,
    seed: Number.isFinite(seedRaw) ? (seedRaw >>> 0) : null,
    daily: p.get('daily') === '1',
    forceTouch: p.get('touch') === '1',
  };
}

/**
 * @param {number} levelNum
 * @param {number|null|undefined} explicitSeed
 * @param {{ daily?: boolean }} [opts]
 * @returns {number}
 */
function foundResolveLevelSeed(levelNum, explicitSeed, opts) {
  if (typeof explicitSeed === 'number' && Number.isFinite(explicitSeed)) {
    return explicitSeed >>> 0;
  }
  if (opts && opts.daily) {
    const d = new Date();
    const day = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    return hashSeed(levelNum, day);
  }
  return Date.now() >>> 0;
}

/**
 * @param {number} levelNum
 * @param {number} seed
 * @returns {string}
 */
function foundShareLayoutUrl(levelNum, seed) {
  const base = window.location.href.split('?')[0];
  return `${base}?level=${levelNum}&seed=${seed >>> 0}`;
}

/**
 * @param {number} levelNum
 * @returns {string}
 */
function foundDailyChallengeUrl(levelNum) {
  const base = window.location.href.split('?')[0];
  return `${base}?level=${levelNum}&daily=1`;
}
