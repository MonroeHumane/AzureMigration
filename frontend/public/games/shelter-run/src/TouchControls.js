/* ─── Mobile touch controls - dodge-left/dodge-right, jump, duck ──────────
   Adapted from found/src/TouchControls.js's exact button-circle pattern.
   Left/right are discrete dodge taps (not held movement - see Player.js's
   dodge()), jump is a discrete tap, duck is held for the crouch duration.
   Also supports horizontal/vertical swipe gestures on the playfield. */

class TouchControls {
  constructor(scene) {
    this.scene = scene;
    this.dodgeLeftPressed = false;
    this.dodgeRightPressed = false;
    this.jumpPressed = false;
    this.duckHeld = false;
    this.enabled = false;
    this._buttons = [];
    this._swipeStart = null;

    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const hasTouch = !!(scene.sys.game.device.input.touch);
    const forceTouch = new URLSearchParams(window.location.search).get('touch') === '1';
    const showPads = forceTouch || (hasTouch && coarse);

    // Swipe gestures whenever touch input exists; on-screen pads only on coarse/forced.
    if (hasTouch || forceTouch) {
      this._bindSwipe(scene);
      this.enabled = true;
    }

    if (!showPads) {
      return;
    }

    this.enabled = true;
    this._layoutButtons();
    scene.scale.on('resize', this._layoutButtons, this);
    scene.events.once('shutdown', () => {
      scene.scale.off('resize', this._layoutButtons, this);
    });
  }

