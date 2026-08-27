/* ─── Player - side-view runner: jump, duck, dodge ─────────────────────────
   Fixed screen-X (CFG.PLAYER_X), world scrolls under it - the same camera
   model as a Flappy-Bird-style game, not found's camera-follow platformer.
   Three distinct evasion inputs mirror Temple Run's jump/slide/lane-shift
   without needing a forward-facing or top-down sprite: jump (vertical),
   duck (vertical, squash), dodge (brief sidestep hop + invulnerability
   window, triggered by left/right - see constants.js for why literal lane
   positions don't fit a side-view sprite). */

class Player {
  constructor(scene) {
    this.scene = scene;
    this.scale = CFG.CAT_SCALE;

    srRegisterCatAnims(scene);

    // this.scale.width/groundY reflect the ACTUAL device viewport (see
    // main.js's Scale.RESIZE setup + GameScene.create()), not the fixed
    // 1280x720 design box - a portrait phone gets a proportionally
    // positioned player, not one pinned to a stale absolute pixel value.
    this.baseX = scene.scale.width * CFG.PLAYER_X_RATIO;
    this.groundY = scene.groundY;
    this.sprite = scene.physics.add.sprite(this.baseX, this.groundY, CFG.CAT_TEXTURE_KEY);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setScale(this.scale);
    this.sprite.setDepth(10);
    srSyncCatHitbox(this.sprite);
    this.sprite.body.setAllowGravity(true);
    this.sprite.body.setGravityY(CFG.GRAVITY);
    this.sprite.body.setCollideWorldBounds(false);
    this.isDucking = false;
    this.isDodging = false;
    this.dodgeInvulnUntil = 0;

    this.sprite.play(ANIMS.RUN.key);
  }

  setTint(color) {
    this.sprite.setTint(color);
  }

  get isOnGround() {
    return this.sprite.y >= this.groundY - 1 && this.sprite.body.velocity.y >= 0;
  }

  get isInvulnerable() {
    return this.scene.time.now < this.dodgeInvulnUntil;
  }

  jump() {
    if (!this.isOnGround || this.isDucking) return;
    this.sprite.body.setVelocityY(CFG.JUMP_VELOCITY);
    this.sprite.play(ANIMS.JUMP.key);
  }

  setDuck(ducking) {
    if (!this.isOnGround) return;
    if (ducking === this.isDucking) return;
    this.isDucking = ducking;
    this.sprite.setScale(this.scale, ducking ? this.scale * CFG.DUCK_SCALE_Y : this.scale);
    srSyncCatHitbox(this.sprite);
    if (ducking) {
      this.sprite.body.setSize(this.sprite.body.width, this.sprite.body.height * CFG.DUCK_SCALE_Y);
    }
  }

  dodge(direction) {
    if (this.isDodging) return;
    this.isDodging = true;
    this.dodgeInvulnUntil = this.scene.time.now + CFG.DODGE_INVULN_MS;

    const hopX = this.baseX + direction * 34;
    this.scene.tweens.add({
      targets: this.sprite,
      x: hopX,
      duration: CFG.DODGE_DURATION_MS / 2,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => { this.isDodging = false; },
    });
  }

  update() {
    // No ground platform body exists (the ground is a visual-only
    // rectangle, see GameScene._drawGround) - clamp manually, otherwise
    // gravity just keeps accelerating the sprite through the floor forever.
    // Critical: only clamp when actually moving DOWN into the floor
    // (velocity.y >= 0). A jump call sets velocity.y negative on the same
    // frame update() next runs, before Arcade Physics has integrated that
    // velocity into a new position yet - clamping on position alone (with
    // the still-stale >= groundY position from before the jump) zeroed the
    // jump velocity before it ever had a chance to move the sprite.
    if (this.sprite.y >= this.groundY && this.sprite.body.velocity.y >= 0) {
      this.sprite.y = this.groundY;
      this.sprite.body.setVelocityY(0);
    }

    if (this.isOnGround && !this.isDucking
      && this.sprite.anims.currentAnim && this.sprite.anims.currentAnim.key !== ANIMS.RUN.key) {
      this.sprite.play(ANIMS.RUN.key);
    }
  }

  destroy() {
    this.sprite.destroy();
  }
}
