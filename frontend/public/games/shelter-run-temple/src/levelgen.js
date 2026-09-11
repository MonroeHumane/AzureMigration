/* ─── Z + lane occupancy obstacle stream ──────────────────────────────── */

function srDifficultyKey(meters) {
  var bands = CFG.DIFFICULTY_BANDS;
  var key = bands[0].key;
  for (var i = 0; i < bands.length; i++) {
    if (meters >= bands[i].minMeters) key = bands[i].key;
  }
  return key;
}

var SR_PATTERNS = Object.freeze({
  easy: [
    [{ type: SR_OBSTACLE_TYPES.LANE_BLOCK, lane: 0 }],
    [{ type: SR_OBSTACLE_TYPES.LANE_BLOCK, lane: 2 }],
    [{ type: SR_OBSTACLE_TYPES.LOW, lane: 1 }],
    [{ type: SR_OBSTACLE_TYPES.HIGH, lane: 0 }],
    [{ type: SR_OBSTACLE_TYPES.HIGH, lane: 2 }],
    [{ type: SR_OBSTACLE_TYPES.LANE_BLOCK, lane: 0 }, { type: SR_OBSTACLE_TYPES.LANE_BLOCK, lane: 2 }],
    [{ type: SR_OBSTACLE_TYPES.LOW, lane: 0 }],
    [{ type: SR_OBSTACLE_TYPES.LOW, lane: 2 }],
  ],
  medium: [
    [{ type: SR_OBSTACLE_TYPES.LANE_BLOCK, lane: 0 }, { type: SR_OBSTACLE_TYPES.LOW, lane: 1 }],
    [{ type: SR_OBSTACLE_TYPES.LOW, lane: 0 }, { type: SR_OBSTACLE_TYPES.LANE_BLOCK, lane: 2 }],
    [{ type: SR_OBSTACLE_TYPES.HIGH, lane: 0 }, { type: SR_OBSTACLE_TYPES.LANE_BLOCK, lane: 2 }],
    [{ type: SR_OBSTACLE_TYPES.LANE_BLOCK, lane: 0 }, { type: SR_OBSTACLE_TYPES.HIGH, lane: 1 }],
    [{ type: SR_OBSTACLE_TYPES.LOW, lane: 0 }, { type: SR_OBSTACLE_TYPES.HIGH, lane: 2 }],
    [{ type: SR_OBSTACLE_TYPES.LANE_BLOCK, lane: 1 }],
    [{ type: SR_OBSTACLE_TYPES.LOW, lane: 0 }, { type: SR_OBSTACLE_TYPES.LOW, lane: 2 }],
    [{ type: SR_OBSTACLE_TYPES.HIGH, lane: 1 }, { type: SR_OBSTACLE_TYPES.LANE_BLOCK, lane: 0 }],
  ],
  hard: [
    [{ type: SR_OBSTACLE_TYPES.LANE_BLOCK, lane: 0 }, { type: SR_OBSTACLE_TYPES.HIGH, lane: 1 }, { type: SR_OBSTACLE_TYPES.LANE_BLOCK, lane: 2 }],
    [{ type: SR_OBSTACLE_TYPES.LOW, lane: 0 }, { type: SR_OBSTACLE_TYPES.LANE_BLOCK, lane: 1 }, { type: SR_OBSTACLE_TYPES.LOW, lane: 2 }],
    [{ type: SR_OBSTACLE_TYPES.HIGH, lane: 0 }, { type: SR_OBSTACLE_TYPES.HIGH, lane: 2 }],
    [{ type: SR_OBSTACLE_TYPES.LANE_BLOCK, lane: 0 }, { type: SR_OBSTACLE_TYPES.LOW, lane: 1 }],
    [{ type: SR_OBSTACLE_TYPES.LOW, lane: 0 }, { type: SR_OBSTACLE_TYPES.LANE_BLOCK, lane: 1 }, { type: SR_OBSTACLE_TYPES.HIGH, lane: 2 }],
    [{ type: SR_OBSTACLE_TYPES.LANE_BLOCK, lane: 1 }, { type: SR_OBSTACLE_TYPES.HIGH, lane: 0 }],
    [{ type: SR_OBSTACLE_TYPES.HIGH, lane: 0 }, { type: SR_OBSTACLE_TYPES.LOW, lane: 1 }],
    [{ type: SR_OBSTACLE_TYPES.LANE_BLOCK, lane: 0 }, { type: SR_OBSTACLE_TYPES.HIGH, lane: 1 }],
  ],
});

function srIsHardCluster(obstacles) {
  if (!obstacles || obstacles.length < 2) return false;
  var lanes = {};
  obstacles.forEach(function (o) { lanes[o.lane] = true; });
  return Object.keys(lanes).length >= 2;
}

function srNextGap(rand, meters, lastWasHard) {
  var key = srDifficultyKey(meters);
  var base = CFG.MIN_GAP[key] || CFG.MIN_GAP.easy;
  return base + (lastWasHard ? CFG.REACTION_GAP : 0) + rand() * 160;
}

function srPickVariant(rand, type) {
  var list = (typeof SR_OBS_VARIANTS !== 'undefined' && SR_OBS_VARIANTS[type]) || [0, 1, 2];
  return list[Math.floor(rand() * list.length)];
}

function srSpawnCluster(rand, atZ, meters, idCounter) {
  var out = { obstacles: [], collectibles: [], idCounter: idCounter, hard: false };
  if (rand() < CFG.COLLECTIBLE_CHANCE) {
    var lane = Math.floor(rand() * 3);
    if (rand() < CFG.COLLECT_LINE_CHANCE) {
      for (var i = 0; i < CFG.COLLECT_LINE_COUNT; i++) {
        out.collectibles.push({ id: ++out.idCounter, lane: lane, worldZ: atZ + i * CFG.COLLECT_LINE_SPACING, collected: false });
      }
    } else {
      out.collectibles.push({ id: ++out.idCounter, lane: lane, worldZ: atZ, collected: false });
    }
    return out;
  }
  var key = srDifficultyKey(meters);
  var list = SR_PATTERNS[key] || SR_PATTERNS.easy;
  var pattern = list[Math.floor(rand() * list.length)];
  var jitter = (rand() - 0.5) * 40;
  for (var j = 0; j < pattern.length; j++) {
    out.obstacles.push({
      id: ++out.idCounter,
      type: pattern[j].type,
      lane: pattern[j].lane,
      worldZ: atZ + jitter,
      passed: false,
      variant: srPickVariant(rand, pattern[j].type),
      useRock: pattern[j].type === SR_OBSTACLE_TYPES.LANE_BLOCK && rand() < 0.55,
    });
  }
  out.hard = srIsHardCluster(out.obstacles);
  return out;
}
