var SP_Effects = {
  familyOf(ball) {
    if (ball.careFamily) return ball.careFamily;
    var meta = SHELTER_CONTENT.careBalls.find(function (b) { return b.id === ball.careBallId; });
    return meta ? meta.family : 'tennis';
  },

  extraBallsPerShot(runState) {
    var extra = 0;
    (runState.perks || []).forEach(function (p) {
      if (p.id === 'treat_pouch' || p.id === 'snack_jar') extra += 1;
    });
    return extra;
  },

  modifyDamageOnSpawn(ball, runState) {
    var dmg = ball.damage || 1;
    var fam = SP_Effects.familyOf(ball);
    if (fam === 'treat') dmg += 1;
    if (runState.buildingBonuses && runState.buildingBonuses.damage) dmg += runState.buildingBonuses.damage;
    return dmg;
  },

  modifyDamage(ball, stressor, runState, baseDmg) {
    return baseDmg;
  },

  onHit(scene, ball, stressor, runState, pitDirector) {
    var fam = SP_Effects.familyOf(ball);
    if (fam === 'brush' || fam === 'comb') {
      SP_Effects._splashRow(scene, stressor, runState, pitDirector, 1);
    }
    if (fam === 'bell' || fam === 'calm') {
      if (pitDirector && pitDirector.slowRows) pitDirector.slowRows(2000);
    }
    if (fam === 'rope' || fam === 'play') {
      runState._spawnBonusBall = true;
    }
    if (fam === 'blanket' || fam === 'leash') {
      if (stressor.stressorData) stressor.stressorData.hp -= 0.5;
    }
    if (stressor.stressorData && stressor.stressorData.hp <= 0 && runState._spawnBonusBall) {
      runState._spawnBonusBall = false;
      SP_Effects._spawnBabyBall(scene, stressor.x, stressor.y, runState);
    }
    if (typeof SP_Audio !== 'undefined') SP_Audio.play('hit');
  },

  _splashRow(scene, hitStressor, runState, pitDirector, dmg) {
    if (!pitDirector || !pitDirector.stressorList) return;
    var rowY = hitStressor.stressorData ? hitStressor.stressorData.rowY : hitStressor.y;
    pitDirector.stressorList.forEach(function (s) {
      if (!s.active || s === hitStressor) return;
      if (Math.abs(s.y - rowY) > 8) return;
      if (Math.abs(s.x - hitStressor.x) > 120) return;
      if (s.stressorData) s.stressorData.hp -= dmg;
    });
  },

  _spawnBabyBall(scene, x, y, runState) {
    var tex = 'ball:tennis';
    var ball = scene.physics.add.image(x, y, tex);
    ball.setCircle(10);
    ball.setVelocity((Math.random() - 0.5) * 200, -280);
    ball.setBounce(0.9);
    ball.damage = 1;
    ball.careBallId = 'tennis';
    scene.time.delayedCall(3000, function () { if (ball.active) ball.destroy(); });
  },
};
