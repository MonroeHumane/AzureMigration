var SP_PitDirector = {
  create(scene, zoneId, runState, hooks) {
    var zone = SHELTER_CONTENT.zones.find(function (z) { return z.id === zoneId; }) || SHELTER_CONTENT.zones[0];
    var cols = CFG.RUN.cols;
    var cellW = Math.floor((CFG.PIT.right - CFG.PIT.left) / cols);
    var startX = CFG.PIT.left + cellW / 2;
    var types = SHELTER_CONTENT.stressorTypes;
    var rowsByY = {};
    var stressorList = [];
    var physicsGroup = scene.physics.add.staticGroup();
    var pickupGroup = scene.physics.add.group();
    var rowsSpawned = 0;
    var maxRows = zone.rows || CFG.RUN.rows;
    var rowSpeedMod = zone.rowSpeedMod || 1;
    var density = zone.density != null ? zone.density : 0.55;
    var descendMs = Math.floor((zone.descendMs || CFG.PIT.descendMs) / rowSpeedMod);
    var slowUntil = 0;

    function rowKey(y) {
      return Math.round(y);
    }

    function attachHpBar(stressor) {
      var barBg = scene.add.rectangle(stressor.x, stressor.y - 28, 40, 6, 0x1e293b).setDepth(5);
      var barFg = scene.add.rectangle(stressor.x - 20, stressor.y - 28, 40, 6, 0x22c55e).setOrigin(0, 0.5).setDepth(6);
      stressor.hpBarBg = barBg;
      stressor.hpBarFg = barFg;
    }

    function updateHpBar(stressor) {
      if (!stressor.hpBarFg || !stressor.stressorData) return;
      var pct = stressor.stressorData.hp / stressor.stressorData.maxHp;
      stressor.hpBarFg.width = 40 * Math.max(0, pct);
      stressor.hpBarFg.x = stressor.x - 20;
      stressor.hpBarBg.x = stressor.x;
    }

    function spawnStressor(x, y, rowIndex, opts) {
      opts = opts || {};
      var type = opts.type || types[Math.floor(Math.random() * types.length)];
      var size = opts.size || (rowIndex < 2 ? 'large' : rowIndex < 4 ? 'medium' : 'small');
      if (opts.miniboss) size = 'large';
      var key = 'stressor:' + type + ':' + size;
      var sprite = scene.add.image(x, y, key);
      if (opts.miniboss) sprite.setScale(1.35);
      else sprite.setScale(0.9);
      var hp = opts.miniboss ? 10 : size === 'large' ? 4 : size === 'medium' ? 2 : 1;
      sprite.stressorData = { hp: hp, maxHp: hp, type: type, row: rowIndex, rowY: y, miniboss: !!opts.miniboss };
      physicsGroup.add(sprite);
      attachHpBar(sprite);
      stressorList.push(sprite);
      var rk = rowKey(y);
      if (!rowsByY[rk]) rowsByY[rk] = [];
      rowsByY[rk].push(sprite);
      return sprite;
    }

    function spawnRow(y, rowIndex) {
      var count = 0;
      var isMiniboss = rowIndex === maxRows - 1 && zone.miniboss;
      if (isMiniboss) {
        spawnStressor(CFG.WIDTH / 2, y, rowIndex, { type: 'kennel', miniboss: true, size: 'large' });
        rowsSpawned += 1;
        return;
      }
      for (var c = 0; c < cols; c++) {
        if (Math.random() > density) continue;
        spawnStressor(startX + c * cellW, y, rowIndex);
        count += 1;
      }
      if (count === 0) spawnStressor(startX + Math.floor(cols / 2) * cellW, y, rowIndex);
      rowsSpawned += 1;
    }

    function dropPickup(x, y, kind) {
      var key = kind === 'heart' ? 'ui:heart' : 'ui:enrichment';
      var p = pickupGroup.create(x, y, key);
      p.setCircle(14);
      p.pickupKind = kind;
      p.setVelocity((Math.random() - 0.5) * 80, 40);
      p.setBounce(0.6);
      p.setCollideWorldBounds(true);
    }

    function checkRowClear(oldY) {
      var rk = rowKey(oldY);
      var row = rowsByY[rk];
      if (!row) return;
      var alive = row.filter(function (s) { return s.active; });
      if (alive.length > 0) return;
      delete rowsByY[rk];
      runState.rowsCleared += 1;
      dropPickup(CFG.WIDTH / 2, oldY, 'heart');
      if (Math.random() < (CFG.RUN.rowClearEnrichmentChance || 0.5)) {
        dropPickup(CFG.WIDTH / 2 + 40, oldY, 'enrichment');
      }
      if (hooks && hooks.onRowClear) hooks.onRowClear(oldY);
    }

    function descendRows() {
      if (scene.time.now < slowUntil) return;
      var keys = Object.keys(rowsByY);
      keys.forEach(function (rk) {
        var row = rowsByY[rk];
        var newY = parseFloat(rk) + CFG.PIT.rowStep;
        if (newY >= CFG.PIT.floor - 40) {
          if (hooks && hooks.onRowReachedFloor) hooks.onRowReachedFloor();
          return;
        }
        delete rowsByY[rk];
        rowsByY[rowKey(newY)] = row;
        row.forEach(function (s) {
          s.y = newY;
          s.stressorData.rowY = newY;
          if (s.hpBarBg) s.hpBarBg.y = newY - 28;
          if (s.hpBarFg) s.hpBarFg.y = newY - 28;
          if (s.body) s.body.updateFromGameObject();
        });
      });
      if (rowsSpawned < maxRows) {
        spawnRow(CFG.PIT.top, rowsSpawned);
      }
    }

    spawnRow(CFG.PIT.top, 0);
    spawnRow(CFG.PIT.top + CFG.PIT.rowStep, 1);

    var descendEvent = scene.time.addEvent({
      delay: descendMs,
      loop: true,
      callback: descendRows,
    });

    return {
      physicsGroup: physicsGroup,
      pickupGroup: pickupGroup,
      stressorList: stressorList,
      descendEvent: descendEvent,
      slowRows(ms) {
        slowUntil = scene.time.now + (ms || 2000);
      },
      onBallHit(ball, stressor, runState, sceneRef) {
        if (!stressor.active || !stressor.stressorData) return;
        var dmg = ball.damage || 1;
        if (typeof SP_Effects !== 'undefined') {
          dmg = SP_Effects.modifyDamage(ball, stressor, runState, dmg);
          SP_Effects.onHit(sceneRef, ball, stressor, runState, this);
        }
        stressor.stressorData.hp -= dmg;
        updateHpBar(stressor);
        if (stressor.stressorData.hp <= 0) {
          var oldY = stressor.stressorData.rowY;
          SP_StressorGrid.sparkleClear(sceneRef, stressor);
          if (stressor.hpBarBg) stressor.hpBarBg.destroy();
          if (stressor.hpBarFg) stressor.hpBarFg.destroy();
          stressor.destroy();
          SP_RunState.addXp(runState, 1);
          checkRowClear(oldY);
        }
        if (typeof volunteerPierce === 'function' && volunteerPierce(runState)) return;
        if (ball.active) ball.destroy();
      },
      onPickup(collectible, runState, sceneRef) {
        if (!collectible.active) return;
        if (collectible.pickupKind === 'heart') {
          SP_RunState.addXp(runState, +2);
        } else if (collectible.pickupKind === 'enrichment') {
          runState.pendingEnrichment = true;
          if (sceneRef.tryOpenEnrichment) sceneRef.tryOpenEnrichment();
        }
        collectible.destroy();
      },
      allCleared() {
        return stressorList.every(function (s) { return !s.active; }) && rowsSpawned >= maxRows;
      },
      anyActive() {
        return stressorList.some(function (s) { return s.active; });
      },
      destroy() {
        if (descendEvent) descendEvent.remove();
        stressorList.forEach(function (s) {
          if (s.hpBarBg) s.hpBarBg.destroy();
          if (s.hpBarFg) s.hpBarFg.destroy();
        });
      },
    };
  },
};

function volunteerPierce(runState) {
  return runState.volunteer && (runState.volunteer.trait === 'pierce' || runState.volunteer.trait === 'stealth');
}
