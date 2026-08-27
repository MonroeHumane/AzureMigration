/* ─── GameScene - main gameplay ───────────────────────────────────────────── */

class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) {
    this.levelNum      = data.level ?? 1;
    this.levelSeed     = typeof data.seed === 'number' ? data.seed : Date.now() >>> 0;
    this.roundActive   = true;
    this.transitioning = false;
    this.paused        = false;
    this.runStartedAt  = 0;
    this.deathCount    = data.deaths || 0;
    this.treatsCollected = 0;
    this.treatsTotal   = 0;
  }

  create() {
    const { HEIGHT } = CFG;

    this.levelData = generateLevel(this.levelNum, this.levelSeed);
    const lastPlat = this.levelData[this.levelData.length - 1];
    const worldW   = lastPlat.x + lastPlat.width + CFG.WORLD_PADDING;

    this.physics.world.setBounds(0, -600, worldW, HEIGHT + 2000, true, true, false, false);
    this.cameras.main.setBounds(0, 0, worldW, HEIGHT);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setBackgroundColor('#87CEEB');

    if (typeof foundBuildSky === 'function') {
      foundBuildSky(this, CFG.WIDTH);
    }
    if (typeof foundBuildWorldTerrain === 'function') {
      foundBuildWorldTerrain(this, worldW, CFG.GROUND_Y, this.levelSeed, this.levelData);
    }

    this.worldEndX = lastPlat.x + lastPlat.width;

    this.platforms = this.physics.add.staticGroup();
    if (typeof foundBuildPlatformSupports === 'function') {
      foundBuildPlatformSupports(this, this.levelData, CFG.GROUND_Y);
    }
    this._buildPlatforms(); // draws visuals + creates physics bodies + moving platforms

    const startPlat = this.levelData[0];
    this.player = new Player(this, startPlat.x + 128, startPlat.y);
    this.physics.add.collider(this.player.sprite, this.platforms);
    // Wire moving-platform colliders here — player must exist before this runs
    if (this._movingPlatData && this._movingPlatData.length) {
      for (const mp of this._movingPlatData) {
        this.physics.add.collider(this.player.sprite, mp.img);
      }
    }
    // One-way: checkCollision flags prevent side collisions; process callback
    // guards against the sky-launch bug (player partially above platform top
    // while still moving upward triggers checkCollision.up resolution upward).
    if (this.oneWayPlatGroup) {
      this.physics.add.collider(this.player.sprite, this.oneWayPlatGroup, null, (ps) => {
        return ps.body.velocity.y >= 0; // only collide when falling or stationary
      });
    }
    // Crumbling: only trigger when player is landing on top (blocked.down), not side contact
    if (this.crumblePlatGroup) {
      this.physics.add.collider(this.player.sprite, this.crumblePlatGroup, (ps, plat) => {
        if (ps.body.blocked.down && ps.body.velocity.y >= -20) {
          const cd = this._crumblePlatData.find(d => d.body === plat);
          if (cd && !cd.crumbling) this._startCrumble(cd);
        }
      });
    }

    if (typeof foundSpawnTreats === 'function') {
      const treats = foundSpawnTreats(this, this.levelData, this.levelSeed);
      this.treatsGroup = treats.group;
      this.treatsTotal = treats.total;
      this.physics.add.overlap(this.player.sprite, this.treatsGroup, (_p, treat) => {
        if (!treat.active || !treat.getData('treat')) {
          return;
        }
        treat.disableBody(true, true);
        treat.setVisible(false);
        this.treatsCollected += 1;
        if (typeof foundEmitTreatPickupBurst === 'function') {
          foundEmitTreatPickupBurst(this, treat.x, treat.y);
        } else if (typeof foundEmitTreatSparkle === 'function') {
          foundEmitTreatSparkle(this, treat.x, treat.y);
        }
        if (typeof FoundAudio !== 'undefined') {
          FoundAudio.collect();
        }
        this._updateTreatsHud();
      });
    }

    if (typeof foundSpawnPowerUps === 'function') {
      const powerUps = foundSpawnPowerUps(this, this.levelData, this.levelSeed, this.levelNum);
      this.powerUpsGroup = powerUps.group;
      this.physics.add.overlap(this.player.sprite, this.powerUpsGroup, (_p, pickup) => {
        const type = pickup.getData('powerUpType');
        if (!pickup.active || !type) {
          return;
        }
        if (typeof foundApplyPowerUp === 'function') {
          foundApplyPowerUp(this.player, type);
        }
        pickup.disableBody(true, true);
        pickup.setVisible(false);
        if (typeof foundEmitTreatSparkle === 'function') {
          foundEmitTreatSparkle(this, pickup.x, pickup.y);
        }
        this._updatePowerupHud();
      });
    }

    // Hidden ! blocks: levels 5+ — player must bonk from below to reveal powerup.
    if (typeof foundSpawnPowerUpBlocks === 'function' && this.levelNum >= 5) {
      const blocks = foundSpawnPowerUpBlocks(
        this, this.levelData, this.levelSeed, this.levelNum, this.powerUpsGroup
      );
      this.powerUpBlocksGroup = blocks.group;
      this.physics.add.overlap(this.player.sprite, this.powerUpBlocksGroup, (_p, block) => {
        if (!block.active || block.getData('activated')) {
          return;
        }
        // Only trigger when player is travelling upward and is below the block centre.
        const body = this.player.sprite.body;
        if (body && body.velocity.y < -30 && this.player.sprite.y > block.y) {
          if (typeof foundActivatePowerUpBlock === 'function') {
            foundActivatePowerUpBlock(this, block);
          }
        }
      });
    }

    if (typeof foundSpawnEnemies === 'function') {
      const enemies = foundSpawnEnemies(this, this.levelData, this.levelSeed, this.levelNum);
      this.enemiesGroup   = enemies.group;
      this._enemyWalkers  = enemies.walkers || [];
      this._enemyFlyers   = enemies.flyers  || [];
      this._enemyInvincible = false;
      if (this.enemiesGroup) {
        this.physics.add.collider(this.enemiesGroup, this.platforms);
        this.physics.add.overlap(this.player.sprite, this.enemiesGroup, (_p, enemy) => {
          if (!this._enemyInvincible) this._onEnemyContact(enemy);
        });
      }
    }

    this.cameras.main.startFollow(this.player.sprite, true, 0.08, 1.0);
    this._cameraLookAhead = 0;

    this.keys = Object.assign(
      this.input.keyboard.createCursorKeys(),
      {
        w:     this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        a:     this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        d:     this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        space: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        esc:   this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
      }
    );

    this.touch = new TouchControls(this);
    this._buildShelterZone(lastPlat);
    this._buildHud();
    this._buildPauseOverlay();
    this._buildMuteButton();

    this.keys.esc.on('down', () => this._togglePause());

    this.input.on('pointerdown', () => {
      if (typeof FoundAudio !== 'undefined') {
        FoundAudio.unlock();
      }
    });

    if (typeof foundShowLevelBanner === 'function') {
      foundShowLevelBanner(this, this.levelNum);
    }

    this.runStartedAt = this.time.now;

    if (typeof foundHasSeenTutorial === 'function' && !foundHasSeenTutorial()) {
      this._buildTutorialOverlay();
    }
  }

  update(time, delta) {
    if (!this.roundActive || this.paused) {
      return;
    }

    const touchFrame = this.touch && this.touch.enabled ? this.touch.poll() : null;
    this.player.update(this.keys, delta, touchFrame);
    this._updateProgressHud();
    this._updatePowerupHud();
    this._updateCameraLookAhead();

    // Sync moving platform visuals + carry player using teleport-per-frame (body.reset)
    if (this._movingPlatData && this._movingPlatData.length) {
      // setDirectControl() platforms are handled entirely by Phaser's tween+physics.
      // No manual sync needed here — kept as empty guard for future use.
    }

    // Walker enemy patrol
    if (this._enemyWalkers) {
      for (const e of this._enemyWalkers) {
        if (!e.active) continue;
        let dir = e.getData('dir');
        const xMin = e.getData('platLeft');
        const xMax = e.getData('platRight');
        if ((e.x <= xMin && dir < 0) || (e.body.blocked.left && dir < 0)) {
          dir = 1; e.setData('dir', 1); e.body.setVelocityX(70); e.setFlipX(false);
        } else if ((e.x >= xMax && dir > 0) || (e.body.blocked.right && dir > 0)) {
          dir = -1; e.setData('dir', -1); e.body.setVelocityX(-70); e.setFlipX(true);
        }
      }
    }

    // Flyer / floater enemy sine-wave movement
    if (this._enemyFlyers) {
      const t = this.time.now / 1000;
      for (const e of this._enemyFlyers) {
        if (!e.active) continue;
        const startY = e.getData('startY');
        const startX = e.getData('startX');
        const range  = e.getData('range');
        const speed  = e.getData('speed');
        const offset = e.getData('sineOffset');
        const amp    = e.getData('type') === 'floater' ? 22 : 12;
        e.setY(startY + Math.sin(t * 1.8 + offset) * amp);
        e.body.reset(e.x, e.y);
        const dir = e.getData('dir');
        if (e.x >= startX + range && dir > 0)       { e.setData('dir', -1); e.body.setVelocityX(-speed); e.setFlipX(true); }
        else if (e.x <= startX - range && dir < 0)  { e.setData('dir',  1); e.body.setVelocityX( speed); e.setFlipX(false); }
      }
    }

    if (this.player.y > CFG.HEIGHT + 128 && !this.transitioning) {
      this._onFall();
    }
  }

  _updateCameraLookAhead() {
    const body = this.player.sprite.body;
    const target = Phaser.Math.Clamp(body.velocity.x * 0.12, -48, 48);
    this._cameraLookAhead = Phaser.Math.Linear(this._cameraLookAhead, target, 0.08);
    this.cameras.main.setFollowOffset(this._cameraLookAhead, 0);
  }

  _buildHud() {
    const levelName = (CFG.LEVEL_NAMES && CFG.LEVEL_NAMES[this.levelNum]) || '';
    const title = levelName ? `Level ${this.levelNum} · ${levelName}` : `Level ${this.levelNum}`;
    const margin = 10;
    const pad = 12;
    const leftW = 320;
    const hasTreats = this.treatsTotal > 0;
    const hasPowerupRow = this.levelNum >= 5;
    const leftH = hasTreats || hasPowerupRow ? 96 : 62;
    const rightW = 260;
    const rightH = 38;
    const rightX = CFG.WIDTH - rightW - margin;

    const mk = (x, y, text, style) => {
      const uiStyle = Object.assign({ useNativeSize: true }, style);
      if (typeof foundUiText === 'function') {
        return foundUiText(this, x, y, text, uiStyle).setOrigin(0, 0);
      }
      return this.add.text(x, y, text, style).setOrigin(0, 0);
    };

    const addCard = (x, y, w, h) => {
      if (typeof foundDrawHudCard === 'function') {
        return foundDrawHudCard(this, x, y, w, h);
      }
      return this.add.rectangle(x, y, w, h, 0xffffff, 0.88)
        .setOrigin(0, 0).setStrokeStyle(2, 0x4a7c40, 0.35);
    };

    this.hudPanel = this.add.container(0, 0).setScrollFactor(0).setDepth(24);
    this.hudPanel.add(addCard(margin, margin, leftW, leftH));

    const targetIcon = this.textures.exists('found-ui-target')
      ? this.add.image(margin + pad + 7, margin + 42, 'found-ui-target').setDisplaySize(14, 14)
      : null;

    const titleText = mk(margin + pad, margin + 10, title, {
      fontSize: '20px',
      fontStyle: '600',
      color: '#1a1a1a',
    });
    const goalText = mk(margin + pad + (targetIcon ? 18 : 0), margin + 34, 'Reach the animal shelter', {
      fontSize: '15px',
      color: '#3a5028',
    });
    this.treatsHud = mk(margin + pad, margin + 56, '', {
      fontSize: '14px',
      color: '#6a5018',
    });
    this.powerupHud = mk(margin + pad, margin + 74, '', {
      fontSize: '12px',
      color: '#3b4f7a',
    });
    if (targetIcon) {
      this.hudPanel.add(targetIcon);
    }
    this.hudPanel.add([titleText, goalText, this.treatsHud]);
    if (hasPowerupRow) {
      this.hudPanel.add(this.powerupHud);
    }
    this._updateTreatsHud();
    this._updatePowerupHud();

    const progressPanel = this.add.container(0, 0).setScrollFactor(0).setDepth(24);
    progressPanel.add(addCard(rightX, margin, rightW, rightH));

    const trackX = rightX + pad;
    const trackY = margin + rightH - 11;
    const trackW = rightW - pad * 2;

    progressPanel.add(mk(trackX, margin + 8, 'Progress', {
      fontSize: '12px',
      fontStyle: '600',
      color: '#444',
    }));

    const track = this.add.rectangle(trackX, trackY, trackW, 8, 0x000000, 0.12)
      .setOrigin(0, 0.5);
    this.progressFill = this.add.rectangle(trackX + 2, trackY, 6, 6, 0x4a7c40, 1)
      .setOrigin(0, 0.5);
    progressPanel.add([track, this.progressFill]);
    this.progressBarW = trackW - 4;
  }

  _updateTreatsHud() {
    if (!this.treatsHud) {
      return;
    }
    if (this.treatsTotal <= 0) {
      this.treatsHud.setText('');
      this.treatsHud.setVisible(false);
      return;
    }
    this.treatsHud.setVisible(true);
    this.treatsHud.setText(`Treats ${this.treatsCollected} / ${this.treatsTotal}`);
  }

  _buildMuteButton() {
    const isMuted = () => (typeof FoundAudio !== 'undefined' && FoundAudio.isMuted());
    const buttonX = CFG.WIDTH - 18;
    const buttonY = CFG.HEIGHT - 18;
    const bg = this.add.rectangle(buttonX, buttonY, 40, 32, 0x000000, 0.34)
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(26)
      .setStrokeStyle(1, 0xffffff, 0.12);
    this.muteBtn = this.add.image(buttonX - 20, buttonY - 16, isMuted() ? 'found-ui-audio-off' : 'found-ui-audio-on')
      .setDisplaySize(18, 18)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(27);
    const hitArea = this.add.zone(buttonX - 20, buttonY - 16, 40, 32)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(28)
      .setInteractive({ useHandCursor: true });
    this.muteBtnBg = bg;
    this.muteBtnHitArea = hitArea;
    this.muteBtnHitArea.on('pointerup', () => {
      if (typeof FoundAudio !== 'undefined') {
        FoundAudio.toggleMute();
        this.muteBtn.setTexture(isMuted() ? 'found-ui-audio-off' : 'found-ui-audio-on');
      }
    });
  }

  _updatePowerupHud() {
    if (!this.powerupHud || !this.player || typeof this.player.getBuffSummary !== 'function') {
      return;
    }
    const summary = this.player.getBuffSummary();
    this.powerupHud.setText(summary ? `Boosts ${summary}` : 'Boosts none yet');
  }

  _updateProgressHud() {
    if (!this.progressFill || !this.worldEndX) {
      return;
    }
    const startX = this.levelData[0].x + 128;
    const pct = Phaser.Math.Clamp((this.player.x - startX) / (this.worldEndX - startX), 0, 1);
    this.progressFill.width = Math.max(4, this.progressBarW * pct);
  }

  _buildTutorialOverlay() {
    const W = CFG.WIDTH;
    const H = CFG.HEIGHT;
    const layer = this.add.container(0, 0).setScrollFactor(0).setDepth(60);
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55);

    const box = typeof foundUiText === 'function'
      ? foundUiText(this, W / 2, H * 0.46, [
        'How to play',
        '',
        '← → or A D - walk',
        '↑ Space W - jump',
        'Collect yarn treats (optional)',
        'Reach the animal shelter →',
      ].join('\n'), {
        fontSize: '17px',
        color: '#fff',
        align: 'center',
        backgroundColor: '#2a4030ee',
        padding: { x: 22, y: 16 },
        lineSpacing: 8,
      }).setOrigin(0.5)
      : this.add.text(W / 2, H * 0.46, 'How to play', { fontSize: '16px', color: '#fff' }).setOrigin(0.5);

    const dismiss = typeof foundUiText === 'function'
      ? foundUiText(this, W / 2, H * 0.68, '[ Got it ]', {
        fontSize: '18px',
        fontStyle: '600',
        color: '#ffd700',
        backgroundColor: '#333344',
        padding: { x: 16, y: 10 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      : this.add.text(W / 2, H * 0.68, '[ Got it ]', { fontSize: '16px', color: '#ffd700' })
        .setOrigin(0.5).setInteractive({ useHandCursor: true });

    const close = () => {
      if (typeof foundMarkTutorialSeen === 'function') {
        foundMarkTutorialSeen();
      }
      layer.destroy();
    };
    dismiss.on('pointerup', close);
    this.input.keyboard.once('keydown-SPACE', close);
    layer.add([dim, box, dismiss]);
  }

  _buildPauseOverlay() {
    const W = CFG.WIDTH;
    const H = CFG.HEIGHT;

    this.pauseLayer = this.add.container(0, 0).setScrollFactor(0).setDepth(50).setVisible(false);
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55);
    const title = this.add.text(W / 2, H * 0.38, 'Paused', {
      fontSize: '34px',
      fontFamily: 'Georgia, serif',
      color: '#fff',
    }).setOrigin(0.5);

    const resume = this.add.text(W / 2, H * 0.55, '[ RESUME ]', {
      fontSize: '18px',
      color: '#ffd700',
      backgroundColor: '#333344',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    resume.on('pointerup', () => this._togglePause(false));

    const menu = this.add.text(W / 2, H * 0.68, '← Main Menu', {
      fontSize: '13px',
      color: '#ccc',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    menu.on('pointerup', () => {
      this.scene.start('MainMenu');
    });

    this.pauseLayer.add([dim, title, resume, menu]);
  }

  _togglePause(forceState) {
    if (!this.roundActive) {
      return;
    }
    this.paused = typeof forceState === 'boolean' ? forceState : !this.paused;
    this.pauseLayer.setVisible(this.paused);
    this.physics.world.isPaused = this.paused;
    if (this.paused) {
      this.tweens.pauseAll();
      if (this._savedTimeScale === undefined) {
        this._savedTimeScale = this.time.timeScale;
      }
      this.time.timeScale = 0;
    } else {
      this.tweens.resumeAll();
      this.time.timeScale = this._savedTimeScale !== undefined ? this._savedTimeScale : 1;
    }
  }

  _buildPlatforms() {
    const PH   = CFG.PLATFORM_HEIGHT;
    const lNum = this.levelNum;
    const lSeed = this.levelSeed;
    const colors = typeof foundGetPlatformColors === 'function'
      ? foundGetPlatformColors(lNum)
      : { body: 0x5a8a3c, top: 0x7ec84a, shadow: 0x2a4a1c, topH: 5 };
    const shelterC = { body: 0x8a6040, top: 0xc09060, shadow: 0x4a2c10, topH: 5 };

    this._movingPlatData  = [];
    this._crumblePlatData = [];
    this.oneWayPlatGroup  = this.physics.add.staticGroup();
    this.crumblePlatGroup = this.physics.add.staticGroup();

    // Shared graphics object for all STATIC + ONE-WAY platform visuals
    const g = this.add.graphics().setDepth(9);

    this.levelData.forEach((plat) => {
      const cx = plat.x + plat.width / 2;
      const cy = plat.y + PH / 2;
      const isShelter = plat.type === 'shelter';
      const isStart   = plat.type === 'start';
      const isInterior = !isStart && !isShelter;

      // Deterministic per-platform hash to decide movement and visual height
      const hash = typeof foundPlatformHash32 === 'function'
        ? foundPlatformHash32(plat, lNum, lSeed) : 0;

      // Visual height varies so platforms feel chunky with depth.
      // Physics body is ALWAYS exactly PH (26px) — only the drawn art extends downward.
      const VIS_HEIGHTS = [26, 32, 38];
      const vH = (isStart || isShelter) ? 44 : VIS_HEIGHTS[(hash >> 2) % 3];

      // Moving platforms: levels 5+, scaling chance
      const movePct    = lNum >= 17 ? 28 : lNum >= 13 ? 22 : lNum >= 9 ? 16 : lNum >= 5 ? 10 : 0;
      const isMoving   = isInterior && ((hash >>> 0) % 100 < movePct);
      // One-way (pass-through from below): levels 2+, 20% of non-moving interior
      const isOneWay   = !isMoving && isInterior && lNum >= 2 && ((hash >> 6) % 100) < 20;
      // Crumbling (shake + fall after landing): levels 3+, 15% of remaining interior
      const isCrumbling = !isMoving && !isOneWay && isInterior && lNum >= 3 && ((hash >> 12) % 100) < 15;

      const c = isShelter ? shelterC : colors;
      const topH = c.topH || 5;

      if (isMoving) {
        // ── Moving platform: setDirectControl() + setFrictionX(1) ──
        // Phaser derives velocity from position delta each frame so the player
        // is carried correctly. setFrictionX(1) applies horizontal friction so
        // the player slides with horizontal movers naturally.
        const travel  = 60 + ((hash >> 4) & 0x3F);         // 60-123 px each way
        const travelV = 40 + ((hash >> 20) & 0x1F);         // 40-71 px vertical
        const period  = 2000 + ((hash >> 10) % 8) * 500;   // 2000-5500 ms
        const topH    = c.topH || 5;
        // 30% of movers go vertically instead of horizontally
        const isVertical = ((hash >> 16) % 100) < 30;

        const bodyR = this.add.rectangle(cx, plat.y + vH / 2 - 1,  plat.width, vH - 2, c.body).setDepth(9);
        const topR  = this.add.rectangle(cx, plat.y + topH / 2,    plat.width, topH,   c.top).setDepth(10);
        const botR  = this.add.rectangle(cx, plat.y + vH - 1,      plat.width, 2,      c.shadow).setDepth(10);
        const hlR   = this.add.rectangle(cx, plat.y + 1,           plat.width - 8, 1,  0xffffff).setDepth(11).setAlpha(0.18);

        const img = this.physics.add.image(cx, cy, 'pixel');
        img.setDisplaySize(plat.width, PH);
        img.setVisible(false);
        img.setDirectControl();  // position → velocity conversion built in
        img.setImmovable();
        img.setFrictionX(1);     // carry player via surface friction

        if (isVertical) {
          // Tween only the physics image; sync visual rects via onUpdate offsets
          const bodyOff = plat.y + vH / 2 - 1 - cy;
          const topOff  = plat.y + topH / 2 - cy;
          const botOff  = plat.y + vH - 1 - cy;
          const hlOff   = plat.y + 1 - cy;
          this.tweens.add({
            targets: img,
            y: { from: cy - travelV, to: cy + travelV },
            duration: period,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            onUpdate: () => {
              bodyR.y = img.y + bodyOff;
              topR.y  = img.y + topOff;
              botR.y  = img.y + botOff;
              hlR.y   = img.y + hlOff;
            },
          });
        } else {
          // Horizontal: tween all objects together.
          // Start at natural position (cx) and travel to cx+travel first so
          // platforms don't snap to cx-travel at spawn.
          const startRight = ((hash >> 18) & 1) === 0;
          this.tweens.add({
            targets: [img, bodyR, topR, botR, hlR],
            x: startRight ? cx + travel : cx - travel,
            duration: period / 2,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }

        // Pulse top stripe so player can identify a moving platform
        this.tweens.add({
          targets: topR,
          alpha: 0.55,
          duration: 480,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          delay: (hash & 0xFF) * 4,
        });

        this._movingPlatData.push({ img });
        // Collider registered in create() after new Player()
      } else if (isOneWay) {
        // ── One-way platform: warm wood-plank visual, pass-through from below ──
        const owBody = this.oneWayPlatGroup.create(cx, cy, 'pixel');
        owBody.setDisplaySize(plat.width, PH);
        owBody.setVisible(false);
        owBody.refreshBody();
        // Only top face active: player passes through from below, lands from above
        owBody.body.checkCollision.down  = false;
        owBody.body.checkCollision.left  = false;
        owBody.body.checkCollision.right = false;
        // Thin plank visual — consistent warm-wood look across all acts so
        // players learn 'plank = can jump through' regardless of act colour.
        const owVH = 10; // thinner than regular platforms to signal passability
        g.fillStyle(0x5c3810, 1);
        g.fillRect(plat.x, plat.y + owVH - 2, plat.width, 2); // shadow
        g.fillStyle(0xb07830, 1);
        g.fillRect(plat.x, plat.y, plat.width, owVH - 2);     // wood body
        g.fillStyle(0xdcaa58, 1);
        g.fillRect(plat.x, plat.y, plat.width, 3);             // bright top edge
        g.fillStyle(0xffffff, 0.22);
        g.fillRect(plat.x + 2, plat.y + 1, plat.width - 4, 1); // sheen
        // Wood grain lines (horizontal)
        const grainCount = Math.max(1, Math.floor(plat.width / 56));
        for (let gr = 0; gr < grainCount; gr++) {
          const gx = plat.x + 12 + gr * (plat.width / (grainCount + 1));
          g.fillStyle(0x8a5c28, 0.4);
          g.fillRect(gx, plat.y + 3, 2, owVH - 5);
        }
        // Upward chevron hints on top edge
        const chvCnt = Math.max(2, Math.floor(plat.width / 80));
        const chvSpc = plat.width / (chvCnt + 1);
        for (let ch = 1; ch <= chvCnt; ch++) {
          const chx = plat.x + ch * chvSpc;
          g.fillStyle(0xfff0b0, 0.7);
          g.fillTriangle(chx - 5, plat.y, chx + 5, plat.y, chx, plat.y - 5);
        }
      } else if (isCrumbling) {
        // ── Crumbling platform: shakes then falls when stood on ──
        const cc  = { body: 0x8a3a22, top: 0xc45a38, shadow: 0x4a1a0c, topH: 5 };
        const bR  = this.add.rectangle(cx, plat.y + vH / 2 - 1,  plat.width, vH - 2, cc.body).setDepth(9);
        const tR  = this.add.rectangle(cx, plat.y + cc.topH / 2,  plat.width, cc.topH, cc.top).setDepth(10);
        const boR = this.add.rectangle(cx, plat.y + vH - 1,       plat.width, 2,       cc.shadow).setDepth(10);
        const cb  = this.crumblePlatGroup.create(cx, cy, 'pixel');
        cb.setDisplaySize(plat.width, PH).setVisible(false).refreshBody();
        this._crumblePlatData.push({
          body: cb,
          rects: [bR, tR, boR],
          origX: cx,  origY: cy,
          origRY: [bR.y, tR.y, boR.y],
          crumbling: false,
        });
        // Pulse warning so player recognises crumbling platforms
        this.tweens.add({
          targets: [bR, tR, boR],
          alpha: 0.65,
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          delay: (hash & 0xFF) * 5,
        });
      } else {
        // ── Static platform ──────────────────────────────────────────
        const body = this.platforms.create(cx, cy, 'pixel');
        body.setDisplaySize(plat.width, PH);
        body.setVisible(false);
        body.refreshBody();
        body.setDepth(1);

        // Draw with visual height — shadow + body + top stripe + highlight
        g.fillStyle(c.shadow, 1);
        g.fillRect(plat.x, plat.y + vH - 2, plat.width, 2);
        g.fillStyle(c.body, 1);
        g.fillRect(plat.x, plat.y, plat.width, vH - 2);
        g.fillStyle(c.top, 1);
        g.fillRect(plat.x, plat.y, plat.width, topH);
        g.fillStyle(0xffffff, 0.18);
        g.fillRect(plat.x + 2, plat.y + 1, plat.width - 4, 1);
      }

      if (isShelter) this._drawShelter(plat);
    });
  }

  _startCrumble(cd) {
    cd.crumbling = true;
    // Phase 1: rapid shake (~240ms)
    this.tweens.add({
      targets: cd.rects,
      x: { from: cd.origX - 4, to: cd.origX + 4 },
      duration: 55,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        cd.rects.forEach(r => { r.x = cd.origX; });
        // Phase 2: fall + fade (300ms)
        this.tweens.add({
          targets: cd.rects,
          y: '+=' + 80,
          alpha: 0,
          duration: 300,
          ease: 'Quad.easeIn',
          onComplete: () => {
            cd.body.body.enable = false;
            // Phase 3: restore after 2.8s
            this.time.delayedCall(2800, () => {
              if (!this.scene.isActive()) return;
              cd.rects.forEach((r, i) => { r.y = cd.origRY[i]; r.x = cd.origX; r.alpha = 1; });
              cd.body.body.reset(cd.origX, cd.origY);
              cd.body.body.enable = true;
              cd.crumbling = false;
            });
          },
        });
      },
    });
  }

  _onEnemyContact(enemy) {
    if (!enemy || !enemy.active) return;
    const ps = this.player.sprite;
    // Stomp: player falling downward and above enemy centre
    if (ps.body.velocity.y > 80 && ps.y < enemy.y) {
      enemy.setActive(false).setVisible(false);
      if (enemy.body) enemy.body.enable = false;
      ps.body.setVelocityY(-320);
      return;
    }
    // Knockback + 1 s invincibility window
    const dir = ps.x < enemy.x ? -1 : 1;
    ps.body.setVelocityX(dir * 340);
    ps.body.setVelocityY(-220);
    this._enemyInvincible = true;
    ps.setAlpha(0.4);
    this.time.delayedCall(1000, () => {
      this._enemyInvincible = false;
      if (ps.active) ps.setAlpha(1);
    });
  }

  _drawShelter(plat) {
    const wallW = 208;
    const wallX = plat.x + plat.width - wallW - 24;
    if (typeof foundDrawShelterBuilding === 'function') {
      foundDrawShelterBuilding(this, wallX, plat.y, { depth: 6, signDepth: 10 });
    }
  }

  _buildShelterZone(shelterPlat) {
    const zoneX = shelterPlat.x + shelterPlat.width - 180;
    const zoneY = shelterPlat.y - 72;

    this.shelterZone = this.add.zone(zoneX, zoneY, 140, 140).setOrigin(0, 0);
    this.physics.world.enable(this.shelterZone, Phaser.Physics.Arcade.STATIC_BODY);

    this.physics.add.overlap(this.player.sprite, this.shelterZone, () => {
      if (!this.transitioning) {
        this.transitioning = true;
        this.roundActive   = false;
        this._onReachShelter();
      }
    });
  }

  _onReachShelter() {
    const elapsed = this.time.now - this.runStartedAt;
    const shelterPlat = this.levelData[this.levelData.length - 1];

    if (typeof foundEmitShelterCelebration === 'function') {
      foundEmitShelterCelebration(this, this.player.x, shelterPlat.y);
    }
    if (typeof FoundAudio !== 'undefined') {
      FoundAudio.win();
    }

    this.cameras.main.flash(200, 255, 248, 220);

    this.player.playPaw(() => {
      this.cameras.main.fadeOut(900, 255, 245, 220);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('LevelComplete', {
          level: this.levelNum,
          seed: this.levelSeed,
          timeMs: elapsed,
          deaths: this.deathCount,
          treats: this.treatsCollected,
          treatsTotal: this.treatsTotal,
        });
      });
    });
  }

  _onFall() {
    this.transitioning = true;
    this.roundActive   = false;
    this.deathCount += 1;
    this.cameras.main.shake(120, 0.006);

    this.player.playScare(() => {
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('RoundOver', {
          level: this.levelNum,
          seed: this.levelSeed,
          deaths: this.deathCount,
        });
      });
    });
  }
}
