/* ─── Touch: swipe/pads → lane L/R, jump, timed slide ─────────────────── */

class TouchControls {
  constructor(scene) {
    this.scene = scene;
    this.leftPressed = false;
    this.rightPressed = false;
    this.jumpPressed = false;
    this.slidePressed = false;
    this.enabled = false;
    this._buttons = [];
    this._swipeStart = null;
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var hasTouch = !!(scene.sys.game.device.input.touch);
    var forceTouch = new URLSearchParams(window.location.search).get('touch') === '1';
    var showPads = forceTouch || (hasTouch && coarse);
    if (hasTouch || forceTouch) { this._bindSwipe(scene); this.enabled = true; }
    if (!showPads) return;
    this.enabled = true;
    this._layoutButtons();
    scene.scale.on('resize', this._layoutButtons, this);
    scene.events.once('shutdown', function () {
      scene.scale.off('resize', this._layoutButtons, this);
    }, this);
  }

  _safeInsets() {
    var bottom = 12, left = 12, right = 12;
    try {
      var probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;visibility:hidden;padding-bottom:env(safe-area-inset-bottom,0px);padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px);';
      document.body.appendChild(probe);
      var pcs = getComputedStyle(probe);
      var parse = function (v) { var n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
      bottom = Math.max(12, parse(pcs.paddingBottom));
      left = Math.max(12, parse(pcs.paddingLeft));
      right = Math.max(12, parse(pcs.paddingRight));
      probe.remove();
    } catch (e) {}
    return { bottom: bottom, left: left, right: right };
  }

  _layoutButtons() {
    var scene = this.scene;
    if (!scene || !this.enabled) return;
    (this._buttons || []).forEach(function (b) { if (b && b.destroy) b.destroy(); });
    this._buttons = [];
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var forceTouch = new URLSearchParams(window.location.search).get('touch') === '1';
    if (!forceTouch && !(scene.sys.game.device.input.touch && coarse)) return;
    var W = scene.scale.width, H = scene.scale.height, depth = 40;
    var inset = this._safeInsets();
    var radius = Math.max(24, Math.min(36, Math.floor(Math.min(W, H) * 0.055)));
    var rowY = H - inset.bottom - radius - 8;
    var gap = radius * 2 + 14;
    var self = this;
    function mkTap(x, y, label, onTap, fillColor) {
      var bg = scene.add.circle(x, y, radius, fillColor || 0x000000, 0.42).setScrollFactor(0).setDepth(depth);
      var ring = scene.add.circle(x, y, radius + 2, 0xffffff, 0.12).setScrollFactor(0).setDepth(depth - 1);
      var txt = scene.add.text(x, y, label, {
        fontSize: Math.round(radius * 0.75) + 'px', color: '#fff', fontFamily: '"Fredoka", sans-serif',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
      bg.setInteractive({
        useHandCursor: false,
        hitArea: new Phaser.Geom.Circle(0, 0, radius + 4),
        hitAreaCallback: Phaser.Geom.Circle.Contains,
      });
      bg.on('pointerdown', function (pointer) {
        if (pointer && pointer.event && pointer.event.preventDefault) pointer.event.preventDefault();
        onTap();
        bg.setFillStyle(0xffffff, 0.3);
      });
      bg.on('pointerup', function () { bg.setFillStyle(fillColor || 0x000000, 0.42); });
      bg.on('pointerout', function () { bg.setFillStyle(fillColor || 0x000000, 0.42); });
      self._buttons.push(bg, ring, txt);
    }
    var leftX = inset.left + radius + 8;
    mkTap(leftX, rowY, '◀', function () { self.leftPressed = true; });
    mkTap(leftX + gap, rowY, '▶', function () { self.rightPressed = true; });
    var rightX = W - inset.right - radius - 8;
    mkTap(rightX, rowY, '⤒', function () { self.jumpPressed = true; }, 0x4a7c40);
    mkTap(rightX - gap, rowY, '⤓', function () { self.slidePressed = true; }, 0x7c4a4a);
  }

  _bindSwipe(scene) {
    var self = this;
    var SWIPE_MIN = 36;
    scene.input.on('pointerdown', function (pointer) {
      self._swipeStart = { x: pointer.x, y: pointer.y, t: Date.now() };
    });
    scene.input.on('pointerup', function (pointer) {
      if (!self._swipeStart) return;
      var dx = pointer.x - self._swipeStart.x;
      var dy = pointer.y - self._swipeStart.y;
      var dt = Date.now() - self._swipeStart.t;
      self._swipeStart = null;
      if (dt > 450) return;
      var absX = Math.abs(dx), absY = Math.abs(dy);
      if (absX < SWIPE_MIN && absY < SWIPE_MIN) return;
      if (absX > absY) {
        if (dx < 0) self.leftPressed = true; else self.rightPressed = true;
      } else {
        if (dy < 0) self.jumpPressed = true; else self.slidePressed = true;
      }
    });
  }

  poll() {
    var o = {
      leftPressed: this.leftPressed, rightPressed: this.rightPressed,
      jumpPressed: this.jumpPressed, slidePressed: this.slidePressed,
    };
    this.leftPressed = this.rightPressed = this.jumpPressed = this.slidePressed = false;
    return o;
  }
}
