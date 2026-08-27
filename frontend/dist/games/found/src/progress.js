/* ─── Local progress (unlocked levels) ──────────────────────────────────── */

const FOUND_PROGRESS_KEY_V1 = 'monroe_found_progress_v1';
const FOUND_PROGRESS_KEY = 'monroe_found_progress_v2';
let FOUND_PROGRESS_MEMORY_MAX = 1;

function foundClampUnlockedLevel(maxUnlocked) {
  const maxLevel = typeof foundGetLevelCount === 'function' ? foundGetLevelCount() : 24;
  return Math.max(1, Math.min(maxLevel, Number(maxUnlocked) || 1));
}

function foundLoadProgress() {
  try {
    const raw = localStorage.getItem(FOUND_PROGRESS_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      const value = foundClampUnlockedLevel(data.maxUnlocked);
      FOUND_PROGRESS_MEMORY_MAX = Math.max(FOUND_PROGRESS_MEMORY_MAX, value);
      return { maxUnlocked: value };
    }

    const legacyRaw = localStorage.getItem(FOUND_PROGRESS_KEY_V1);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      const migrated = foundClampUnlockedLevel(legacy.maxUnlocked);
      foundSaveProgress(migrated);
      FOUND_PROGRESS_MEMORY_MAX = Math.max(FOUND_PROGRESS_MEMORY_MAX, migrated);
      return { maxUnlocked: migrated };
    }

    return { maxUnlocked: foundClampUnlockedLevel(FOUND_PROGRESS_MEMORY_MAX) };
  } catch (e) {
    return { maxUnlocked: foundClampUnlockedLevel(FOUND_PROGRESS_MEMORY_MAX) };
  }
}

function foundSaveProgress(maxUnlocked) {
  const value = foundClampUnlockedLevel(maxUnlocked);
  FOUND_PROGRESS_MEMORY_MAX = Math.max(FOUND_PROGRESS_MEMORY_MAX, value);
  try {
    localStorage.setItem(FOUND_PROGRESS_KEY, JSON.stringify({ version: 2, maxUnlocked: value }));
  } catch (e) {
    /* ignore quota / private mode */
  }
  return value;
}

function foundUnlockLevel(completedLevel) {
  const progress = foundLoadProgress();
  const next = foundClampUnlockedLevel(completedLevel + 1);
  const current = Math.max(progress.maxUnlocked, FOUND_PROGRESS_MEMORY_MAX);
  if (next > current) {
    foundSaveProgress(next);
    return next;
  }
  return current;
}
