var SP_BallManager = {
  create(scene, runState) {
    var balls = scene.physics.add.group({ collideWorldBounds: true, bounceX: 1, bounceY: 1 });
    var shotIndex = 0;
    return {
      group: balls,
      lastShot: 0,
      getNextBallItem(state) {
        var special = state.inventory.filter(function (i) {
          return i.kind === 'ball' && !i.fused;
        });
        if (!special.length) return { id: 'tennis', level: 1, family: 'tennis' };
        var item = special[shotIndex % special.length];
        shotIndex += 1;
        return item;
      },
      shoot(scene, player, pointer, runState) {
        var now = scene.time.now;
        if (now - this.lastShot < CFG.RUN.shootCooldownMs) return;
        this.lastShot = now;
        var vol = runState.volunteer;
        var angle = Phaser.Math.Angle.Between(player.x, player.y, pointer.x, pointer.y);
        var speed = CFG.RUN.ballSpeed;
        var shots = 1;
        if (vol.trait === 'rapid_scatter') shots = 2;
        if (vol.trait === 'mirror') shots = 2;
        if (vol.trait === 'wide_arc') shots = 3;
        var extra = (runState.buildingBonuses && runState.buildingBonuses.extraBall) || 0;
        if (typeof SP_Effects !== 'undefined') extra += SP_Effects.extraBallsPerShot(runState);
        shots += extra;

        for (var s = 0; s < shots; s++) {
          var a = angle;
          if (vol.trait === 'rapid_scatter') a += (s === 0 ? -0.15 : 0.15);
          if (vol.trait === 'mirror' && s === 1) a = Math.PI - angle;
          if (vol.trait === 'wide_arc') a += (s - 1) * 0.22;

          var item = this.getNextBallItem(runState);
          var tex = item.id === 'tennis' ? 'ball:tennis' : SP_TextureRegistry.keyForCareBall(item.id, item.level || 1);
          if (!scene.textures.exists(tex)) tex = 'ball:tennis';

          var ball = balls.create(player.x, player.y - 20, tex);
          ball.setCircle(12);
          ball.setBounce(0.92);
          ball.setCollideWorldBounds(true);
          ball.damage = runState.babyBallDamage + runState.level * 0.5 + (item.level || 1) * 0.4;
          ball.careBallId = item.id;
          ball.careFamily = (SHELTER_CONTENT.careBalls.find(function (b) { return b.id === item.id; }) || {}).family;
          if (typeof SP_Effects !== 'undefined') {
            ball.damage = SP_Effects.modifyDamageOnSpawn(ball, runState);
          }
          ball.setVelocity(Math.cos(a) * speed, Math.sin(a) * speed);
          if (vol.trait === 'lob') ball.setVelocity(Math.cos(a) * speed * 0.7, Math.sin(a) * speed * 0.5 - 120);
          if (typeof SP_Audio !== 'undefined') SP_Audio.play('shoot');
        }
      },
    };
  },
};
