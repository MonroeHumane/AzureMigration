class RunScene extends Phaser.Scene {
  constructor() {
    super('RunScene');
  }

  init(data) {
    this.runState = SP_RunState.create({
      zoneId: data.zoneId || 'stray_alley',
      volunteerId: data.volunteerId || 'starter',
    });
    this.zoneId = this.runState.zoneId;
  }

  create() {
    this.bgLayer = this.add.image(CFG.WIDTH / 2, CFG.HEIGHT / 2, 'bg:' + this.zoneId).setDepth(0);
    if (this.textures.exists('bg:' + this.zoneId + ':far')) {
      this.bgFar = this.add.tileSprite(CFG.WIDTH / 2, 120, CFG.WIDTH, 240, 'bg:' + this.zoneId + ':far').setDepth(-1);
    }

    this.physics.world.setBounds(CFG.PIT.left, CFG.PIT.top, CFG.PIT.right - CFG.PIT.left, CFG.PIT.floor - CFG.PIT.top + 20);
    this.add.rectangle(CFG.PIT.left, CFG.PIT.top + 20, 4, CFG.PIT.floor - CFG.PIT.top, 0x334155).setOrigin(0, 0);
    this.add.rectangle(CFG.PIT.right, CFG.PIT.top + 20, 4, CFG.PIT.floor - CFG.PIT.top, 0x334155).setOrigin(1, 0);
    this.add.rectangle(CFG.WIDTH / 2, CFG.PIT.floor, CFG.PIT.right - CFG.PIT.left, 8, 0x475569);

    var catchZone = this.add.rectangle(CFG.WIDTH / 2, CFG.PIT.floor + CFG.PIT.catchZoneH / 2, 200, CFG.PIT.catchZoneH, 0x38bdf8, 0.15);
    this.add.text(CFG.WIDTH / 2, CFG.PIT.floor + CFG.PIT.catchZoneH / 2, 'Catch zone', {
      fontFamily: CFG.FONT, fontSize: '11px', color: '#93c5fd',
    }).setOrigin(0.5);

    this.player = this.add.rectangle(CFG.WIDTH / 2, CFG.PIT.floor - 24, 48, 24, 0x38bdf8);
    this.physics.add.existing(this.player);
    this.player.body.setImmovable(true);
    this.player.body.setCollideWorldBounds(true);

    if (this.textures.exists('vol:' + this.runState.volunteerId)) {
      this.add.image(this.player.x - 30, this.player.y - 10, 'vol:' + this.runState.volunteerId).setScale(0.8);
    }

    var self = this;
    this.pit = SP_PitDirector.create(this, this.zoneId, this.runState, {
      onRowClear: function () {
        if (self.hud) {
          var pet = ShelterPets.pickRandomPet();
          self.hud.showRowCheer(pet);
          if (pet && pet.id) self.runState.petsHelpedThisRun.push(pet.id);
        }
        if (typeof SP_Audio !== 'undefined') SP_Audio.play('clear');
        if (self.bgFar) self.bgFar.tilePositionY += 12;
      },
      onRowReachedFloor: function () {
        self.endShift(false);
      },
    });

    this.balls = SP_BallManager.create(this, this.runState);

    this.physics.add.overlap(this.balls.group, this.pit.physicsGroup, function (ball, stressor) {
      self.pit.onBallHit(ball, stressor, self.runState, self);
    });
    this.physics.add.overlap(this.player, this.pit.pickupGroup, function (_p, pickup) {
      self.pit.onPickup(pickup, self.runState, self);
      if (typeof SP_Audio !== 'undefined') SP_Audio.play('pickup');
    });
    this.physics.add.collide(this.balls.group, this.pit.pickupGroup);

    this.hud = SP_RunHud.create(this, this.runState);
    this.hud.showTutorialIfNeeded();
    this.touch = new TouchControls(this);

    this.input.on('pointerdown', function (pointer) {
      if (self.runState.pendingDraft || self.runState.pendingEnrichment) return;
      if (pointer.y > CFG.HEIGHT - 90 && self.touch && self.touch.enabled) return;
      self.balls.shoot(self, self.player, pointer, self.runState);
    });

    this.cursors = this.input.keyboard.createCursorKeys();
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: this.tickTimer,
      callbackScope: this,
    });

    this.updateHud();
  }

  tryOpenEnrichment() {
    if (this.runState.pendingEnrichment && !this.scene.isPaused('RunScene')) {
      this.scene.pause();
      this.scene.launch('EnrichmentScene', { runState: this.runState, parentScene: 'RunScene' });
    }
  }

  tickTimer() {
    if (this.runState.pendingDraft || this.runState.pendingEnrichment) return;
    this.runState.timeLeft -= 1;
    if (this.runState.timeLeft <= 0) {
      this.endShift(false);
      return;
    }
    if (this.pit.allCleared()) {
      this.runState.won = true;
      this.endShift(true);
      return;
    }
    if (this.runState.pendingDraft) {
      this.scene.pause();
      this.scene.launch('DraftScene', { runState: this.runState, parentScene: 'RunScene' });
      return;
    }
    if (this.runState.pendingEnrichment) {
      this.tryOpenEnrichment();
      return;
    }
    this.updateHud();
  }

  update() {
    if (this.runState.pendingDraft || this.runState.pendingEnrichment) return;
    var speed = this.runState.volunteer.trait === 'fast_move' ? 320 : 220;
    var touch = this.touch ? this.touch.poll() : { left: false, right: false };
    if (this.cursors.left.isDown || touch.left) this.player.body.setVelocityX(-speed);
    else if (this.cursors.right.isDown || touch.right) this.player.body.setVelocityX(speed);
    else this.player.body.setVelocityX(0);

    if (this.runState.pendingDraft) {
      this.scene.pause();
      this.scene.launch('DraftScene', { runState: this.runState, parentScene: 'RunScene' });
    }
    if (this.runState.pendingEnrichment) this.tryOpenEnrichment();
    this.updateHud();
  }

  updateHud() {
    if (this.hud) this.hud.update(this.runState);
    var ready = SP_Enrichment.getReadyEvolutions(this.runState);
    if (ready.length && !this._evoHintShown) {
      this._evoHintShown = true;
      this.hud.showEvolveHint('Evolve ready: ' + ready[0].result);
    }
  }

  resumeFromOverlay() {
    this.runState.pendingDraft = false;
    this.runState.pendingEnrichment = false;
    if (this.hud) this.hud.refreshStrip();
    this.scene.resume();
    this.updateHud();
  }

  endShift(won) {
    if (this.pit) this.pit.destroy();
    this.scene.stop('DraftScene');
    this.scene.stop('EnrichmentScene');
    var pet = ShelterPets.pickRandomPet();
    if (pet && pet.id && this.runState.petsHelpedThisRun.indexOf(pet.id) === -1) {
      this.runState.petsHelpedThisRun.push(pet.id);
    }
    this.scene.start('ShiftCompleteScene', {
      runState: this.runState,
      won: won,
      pet: pet,
      zoneId: this.zoneId,
    });
  }
}
