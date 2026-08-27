var SP_RunHud = {
  create(scene, runState) {
    var depth = 50;
    var level = scene.add.text(24, 16, '', { fontFamily: CFG.FONT, fontSize: '20px', color: '#f8fafc' }).setDepth(depth);
    var timer = scene.add.text(CFG.WIDTH - 24, 16, '', { fontFamily: CFG.FONT, fontSize: '20px', color: '#f8fafc' }).setOrigin(1, 0).setDepth(depth);
    var hearts = scene.add.text(24, 44, '', { fontFamily: CFG.FONT, fontSize: '16px', color: '#f472b6' }).setDepth(depth);
    var rowLabel = scene.add.text(CFG.WIDTH / 2, 16, '', { fontFamily: CFG.FONT, fontSize: '16px', color: '#94a3b8' }).setOrigin(0.5, 0).setDepth(depth);

    var stripY = CFG.HEIGHT - 28;
    var ballIcons = [];
    function refreshStrip() {
      ballIcons.forEach(function (b) { b.destroy(); });
      ballIcons = [];
      var balls = runState.inventory.filter(function (i) { return i.kind === 'ball'; });
      balls.slice(0, 6).forEach(function (item, idx) {
        var key = SP_TextureRegistry.keyForCareBall(item.id, item.level || 1);
        if (!scene.textures.exists(key)) key = 'ball:tennis';
        var x = 24 + idx * 36;
        var img = scene.add.image(x, stripY, key).setScale(0.45).setDepth(depth);
        ballIcons.push(img);
      });
    }
    refreshStrip();

    var volKey = 'vol:' + runState.volunteerId;
    if (scene.textures.exists(volKey)) {
      scene.add.image(CFG.WIDTH - 40, stripY, volKey).setScale(0.55).setDepth(depth);
    }

    var muteBtn = scene.add.text(CFG.WIDTH - 24, 44, '🔊', { fontSize: '18px' }).setOrigin(1, 0).setDepth(depth).setInteractive({ useHandCursor: true });
    muteBtn.on('pointerup', function () {
      if (typeof SP_Audio !== 'undefined') {
        SP_Audio.toggleMute();
        muteBtn.setText(SP_Audio.isMuted() ? '🔇' : '🔊');
      }
    });

    return {
      update(state) {
        level.setText('Lv ' + state.level);
        timer.setText('Shift ' + state.timeLeft + 's');
        hearts.setText('Hearts ' + state.hearts + '/' + CFG.RUN.heartXpToLevel);
        rowLabel.setText('Rows cleared ' + (state.rowsCleared || 0));
      },
      refreshStrip: refreshStrip,
      showTutorialIfNeeded() {
        if (localStorage.getItem('shelter_pit_tutorial_done') === '1') return null;
        var overlay = scene.add.rectangle(CFG.WIDTH / 2, CFG.HEIGHT / 2, CFG.WIDTH, CFG.HEIGHT, 0x000000, 0.75).setDepth(100).setInteractive();
        var steps = [
          'Move with ← → or touch buttons',
          'Tap / click to shoot care balls at stressors',
          'Collect hearts to level up and pick new gear',
        ];
        var stepIdx = 0;
        var txt = scene.add.text(CFG.WIDTH / 2, CFG.HEIGHT / 2 - 20, steps[0], {
          fontFamily: CFG.FONT, fontSize: '22px', color: '#f8fafc', align: 'center', wordWrap: { width: 500 },
        }).setOrigin(0.5).setDepth(101);
        var btn = scene.add.text(CFG.WIDTH / 2, CFG.HEIGHT / 2 + 60, 'Next', {
          fontFamily: CFG.FONT, fontSize: '20px', color: '#93c5fd',
        }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true });
        btn.on('pointerup', function () {
          stepIdx += 1;
          if (stepIdx >= steps.length) {
            localStorage.setItem('shelter_pit_tutorial_done', '1');
            overlay.destroy();
            txt.destroy();
            btn.destroy();
            return;
          }
          txt.setText(steps[stepIdx]);
          if (stepIdx === steps.length - 1) btn.setText('Got it!');
        });
        return overlay;
      },
      showRowCheer(pet) {
        if (!pet) return;
        var label = scene.add.text(CFG.WIDTH / 2, 100, 'Cheering for ' + pet.name + '!', {
          fontFamily: CFG.FONT, fontSize: '18px', color: '#f472b6',
        }).setOrigin(0.5).setDepth(80);
        scene.tweens.add({ targets: label, alpha: 0, y: 70, duration: 1800, onComplete: function () { label.destroy(); } });
      },
      showEvolveHint(msg) {
        var t = scene.add.text(CFG.WIDTH / 2, 72, msg, {
          fontFamily: CFG.FONT, fontSize: '14px', color: '#c4b5fd',
        }).setOrigin(0.5).setDepth(80);
        scene.time.delayedCall(3500, function () { t.destroy(); });
      },
    };
  },
};
