/* ─── Player - the cat ────────────────────────────────────────────────────── */

class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.scale = CFG.CAT_SCALE;

    const tex = typeof foundGetCatTextureKey === 'function' ? foundGetCatTextureKey() : 'cat';
    if (typeof foundRegisterCatAnims === 'function') {
      foundRegisterCatAnims(scene, tex);
    }
    this.sprite = scene.physics.add.sprite(x, y, tex);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setScale(this.scale);
    this.sprite.setCollideWorldBounds(true);
    if (typeof foundSyncCatHitbox === 'function') {
      foundSyncCatHitbox(this.sprite);
    } else {
      this.sprite.body.setSize(CFG.CAT_BODY_W, CFG.CAT_BODY_H);
      this.sprite.body.setOffset(CFG.CAT_BODY_OFFSET_X, CFG.CAT_BODY_OFFSET_Y);
      this.sprite.refreshBody();
    }
    this.sprite.setDepth(10);

    this.shadow = typeof foundCreateCatShadow === 'function'
      ? foundCreateCatShadow(scene, this.sprite)
      : null;

    this.state           = 'idle';
    this.idleTimer       = 0;
    this.idleClean       = false;
    this.idleVariant     = 0;
    this.locked          = false;
    this.wasOnGround     = true;
    this.coyoteUntil     = 0;
    this.jumpBufferUntil = 0;
    this.runHoldMs       = 0;
    this.speedMultiplier = 1;
    this.jumpMultiplier  = 1;
    this.shieldCharges   = 0;
    this.activeBuffs     = {};

    this._registerAnims();
    this.sprite.play(ANIMS.IDLE_1.key);
  }

  _registerAnims() {
    if (typeof foundRegisterCatAnims === 'function') {
      foundRegisterCatAnims(this.scene, this.sprite.texture.key);
      return;
    }
    const a = this.scene.anims;
    const tex = this.sprite.texture.key;
    Object.values(ANIMS).forEach(def => {
      if (a.exists(def.key)) {
        return;
      }
      a.create({
        key:       def.key,
        frames:    a.generateFrameNumbers(tex, { start: def.start, end: def.end }),
        frameRate: def.frameRate,
        repeat:    def.repeat,
      });
    });
  }

  update(keys, delta, touch) {
    if (this.locked) {
      return;
    }

    const body     = this.sprite.body;
    const onGround = body.blocked.down;
    this._updateBuffs();

    if (typeof foundUpdateCatShadow === 'function') {
      foundUpdateCatShadow(this.shadow, this.sprite, onGround);
    }

    const goLeft  = keys.left.isDown  || keys.a.isDown || (touch && touch.left);
    const goRight = keys.right.isDown || keys.d.isDown || (touch && touch.right);
    const jumpTap = Phaser.Input.Keyboard.JustDown(keys.up)
                 || Phaser.Input.Keyboard.JustDown(keys.w)
                 || Phaser.Input.Keyboard.JustDown(keys.space)
                 || (touch && touch.jumpPressed);
    // Variable jump height: hold for full height, tap for short hop
    const jumpHeld = keys.up.isDown || keys.w.isDown || keys.space.isDown;

    if (jumpTap) {
      this.jumpBufferUntil = this.scene.time.now + CFG.JUMP_BUFFER_MS;
      if (typeof FoundAudio !== 'undefined') {
        FoundAudio.unlock();
      }
    }

    if (onGround) {
      this.coyoteUntil = this.scene.time.now + CFG.COYOTE_MS;
    }

    if (goRight) {
      body.setVelocityX(CFG.WALK_SPEED * this.speedMultiplier);
      this.sprite.setFlipX(false);
      this._resetIdle();
      this.runHoldMs += delta;
      if (onGround) {
        this._setState(this.runHoldMs >= 400 ? 'run' : 'walk');
      }
    } else if (goLeft) {
      body.setVelocityX(-CFG.WALK_SPEED * this.speedMultiplier);
      this.sprite.setFlipX(true);
      this._resetIdle();
      this.runHoldMs += delta;
      if (onGround) {
        this._setState(this.runHoldMs >= 400 ? 'run' : 'walk');
      }
    } else {
      // Ground: instant stop. Air: decelerate gradually (air resistance feel)
      if (onGround) {
        body.setVelocityX(0);
      } else {
        body.velocity.x = Phaser.Math.Linear(body.velocity.x, 0, 0.12);
      }
      this.runHoldMs = 0;
      if (onGround && (this.state === 'walk' || this.state === 'run')) {
        this._setState('idle');
      }
    }

    // Variable jump height: releasing jump early cuts upward velocity (short hop)
    if (!jumpHeld && !onGround && body.velocity.y < -150) {
      body.velocity.y *= 0.82;
    }

    // Terminal velocity: cap maximum fall speed
    const maxFall = CFG.MAX_FALL_SPEED || 900;
    if (body.velocity.y > maxFall) body.setVelocityY(maxFall);

    const now = this.scene.time.now;
    const canCoyote = now <= this.coyoteUntil;

    if (this.jumpBufferUntil > now && (onGround || canCoyote)) {
      body.setVelocityY(-CFG.JUMP_VELOCITY * this.jumpMultiplier);
      this.jumpBufferUntil = 0;
      this._resetIdle();
      this._setState('jump');
      this._squash(0.85, 1.12);
      if (typeof FoundAudio !== 'undefined') {
        FoundAudio.jump();
      }
    }

    if (this.state === 'jump' && onGround && body.velocity.y >= 0) {
      // handled below
    }

    // Landing: fires on any airborne → grounded transition (not just from jump state)
    if (onGround && !this.wasOnGround) {
      const moving = Math.abs(body.velocity.x) > 10;
      this._setState(moving ? 'walk' : 'idle');
      this._squash(1.15, 0.88);
      if (typeof foundEmitLandDust === 'function') {
        foundEmitLandDust(this.scene, this.sprite.x, this.sprite.y);
      }
      if (typeof FoundAudio !== 'undefined') {
        FoundAudio.land();
      }
    }

    this.wasOnGround = onGround;

    if (this.state === 'idle' && onGround && !this.idleClean) {
      this.idleTimer += delta;
      if (this.idleTimer >= CFG.IDLE_TIMEOUT_MS) {
        this.idleClean = true;
        this.sprite.play(ANIMS.CLEAN_1.key).once('animationcomplete', () => {
          if (this.state === 'idle' && this.idleClean) {
            this.sprite.play(ANIMS.CLEAN_2.key);
          }
        });
      } else if (this.idleTimer > 2200 && this.idleVariant === 0 && Math.random() < 0.002) {
        this.idleVariant = 1;
        this.sprite.play(ANIMS.IDLE_2.key);
        this.sprite.once('animationcomplete', () => {
          if (this.state === 'idle') {
            this.idleVariant = 0;
            this.sprite.play(ANIMS.IDLE_1.key);
          }
        });
      }
    }
  }

  _squash(scaleX, scaleY) {
    const base = this.scale;
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: base * scaleX,
      scaleY: base * scaleY,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.sprite.setScale(base);
      },
    });
  }

  _setState(newState) {
    if (this.state === newState) {
      return;
    }
    this.state = newState;
    this._resetIdle();

    const map = {
      idle:   ANIMS.IDLE_1.key,
      walk:   ANIMS.WALK.key,
      run:    ANIMS.RUN.key,
      jump:   ANIMS.JUMP.key,
      scared: ANIMS.SCARED.key,
      paw:    ANIMS.PAW.key,
      sleep:  ANIMS.SLEEP.key,
    };
    if (map[newState]) {
      this.sprite.play(map[newState]);
    }
  }

  _resetIdle() {
    this.idleTimer = 0;
    this.idleClean = false;
    this.idleVariant = 0;
  }

  _updateBuffs() {
    const now = this.scene.time.now;
    this.speedMultiplier = 1;
    this.jumpMultiplier = 1;

    Object.keys(this.activeBuffs).forEach((type) => {
      const buff = this.activeBuffs[type];
      if (!buff) {
        return;
      }
      if (buff.until > 0 && buff.until <= now) {
        delete this.activeBuffs[type];
        return;
      }
      if (buff.speedMultiplier) {
        this.speedMultiplier = Math.max(this.speedMultiplier, buff.speedMultiplier);
      }
      if (buff.jumpMultiplier) {
        this.jumpMultiplier = Math.max(this.jumpMultiplier, buff.jumpMultiplier);
      }
    });
  }

  applyBuff(type, durationMs, data) {
    const until = durationMs > 0 ? this.scene.time.now + durationMs : 0;
    this.activeBuffs[type] = Object.assign({ until }, data || {});
    this._updateBuffs();
  }

  addShield(count) {
    this.shieldCharges = Math.max(0, this.shieldCharges + (count || 1));
  }

  consumeShield() {
    if (this.shieldCharges <= 0) {
      return false;
    }
    this.shieldCharges -= 1;
    return true;
  }

  getBuffSummary() {
    const labels = [];
    if (this.shieldCharges > 0) {
      labels.push(`Shield x${this.shieldCharges}`);
    }

    const now = this.scene.time.now;
    Object.keys(this.activeBuffs).forEach((type) => {
      const buff = this.activeBuffs[type];
      if (!buff) {
        return;
      }
      const left = buff.until > 0 ? Math.max(0, Math.ceil((buff.until - now) / 1000)) : 0;
      if (type === 'speed') {
        labels.push(`Speed ${left}s`);
      } else if (type === 'jump') {
        labels.push(`Jump ${left}s`);
      }
    });

    return labels.join(' · ');
  }

  playPaw(onComplete) {
    this.locked = true;
    this.sprite.body.setVelocityX(0);
    this.sprite.play(ANIMS.PAW.key);
    this.sprite.once('animationcomplete', () => {
      if (onComplete) {
        onComplete();
      }
    });
  }

  playScare(onComplete) {
    this.locked = true;
    this._setState('scared');
    this.sprite.body.setVelocityX(0);
    this._squash(1.2, 0.8);
    if (typeof FoundAudio !== 'undefined') {
      FoundAudio.fall();
    }
    this.sprite.once('animationcomplete', () => {
      this.locked = false;
      if (onComplete) {
        onComplete();
      }
    });
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }
}
