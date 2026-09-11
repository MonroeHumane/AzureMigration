/* ─── GameScene — pseudo-3D 3-lane chase loop ───────────────────────────── */

class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) {
    this.companionIndex = (data && typeof data.companionIndex === 'number') ? data.companionIndex : 0;
  }

  create() {
    this.layout = Perspective.layout(this.scale.width, this.scale.height);
    this.cameras.main.setBackgroundColor('#0a1f2e');

    this.worldGfx = this.add.graphics().setDepth(1);
    this.fxGfx = this.add.graphics().setDepth(15);

    this.rand = createSeededRng(Date.now() >>> 0);
    this.cameraZ = 0;
    this.speed = CFG.INITIAL_SPEED;
    this.frameCount = 0;
    this.idCounter = 0;
    this.nextObstacleZ = CFG.SPAWN_Z * 0.35;
    this.lastWasHard = false;
    this.obstacles = [];
    this.collectibles = [];
    this.isGameOver = false;
    this.debug = new URLSearchParams(window.location.search).get('debug') === '1';

    this.availablePets = (typeof ShelterRunPets !== 'undefined') ? ShelterRunPets.drawForRun(30) : [];
    this.collectedPetIds = [];
    this.collectedPets = [];

    this.player = new Player(this, CFG.COMPANIONS[this.companionIndex].tint);

    this._setupInput();
    this._buildHud();
    try { document.documentElement.classList.add('sr-running'); } catch (e) {}

    this.scale.on('resize', this._onResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this._onResize, this);
      try {
        document.documentElement.classList.remove('sr-running');
        const lines = document.getElementById('srSpeedLines');
        if (lines) lines.classList.remove('is-active');
      } catch (e) {}
    });
  }

  _onResize() {
    this.layout = Perspective.layout(this.scale.width, this.scale.height);
    this._layoutHud();
    if (this.player) this.player._syncPos();
  }

  _setupInput() {
    const kb = this.input.keyboard;
    this.keys = kb.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      r: Phaser.Input.Keyboard.KeyCodes.R,
      esc: Phaser.Input.Keyboard.KeyCodes.ESC,
    });
    this.touch = new TouchControls(this);
    if (kb) {
      kb.on('keydown-R', () => {
        if (!this.isGameOver) this.scene.start('Game', { companionIndex: this.companionIndex });
      });
      kb.on('keydown-ESC', () => {
        if (!this.isGameOver) this.scene.start('MainMenu');
      });
    }
  }

  _buildHud() {
    this._hudBg = this.add.rectangle(0, 0, 120, 36, 0x0b1a16, 0.55).setScrollFactor(0).setDepth(30);
    this._hudBgPets = this.add.rectangle(0, 0, 100, 36, 0x0b1a16, 0.55).setScrollFactor(0).setDepth(30);
    this._hudBgLives = this.add.rectangle(0, 0, 90, 36, 0x0b1a16, 0.55).setScrollFactor(0).setDepth(30);
    this.distanceText = srUiText(this, 0, 0, '0 m', { fontSize: '22px', color: '#ffffff' }).setDepth(31);
    this.petsText = srUiText(this, 0, 0, '🐾 0', { fontSize: '22px', color: '#ffd166' }).setDepth(31);
    this.livesText = srUiText(this, 0, 0, '❤ 2', { fontSize: '20px', color: '#ff8a8a' }).setDepth(31);
    this._hudHint = srUiText(this, 0, 0, '', { fontSize: '13px', color: '#9ec4b8' }).setDepth(31).setAlpha(0.95);
    this._toastText = srUiText(this, 0, 0, '', { fontSize: '16px', color: '#ffd166' }).setDepth(32).setAlpha(0);
    this._layoutHud();

    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const hints = document.getElementById('srKeyHints');
    if (hints) {
      if (coarse) hints.style.display = 'none';
      else {
        hints.style.display = '';
        hints.innerHTML =
          '<span class="sr-key-hints__item"><kbd>←</kbd><kbd>→</kbd> lane</span>' +
          '<span class="sr-key-hints__item"><kbd>↑</kbd>/<kbd>Space</kbd> jump</span>' +
          '<span class="sr-key-hints__item"><kbd>↓</kbd> slide</span>' +
          '<span class="sr-key-hints__item"><kbd>R</kbd> restart · <kbd>Esc</kbd> menu</span>';
      }
    }
    this.events.once('shutdown', () => { if (hints) hints.style.display = 'none'; });
  }

  _layoutHud() {
    const W = this.scale.width;
    const padX = Math.max(16, Math.min(28, W * 0.04));
    const padY = Math.max(18, Math.min(36, this.scale.height * 0.04));
    const fontSize = W < 420 ? '18px' : '22px';
    this.distanceText.setFontSize(fontSize).setPosition(padX + 48, padY);
    this.petsText.setFontSize(fontSize).setPosition(W - padX - 40, padY);
    this.livesText.setFontSize(W < 420 ? '16px' : '20px').setPosition(W / 2, padY);
    if (this._hudBg) this._hudBg.setPosition(padX + 48, padY).setSize(110, 34);
    if (this._hudBgPets) this._hudBgPets.setPosition(W - padX - 40, padY).setSize(96, 34);
    if (this._hudBgLives) this._hudBgLives.setPosition(W / 2, padY).setSize(88, 34);
    if (this._toastText) this._toastText.setPosition(W / 2, padY + 48);
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (this._hudHint) {
      if (coarse) {
        this._hudHint.setText('Swipe · ◀▶ lane · ↑ jump · ↓ slide');
        this._hudHint.setPosition(W / 2, padY + 30);
        this._hudHint.setFontSize(W < 420 ? '11px' : '13px');
        this.tweens.add({ targets: this._hudHint, alpha: 0, delay: 3200, duration: 600 });
      } else this._hudHint.setText('');
    }
  }

  _softToast(msg) {
    if (!this._toastText) return;
    this._toastText.setText(msg).setAlpha(1);
    this.tweens.killTweensOf(this._toastText);
    this.tweens.add({ targets: this._toastText, alpha: 0, delay: 900, duration: 350 });
  }

  _fxReduced() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  _pulseHurtFlash() {
    const el = document.getElementById('srHurtFlash');
    if (!el) return;
    el.classList.remove('is-on');
    void el.offsetWidth;
    el.classList.add('is-on');
    setTimeout(() => el.classList.remove('is-on'), this._fxReduced() ? 200 : 480);
  }

  _syncSpeedFx() {
    const lines = document.getElementById('srSpeedLines');
    if (!lines) return;
    const t = Math.max(0, Math.min(1, (this.speed - CFG.INITIAL_SPEED) / (CFG.MAX_SPEED - CFG.INITIAL_SPEED || 1)));
    lines.style.setProperty('--sr-speed-opacity', String(0.1 + t * 0.5));
    lines.style.setProperty('--sr-speed-duration', (0.75 - t * 0.4).toFixed(2) + 's');
    lines.classList.toggle('is-active', !this.isGameOver && t > 0.02);
  }

  update(time, delta) {
    if (this.isGameOver) return;
    const dtMs = Math.min(50, delta);
    const frames = dtMs / (1000 / 60);

    this._readInput();
    this.player.update(dtMs);

    this.speed = Math.min(CFG.MAX_SPEED, this.speed + CFG.SPEED_INCREASE * frames);
    this.cameraZ += this.speed * frames;
    this.frameCount++;

    const meters = this.cameraZ * CFG.DIST_SCALE;
    this.distanceText.setText(Math.floor(meters) + ' m');
    this.livesText.setText('❤ ' + this.player.lives);

    this._spawnAhead(meters);
    this._checkCollisions();
    this._prune();
    this._renderWorld();
    this._syncSpeedFx();
  }

  _readInput() {
    const t = this.touch.poll();
    if (Phaser.Input.Keyboard.JustDown(this.keys.left) || Phaser.Input.Keyboard.JustDown(this.keys.a) || t.leftPressed) {
      this.player.changeLane(-1);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.right) || Phaser.Input.Keyboard.JustDown(this.keys.d) || t.rightPressed) {
      this.player.changeLane(1);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.up) || Phaser.Input.Keyboard.JustDown(this.keys.w) ||
        Phaser.Input.Keyboard.JustDown(this.keys.space) || t.jumpPressed) {
      this.player.jump();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.down) || Phaser.Input.Keyboard.JustDown(this.keys.s) || t.slidePressed) {
      this.player.slide();
    }
  }

  _spawnAhead(meters) {
    const frontZ = this.cameraZ + CFG.SPAWN_Z;
    while (this.nextObstacleZ < frontZ) {
      const pack = srSpawnCluster(this.rand, this.nextObstacleZ, meters, this.idCounter);
      this.idCounter = pack.idCounter;
      for (let i = 0; i < pack.obstacles.length; i++) this.obstacles.push(pack.obstacles[i]);
      for (let j = 0; j < pack.collectibles.length; j++) this.collectibles.push(pack.collectibles[j]);
      const gap = srNextGap(this.rand, meters, this.lastWasHard);
      this.lastWasHard = !!pack.hard;
      this.nextObstacleZ += gap;
    }
  }

  _checkCollisions() {
    const p = this.player;
    const lane = p.effectiveLane;
    const camZ = this.cameraZ;
    const pz = CFG.PLAYER_Z;

    for (let i = 0; i < this.collectibles.length; i++) {
      const c = this.collectibles[i];
      if (c.collected) continue;
      const depth = c.worldZ - camZ;
      if (Math.abs(depth - pz) > 70) continue;
      if (c.lane !== lane) continue;
      c.collected = true;
      this._collectPet();
    }

    if (p.isInvincible) return;

    for (let i = 0; i < this.obstacles.length; i++) {
      const obs = this.obstacles[i];
      if (obs.passed) continue;
      const depth = obs.worldZ - camZ;
      if (depth > pz + 110 || depth < pz - 90) continue;
      if (obs.lane !== lane) {
        if (depth < pz) obs.passed = true;
        continue;
      }
      let hit = false;
      if (obs.type === SR_OBSTACLE_TYPES.LANE_BLOCK) hit = true;
      else if (obs.type === SR_OBSTACLE_TYPES.LOW) hit = p.worldY < CFG.LOW_WALL_HEIGHT * 0.85;
      else if (obs.type === SR_OBSTACLE_TYPES.HIGH) hit = !p.isSliding && p.worldY < CFG.PLAYER_WORLD_HEIGHT * 0.55;

      if (hit) {
        obs.passed = true;
        this._onHit();
        return;
      }
      if (depth < pz) obs.passed = true;
    }
  }

  _collectPet() {
    const pet = this.availablePets.length ? this.availablePets.pop() : null;
    if (pet) {
      this.collectedPetIds.push(pet.id);
      this.collectedPets.push(pet);
      this._softToast('🐾 ' + (pet.name || 'Friend') + ' rescued!');
    } else {
      this._softToast('🐾 Rescued!');
    }
    this.petsText.setText('🐾 ' + this.collectedPetIds.length);
  }

  _onHit() {
    this._pulseHurtFlash();
    const dead = this.player.hit();
    if (dead) this._gameOver();
    else this._softToast('Oof! ❤ ' + this.player.lives + ' left');
  }

  _prune() {
    const minZ = this.cameraZ - 250;
    this.obstacles = this.obstacles.filter((o) => o.worldZ > minZ);
    this.collectibles = this.collectibles.filter((c) => !c.collected && c.worldZ > minZ);
  }

  _renderWorld() {
    const L = this.layout;
    const g = this.worldGfx;
    g.clear();
    Perspective.drawSky(g, L);
    Perspective.drawTrack(g, L, this.cameraZ);

    const drawList = [];
    for (let i = 0; i < this.obstacles.length; i++) {
      const o = this.obstacles[i];
      const d = o.worldZ - this.cameraZ;
      if (d > L.nearZ && d < L.farZ) drawList.push({ kind: 'obs', z: o.worldZ, o: o, d: d });
    }
    for (let i = 0; i < this.collectibles.length; i++) {
      const c = this.collectibles[i];
      if (c.collected) continue;
      const d = c.worldZ - this.cameraZ;
      if (d > L.nearZ && d < L.farZ) drawList.push({ kind: 'col', z: c.worldZ, c: c, d: d });
    }
    drawList.sort((a, b) => b.z - a.z);
    for (let i = 0; i < drawList.length; i++) {
      const item = drawList[i];
      if (item.kind === 'obs') Perspective.drawObstacle(g, L, item.o, item.d);
      else Perspective.drawCollectible(g, L, item.c, item.d, this.frameCount);
    }

    this.fxGfx.clear();
    if (this.debug) {
      this.fxGfx.lineStyle(1, 0x00ff88, 0.5);
      this.fxGfx.strokeRect(L.centerX - 40, L.playerScreenY - 80, 80, 80);
    }
  }

  _gameOver() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this._pulseHurtFlash();
    this._syncSpeedFx();
    const finalMeters = Math.floor(this.cameraZ * CFG.DIST_SCALE);
    const payload = {
      distanceMeters: finalMeters,
      collectedPetIds: this.collectedPetIds,
      collectedPets: this.collectedPets,
      companionIndex: this.companionIndex,
    };
    const delay = this._fxReduced() ? 60 : 220;
    this.time.delayedCall(delay, () => this.scene.start('RoundOver', payload));
  }
}
