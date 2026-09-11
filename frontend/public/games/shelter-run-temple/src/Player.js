/* ─── PlayerRunner — lane + jump arc + timed slide + lives/invuln ─────── */

class Player {
  constructor(scene, companionTint) {
    this.scene = scene;
    this.lanes = new LaneSystem();
    this.action = 'running';
    this.actionT = 0;
    this.actionDurationMs = 1;
    this.worldY = 0;
    this.isInvincible = false;
    this.invincibleUntil = 0;
    this.lives = CFG.INITIAL_LIVES;
    this.tint = companionTint || CFG.COMPANIONS[0].tint;
    this.animPhase = 0;
    this.squashY = 1;
    this.stretchX = 1;
    this.landFlash = 0;
    this._wasJumping = false;
    this.onLaneChange = null;
    this.onJumpLand = null;
    this.g = scene.add.graphics().setDepth(22);
    this._syncPos();
  }

  get effectiveLane() { return this.lanes.effectiveLane; }
  get isSliding() { return this.action === 'sliding'; }
  get isJumping() { return this.action === 'jumping'; }

  changeLane(dir) {
    var ok = this.lanes.change(dir);
    if (ok) {
      // Brief squash juice on successful lane change
      this.squashY = 0.82;
      this.stretchX = 1.18;
      if (typeof this.onLaneChange === 'function') this.onLaneChange(dir);
    }
    return ok;
  }

  jump() {
    if (this.action !== 'running') return;
    this.action = 'jumping';
    this.actionT = 0;
    this.actionDurationMs = CFG.JUMP_MS;
    this._wasJumping = true;
    this.squashY = 1.12;
    this.stretchX = 0.88;
  }

  slide() {
    if (this.action !== 'running') return;
    this.action = 'sliding';
    this.actionT = 0;
    this.actionDurationMs = CFG.SLIDE_MS;
    this.squashY = 0.7;
    this.stretchX = 1.25;
  }

  hit() {
    if (this.isInvincible) return false;
    this.lives -= 1;
    this.isInvincible = true;
    this.invincibleUntil = this.scene.time.now + CFG.INVINCIBLE_MS;
    this.action = 'running';
    this.actionT = 0;
    this.worldY = 0;
    this._wasJumping = false;
    return this.lives <= 0;
  }

  update(dtMs) {
    var now = this.scene.time.now;
    if (this.isInvincible && now >= this.invincibleUntil) {
      this.isInvincible = false;
      this.g.setAlpha(1);
    } else if (this.isInvincible) {
      this.g.setAlpha((Math.floor(now / 80) % 2) ? 0.3 : 1);
    }
    this.lanes.update(dtMs);
    this.animPhase += dtMs * 0.012 * (this.scene.speed / CFG.INITIAL_SPEED);

    // Ease squash/stretch back to 1
    var ease = Math.min(1, dtMs / 120);
    this.squashY += (1 - this.squashY) * ease;
    this.stretchX += (1 - this.stretchX) * ease;
    if (this.landFlash > 0) this.landFlash = Math.max(0, this.landFlash - dtMs / 220);

    if (this.action !== 'running') {
      this.actionT = Math.min(1, this.actionT + dtMs / this.actionDurationMs);
      if (this.actionT >= 1) {
        var landed = this.action === 'jumping';
        this.action = 'running';
        this.actionT = 0;
        this.worldY = 0;
        if (landed && this._wasJumping) {
          this._wasJumping = false;
          this.squashY = 0.72;
          this.stretchX = 1.28;
          this.landFlash = 1;
          if (typeof this.onJumpLand === 'function') this.onJumpLand();
        }
      } else if (this.action === 'jumping') {
        this.worldY = CFG.JUMP_HEIGHT * Math.sin(this.actionT * Math.PI);
        // Apex stretch
        if (this.actionT > 0.35 && this.actionT < 0.65) {
          this.squashY = Math.max(this.squashY, 1.1);
          this.stretchX = Math.min(this.stretchX, 0.9);
        }
      } else {
        this.worldY = 0;
      }
    }
    this._syncPos();
  }

  _syncPos() {
    var L = this.scene.layout;
    var px = this.lanes.screenX(L);
    var jumpOffset = -(this.worldY / CFG.CAMERA_HEIGHT) * (L.playerScreenY - L.horizonY);
    var py = L.playerScreenY + jumpOffset;
    this.g.setPosition(px, py);
    var scale = Math.max(0.85, Math.min(1.25, L.W / 420));
    srDrawRunnerSilhouette(this.g, this.tint, this.action, this.animPhase, scale, {
      squashY: this.squashY,
      stretchX: this.stretchX,
      landFlash: this.landFlash,
      dustPhase: this.animPhase,
    });
  }

  destroy() { if (this.g) this.g.destroy(); }
}
