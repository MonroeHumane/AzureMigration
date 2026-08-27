/* ─── Run stats, best times, tutorial flag ──────────────────────────────── */

const FOUND_STATS_KEY = 'monroe_found_stats_v1';
const FOUND_TUTORIAL_KEY = 'monroe_found_tutorial_v1';

function foundLoadStats() {
  try {
    const raw = localStorage.getItem(FOUND_STATS_KEY);
    if (!raw) {
      return { bestByLevel: {}, totalTreats: 0 };
    }
    const data = JSON.parse(raw);
    return {
      bestByLevel: data.bestByLevel && typeof data.bestByLevel === 'object' ? data.bestByLevel : {},
      totalTreats: Number(data.totalTreats) || 0,
    };
  } catch (e) {
    return { bestByLevel: {}, totalTreats: 0 };
  }
}

function foundSaveStats(stats) {
  try {
    localStorage.setItem(FOUND_STATS_KEY, JSON.stringify(stats));
  } catch (e) {
    /* ignore */
  }
}

/**
 * @param {number} levelNum
 * @param {number} timeMs
 * @param {number} deaths
 * @param {number} treats
 * @returns {{ isBest: boolean, previousBest: number|null }}
 */
function foundRecordLevelComplete(levelNum, timeMs, deaths, treats) {
  const stats = foundLoadStats();
  const key = String(levelNum);
  const prev = stats.bestByLevel[key];
  const isBest = !prev || timeMs < prev.timeMs;
  if (isBest) {
    stats.bestByLevel[key] = { timeMs, deaths, treats, at: Date.now() };
  }
  stats.totalTreats = (stats.totalTreats || 0) + treats;
  foundSaveStats(stats);
  return { isBest, previousBest: prev ? prev.timeMs : null };
}

function foundHasSeenTutorial() {
  try {
    return localStorage.getItem(FOUND_TUTORIAL_KEY) === '1';
  } catch (e) {
    return false;
  }
}

function foundMarkTutorialSeen() {
  try {
    localStorage.setItem(FOUND_TUTORIAL_KEY, '1');
  } catch (e) {
    /* ignore */
  }
}

/**
 * @param {number} levelNum
 * @returns {string}
 */
function foundFormatBestTime(levelNum) {
  const stats = foundLoadStats();
  const row = stats.bestByLevel[String(levelNum)];
  if (!row || !row.timeMs) {
    return ' - ';
  }
  const sec = (row.timeMs / 1000).toFixed(1);
  return `${sec}s`;
}

/**
 * @param {number} ms
 * @returns {string}
 */
function foundFormatDuration(ms) {
  const sec = Math.max(0, ms) / 1000;
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1);
    return `${m}:${s.padStart(4, '0')}`;
  }
  return `${sec.toFixed(1)}s`;
}
