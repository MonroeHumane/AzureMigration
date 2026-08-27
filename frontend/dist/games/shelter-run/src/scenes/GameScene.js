/* ─── GameScene - the run itself ────────────────────────────────────────── */

const SR_OBSTACLE_H = { single_jump: 74, single_duck: 26, wide: 140 };
const SR_JUMP_CLEAR_Y = 46;      // how far above groundY counts as "cleared" a jump obstacle
const SR_DUCK_OVERHEAD_Y = 40;   // overhead bar sits this far above groundY
const SR_COLLECTIBLE_Y_OFFSET = 90;
const SR_COLLIDE_RANGE = 46;

class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) {
    this.companionIndex = (data && typeof data.companionIndex === 'number') ? data.companionIndex : 0;
  }

  create() {
    // Read from this.scale, not the fixed CFG.WIDTH/HEIGHT design constants
    // - the canvas is sized to the actual device viewport (main.js's
    // Scale.RESIZE setup), which on a portrait phone is nothing like the
    // 1280x720 box these ratios were tuned against.
    this.groundY = this.scale.height * CFG.GROUND_Y_RATIO;

    this.cameras.main.setBackgroundColor('#3a4a5a');
    this._drawGround();

    this.player = new Player(this);
    this.player.setTint(CFG.COMPANIONS[this.companionIndex].tint);

    this.rand = createSeededRng(Date.now() >>> 0);
    this.nextSpawnX = CFG.SPAWN_X;
    this.lastSpawn = null;
    this.spawns = []; // { obj, labelObj, type, isCollectible, resolved }

    this.availablePets = (typeof ShelterRunPets !== 'undefined') ? ShelterRunPets.drawForRun(30) : [];
    this.collectedPetIds = [];
    this.distancePx = 0;
    this.scrollSpeed = CFG.BASE_SCROLL_SPEED;
    this.isGameOver = false;

    this._setupInput();
    this._buildHud();

    // A device rotation mid-run changes this.scale.width/height under us -
    // redraw the ground/HUD at the new size rather than leaving them sized
    // for the orientation the run started in.
    this.scale.on('resize', this._onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this._onResize, this));
  }

  _onResize() {
    if (this.groundBg) this.groundBg.destroy();
    this.groundY = this.scale.height * CFG.GROUND_Y_RATIO;
    this._drawGround();
    if (this.player) this.player.groundY = this.groundY;
    if (this.petsText) this.petsText.setX(this.scale.width - 130);
  }

  _drawGround() {
    const g = this.add.graphics();
    g.fillStyle(0x2c3a44, 1);
    g.fillRect(0, this.groundY, this.scale.width, this.scale.height - this.groundY);
    g.fillStyle(0x233038, 1);
    for (let x = 0; x < this.scale.width; x += 64) {
      g.fillRect(x, this.groundY, 40, 6);
    }
    this.groundBg = g;
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
    });
    this.touch = new TouchControls(this);
  }

  _buildHud() {
    this.distanceText = srUiText(this, 130, 40, '0 m', { fontSize: '28px', color: '#ffffff' });
    this.petsText = srUiText(this, this.scale.width - 130, 40, '🐾 0', { fontSize: '28px', color: '#ffffff' });
  }

  update(time, delta) {
    if (this.isGameOver) return;
    const dt = delta / 1000;

    this._readInput();
    this.player.update();

    const meters = this.distancePx / CFG.PX_PER_METER;
    this.scrollSpeed = Math.min(
      CFG.MAX_SCROLL_SPEED,
      CFG.BASE_SCROLL_SPEED + meters * CFG.SPEED_RAMP_PER_M
    );
    this.distancePx += this.scrollSpeed * dt;
    this.distanceText.setText(Math.floor(this.distancePx / CFG.PX_PER_METER) + ' m');

    this._updateSpawns(dt, meters);
    this._checkCollisions();
  }

  _readInput() {
    const t = this.touch.poll();

    if (Phaser.Input.Keyboard.JustDown(this.keys.left) || Phaser.Input.Keyboard.JustDown(this.keys.a) || t.dodgeLeftPressed) {
      this.player.dodge(-1);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.right) || Phaser.Input.Keyboard.JustDown(this.keys.d) || t.dodgeRightPressed) {
      this.player.dodge(1);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.up) || Phaser.Input.Keyboard.JustDown(this.keys.w) || Phaser.Input.Keyboard.JustDown(this.keys.space) || t.jumpPressed) {
      this.player.jump();
    }
    const duckHeld = this.keys.down.isDown || this.keys.s.isDown || t.duckHeld;
    this.player.setDuck(duckHeld);
  }

  _updateSpawns(dt, meters) {
    while (this.nextSpawnX < CFG.SPAWN_X + 600) {
      const spawn = srGenerateNextSpawn(this.rand, this.nextSpawnX, this.lastSpawn, meters);
      this._createSpawnVisual(spawn);
      this.lastSpawn = spawn;
      this.nextSpawnX = spawn.x;
    }

    for (let i = this.spawns.length - 1; i >= 0; i--) {
      const s = this.spawns[i];
      s.obj.x -= this.scrollSpeed * dt;
      if (s.labelObj) s.labelObj.x = s.obj.x;
      if (Array.isArray(s.extraObjs)) {
        s.extraObjs.forEach((o) => { o.x -= this.scrollSpeed * dt; });
      }
      if (s.obj.x < CFG.DESPAWN_X) {
        this._destroySpawn(s);
        this.spawns.splice(i, 1);
      }
    }
  }

  _createSpawnVisual(spawn) {
    const x = spawn.x;

    if (spawn.isCollectible) {
      const obj = this.add.circle(x, this.groundY - SR_COLLECTIBLE_Y_OFFSET, 22, 0xffd166);
      obj.setStrokeStyle(3, 0xffffff);
      spawn.labelObj = this.add.text(x, this.groundY - SR_COLLECTIBLE_Y_OFFSET, '🐾', { fontSize: '20px' }).setOrigin(0.5);
      spawn.obj = obj;
    } else if (spawn.type === SR_OBSTACLE_TYPES.SINGLE_JUMP) {
      const h = SR_OBSTACLE_H.single_jump;
      spawn.obj = this.add.rectangle(x, this.groundY - h / 2, 40, h, 0xd9534f);
    } else if (spawn.type === SR_OBSTACLE_TYPES.SINGLE_DUCK) {
      const h = SR_OBSTACLE_H.single_duck;
      spawn.obj = this.add.rectangle(x, this.groundY - SR_DUCK_OVERHEAD_Y - h / 2, 46, h, 0xf0ad4e);
    } else {
      // WIDE: a tall barrier spanning most of the screen height at ground
      // level; only clearable by dodging (jump/duck don't save you).
      const h = SR_OBSTACLE_H.wide;
      spawn.obj = this.add.rectangle(x, this.groundY - h / 2, 80, h, 0x8b5cf6);
    }

    this.spawns.push(spawn);
  }

  _destroySpawn(spawn) {
    if (spawn.obj) spawn.obj.destroy();
    if (spawn.labelObj) spawn.labelObj.destroy();
    if (Array.isArray(spawn.extraObjs)) spawn.extraObjs.forEach((o) => o.destroy());
  }

  _checkCollisions() {
    const playerX = this.player.sprite.x;

    for (let i = this.spawns.length - 1; i >= 0; i--) {
      const s = this.spawns[i];
      if (s.resolved) continue;
      const dx = Math.abs(s.obj.x - playerX);
      if (dx > SR_COLLIDE_RANGE) continue;

      if (s.isCollectible) {
        this._collectPet(s);
        continue;
      }

      if (this.player.isInvulnerable) continue; // mid-dodge grace window

      if (s.type === SR_OBSTACLE_TYPES.SINGLE_JUMP) {
        const clearedJump = this.player.sprite.y <= this.player.groundY - SR_JUMP_CLEAR_Y;
        if (!clearedJump) this._gameOver();
      } else if (s.type === SR_OBSTACLE_TYPES.SINGLE_DUCK) {
        if (!this.player.isDucking) this._gameOver();
      } else {
        // WIDE: only a dodge (isInvulnerable, checked above) clears it -
        // jumping or ducking through a full-width barrier doesn't help.
        this._gameOver();
      }
    }
  }

  _collectPet(spawn) {
    spawn.resolved = true;
    this._destroySpawn(spawn);
    const idx = this.spawns.indexOf(spawn);
    if (idx !== -1) this.spawns.splice(idx, 1);

    const pet = this.availablePets.length ? this.availablePets.pop() : null;
    if (pet) {
      this.collectedPetIds.push(pet.id);
      this._showPetReveal(pet);
    }
    this.petsText.setText('🐾 ' + this.collectedPetIds.length);
  }

  _showPetReveal(pet) {
    const container = document.getElementById('game-container');
    if (!container || !pet.photo || !ShelterRunPets.isRealPhoto(pet.photo)) return;

    const img = document.createElement('img');
    img.src = pet.photo;
    img.alt = pet.alt || pet.name;
    img.id = 'sr-pet-photo';
    img.style.cssText = 'position:absolute;right:16px;top:16px;width:72px;height:72px;'
      + 'object-fit:cover;border-radius:12px;border:3px solid #ffd166;z-index:20;pointer-events:none;'
      + 'opacity:0;transition:opacity 0.2s ease;';
    container.appendChild(img);
    requestAnimationFrame(() => { img.style.opacity = '1'; });

    setTimeout(() => {
      img.style.opacity = '0';
      setTimeout(() => img.remove(), 250);
    }, 1200);

    this.events.once('shutdown', () => {
      const el = document.getElementById('sr-pet-photo');
      if (el) el.remove();
    });
  }

  _gameOver() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    const finalMeters = Math.floor(this.distancePx / CFG.PX_PER_METER);
    this.scene.start('RoundOver', {
      distanceMeters: finalMeters,
      collectedPetIds: this.collectedPetIds,
      companionIndex: this.companionIndex,
    });
  }
}