  _safeInsets() {
    // Approximate CSS env(safe-area-inset-*) in canvas space via documentElement padding/env
    // using getComputedStyle when available; fall back to compact defaults.
    let bottom = 12;
    let left = 12;
    let right = 12;
    try {
      const cs = getComputedStyle(document.documentElement);
      const parse = (v) => {
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : 0;
      };
      // env() resolves in CSS; probe via a temp element
      const probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;visibility:hidden;padding-bottom:env(safe-area-inset-bottom,0px);padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px);';
      document.body.appendChild(probe);
      const pcs = getComputedStyle(probe);
      bottom = Math.max(12, parse(pcs.paddingBottom));
      left = Math.max(12, parse(pcs.paddingLeft));
      right = Math.max(12, parse(pcs.paddingRight));
      probe.remove();
      void cs;
    } catch (e) {}
    return { bottom, left, right };
  }

  _layoutButtons() {
    const scene = this.scene;
    if (!scene || !this.enabled) return;

    // Tear down prior pads on resize
    (this._buttons || []).forEach((b) => {
      if (b && b.destroy) b.destroy();
    });
    this._buttons = [];

    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const forceTouch = new URLSearchParams(window.location.search).get('touch') === '1';
    if (!forceTouch && !(scene.sys.game.device.input.touch && coarse)) {
      return;
    }

    const W = scene.scale.width;
    const H = scene.scale.height;
    const depth = 30;
    const inset = this._safeInsets();
    // ≥44px targets: radius 24 → 48px diameter; bump on large phones
    const radius = Math.max(24, Math.min(36, Math.floor(Math.min(W, H) * 0.055)));
    const rowY = H - inset.bottom - radius - 8;
    const gap = radius * 2 + 14;

    const mkTapBtn = (x, y, label, onTap, fillColor) => {
      const bg = scene.add.circle(x, y, radius, fillColor || 0x000000, 0.42).setScrollFactor(0).setDepth(depth);
      const ring = scene.add.circle(x, y, radius + 2, 0xffffff, 0.12).setScrollFactor(0).setDepth(depth - 1);
      const txt = scene.add.text(x, y, label, { fontSize: Math.round(radius * 0.75) + 'px', color: '#fff', fontFamily: '"Fredoka", sans-serif' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
      bg.setInteractive({ useHandCursor: false, hitArea: new Phaser.Geom.Circle(0, 0, radius + 4), hitAreaCallback: Phaser.Geom.Circle.Contains });
      bg.on('pointerdown', (pointer) => {
        if (pointer && pointer.event && pointer.event.preventDefault) pointer.event.preventDefault();
        onTap();
        bg.setFillStyle(0xffffff, 0.3);
      });
      bg.on('pointerup', () => bg.setFillStyle(fillColor || 0x000000, 0.42));
      bg.on('pointerout', () => bg.setFillStyle(fillColor || 0x000000, 0.42));
      this._buttons.push(bg, ring, txt);
      return bg;
    };

    const mkHoldBtn = (x, y, label, onDown, onUp, fillColor) => {
      const bg = scene.add.circle(x, y, radius, fillColor || 0x7c4a4a, 0.42).setScrollFactor(0).setDepth(depth);
      const ring = scene.add.circle(x, y, radius + 2, 0xffffff, 0.12).setScrollFactor(0).setDepth(depth - 1);
      const txt = scene.add.text(x, y, label, { fontSize: Math.round(radius * 0.75) + 'px', color: '#fff', fontFamily: '"Fredoka", sans-serif' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
      bg.setInteractive({ useHandCursor: false, hitArea: new Phaser.Geom.Circle(0, 0, radius + 4), hitAreaCallback: Phaser.Geom.Circle.Contains });
      bg.on('pointerdown', (pointer) => {
        if (pointer && pointer.event && pointer.event.preventDefault) pointer.event.preventDefault();
        onDown();
        bg.setFillStyle(0xffffff, 0.3);
      });
      bg.on('pointerup', () => { onUp(); bg.setFillStyle(fillColor || 0x7c4a4a, 0.42); });
      bg.on('pointerout', () => { onUp(); bg.setFillStyle(fillColor || 0x7c4a4a, 0.42); });
      this._buttons.push(bg, ring, txt);
      return bg;
    };

    // Left cluster (dodge) — thumb-friendly lower corners, clear of center playfield
    const leftX = inset.left + radius + 8;
    mkTapBtn(leftX, rowY, '◀', () => { this.dodgeLeftPressed = true; });
    mkTapBtn(leftX + gap, rowY, '▶', () => { this.dodgeRightPressed = true; });

    // Right cluster (jump / duck)
    const rightX = W - inset.right - radius - 8;
    mkTapBtn(rightX, rowY, '⤒', () => { this.jumpPressed = true; }, 0x4a7c40);
    mkHoldBtn(rightX - gap, rowY, '⤓',
      () => { this.duckHeld = true; },
      () => { this.duckHeld = false; },
      0x7c4a4a
    );
  }

  _bindSwipe(scene) {
    const SWIPE_MIN = 36;
    scene.input.on('pointerdown', (pointer) => {
      // Ignore presses on UI depth buttons (they sit near edges)
      this._swipeStart = { x: pointer.x, y: pointer.y, t: Date.now() };
    });
    scene.input.on('pointerup', (pointer) => {
      if (!this._swipeStart) return;
      const dx = pointer.x - this._swipeStart.x;
      const dy = pointer.y - this._swipeStart.y;
      const dt = Date.now() - this._swipeStart.t;
      this._swipeStart = null;
      if (dt > 450) return;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absX < SWIPE_MIN && absY < SWIPE_MIN) return;
      if (absX > absY) {
        if (dx < 0) this.dodgeLeftPressed = true;
        else this.dodgeRightPressed = true;
      } else {
        if (dy < 0) this.jumpPressed = true;
        else this.duckHeld = true;
      }
    });
    // End duck hold shortly after a downward swipe
    scene.input.on('pointerup', () => {
      if (this.duckHeld) {
        scene.time.delayedCall(280, () => { this.duckHeld = false; });
      }
    });
  }

  poll() {
    const left = this.dodgeLeftPressed;
    const right = this.dodgeRightPressed;
    const jump = this.jumpPressed;
    this.dodgeLeftPressed = false;
    this.dodgeRightPressed = false;
    this.jumpPressed = false;
    return {
      dodgeLeftPressed: left,
      dodgeRightPressed: right,
      jumpPressed: jump,
      duckHeld: this.duckHeld,
    };
  }
}
