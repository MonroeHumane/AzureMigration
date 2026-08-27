/* ─── Procedural obstacle/collectible stream ───────────────────────────────
   Mirrors found/src/levelgen.js + playability.js's intent (seeded RNG,
   distance-indexed difficulty, a playability guard against unbeatable
   sequences) adapted for a side-view runner with 3 evasion types
   (jump/duck/dodge - see Player.js) instead of a platform graph. */

const SR_OBSTACLE_TYPES = Object.freeze({
  SINGLE_JUMP: 'single_jump',   // ground-level - jump over
  SINGLE_DUCK: 'single_duck',   // overhead - duck under
  WIDE:        'wide',          // full-width - dodge left/right through it
});

function srDifficultyForMeters(meters) {
  const bands = CFG.DIFFICULTY_BANDS;
  let band = bands[0];
  for (let i = 0; i < bands.length; i++) {
    if (meters >= bands[i].minMeters) {
      band = bands[i];
    }
  }
  return band;
}

/**
 * Generates the next spawn point given the last one, respecting the
 * playability guard: a WIDE (dodge-required) obstacle is never followed by
 * another WIDE obstacle within less than REACTION_GAP_PX - the player
 * always has enough scroll distance to recover their dodge timing before
 * the next hard choice.
 *
 * @param {function} rand - seeded RNG (0..1), from createSeededRng
 * @param {number} lastSpawnX - world-X of the previous spawn
 * @param {object|null} lastSpawn - previous spawn descriptor, or null
 * @param {number} distanceMeters - current run distance, drives difficulty
 */
function srGenerateNextSpawn(rand, lastSpawnX, lastSpawn, distanceMeters) {
  const diff = srDifficultyForMeters(distanceMeters);
  const baseGap = CFG.MIN_SPAWN_GAP_PX * diff.spawnGapMul;
  const wasHard = lastSpawn && lastSpawn.type === SR_OBSTACLE_TYPES.WIDE;
  const gap = baseGap + (wasHard ? CFG.REACTION_GAP_PX : 0) + rand() * 160;
  const x = lastSpawnX + gap;

  // Collectibles are always safely grabbable (no jump/duck/dodge required) -
  // classic runner-coin feel, never placed at the same spawn point as an
  // obstacle.
  if (rand() < 0.22) {
    return { x, type: 'collectible', isCollectible: true };
  }

  const roll = rand();
  let type;
  if (roll < diff.fullWidthChance) {
    type = SR_OBSTACLE_TYPES.WIDE;
  } else if (roll < diff.fullWidthChance + (1 - diff.fullWidthChance) * 0.5) {
    type = SR_OBSTACLE_TYPES.SINGLE_JUMP;
  } else {
    type = SR_OBSTACLE_TYPES.SINGLE_DUCK;
  }

  return { x, type, isCollectible: false };
}
