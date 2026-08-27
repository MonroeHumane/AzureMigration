class TouchControls {
  constructor(scene) {
    this.scene = scene;
    this.left = false;
    this.right = false;
    this.enabled = false;

    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var hasTouch = scene.sys.game.device.input.touch;
    var forceTouch = new URLSearchParams(window.location.search).get('touch') === '1';
    if (!forceTouch && !(hasTouch && coarse)) return;

    this.enabled = true;
    var H = CFG.HEIGHT;
    var depth = 55;
    var self = this;

    function mkBtn(x, label, key) {
      var bg = scene.add.circle(x, H - 55, 34, 0x000000, 0.35).setScrollFactor(0).setDepth(depth);
      scene.add.text(x, H - 55, label, { fontSize: '22px', color: '#fff' }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
      bg.setInteractive({ useHandCursor: false });
      bg.on('pointerdown', function () { self[key] = true; bg.setFillStyle(0xffffff, 0.25); });
      bg.on('pointerup', function () { self[key] = false; bg.setFillStyle(0x000000, 0.35); });
      bg.on('pointerout', function () { self[key] = false; bg.setFillStyle(0x000000, 0.35); });
    }

    mkBtn(70, '◀', 'left');
    mkBtn(150, '▶', 'right');
  }

  poll() {
    return { left: this.left, right: this.right };
  }
}
