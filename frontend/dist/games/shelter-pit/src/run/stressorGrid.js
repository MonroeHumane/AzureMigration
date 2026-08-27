var SP_StressorGrid = {
  create(scene, zoneId) {
    var zone = SHELTER_CONTENT.zones.find(function (z) {
      return z.id === zoneId;
    }) || SHELTER_CONTENT.zones[0];
    var types = SHELTER_CONTENT.stressorTypes;
    var cols = CFG.RUN.cols;
    var rows = zone.rows || CFG.RUN.rows;
    var cellW = 100;
    var cellH = 64;
    var startX = (CFG.WIDTH - cols * cellW) / 2 + cellW / 2;
    var startY = 120;
    var group = scene.add.group();
    var physicsGroup = scene.physics.add.staticGroup();

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (Math.random() < 0.35) continue;
        var type = types[Math.floor(Math.random() * types.length)];
        var size = r < 2 ? 'large' : r < 4 ? 'medium' : 'small';
        var x = startX + c * cellW;
        var y = startY + r * cellH;
        var key = 'stressor:' + type + ':' + size;
        var sprite = scene.add.image(x, y, key);
        sprite.setScale(0.9);
        var hp = size === 'large' ? 4 : size === 'medium' ? 2 : 1;
        sprite.stressorData = { hp: hp, maxHp: hp, type: type, row: r };
        group.add(sprite);
        physicsGroup.add(sprite);
      }
    }

    return {
      group: group,
      physicsGroup: physicsGroup,
      rows: rows,
      rowsCleared: 0,
      onBallHit(ball, stressor, runState, scene) {
        if (!stressor.active || !stressor.stressorData) return;
        stressor.stressorData.hp -= ball.damage || 1;
        if (stressor.stressorData.hp <= 0) {
          SP_StressorGrid.sparkleClear(scene, stressor);
          stressor.destroy();
          SP_RunState.addXp(runState, +1);
          if (Math.random() < CFG.RUN.enrichmentDropChance) {
            runState.pendingEnrichment = true;
          }
        }
        if (volunteerPierce(runState)) return;
        ball.destroy();
      },
      checkRowClear() {
        /* simplified: count remaining */
      },
      allCleared() {
        return group.countActive(true) === 0;
      },
    };
  },

  sparkleClear(scene, stressor) {
    if (!scene.textures.exists('pixel')) return;
    var emitter = scene.add.particles(stressor.x, stressor.y, 'pixel', {
      speed: { min: 40, max: 120 },
      scale: { start: 1.5, end: 0 },
      lifespan: 400,
      quantity: 12,
      tint: [0xfbbf24, 0x38bdf8, 0xf472b6],
    });
    scene.time.delayedCall(500, function () {
      emitter.destroy();
    });
  },
};

function volunteerPierce(runState) {
  return runState.volunteer && (runState.volunteer.trait === 'pierce' || runState.volunteer.trait === 'stealth');
}
