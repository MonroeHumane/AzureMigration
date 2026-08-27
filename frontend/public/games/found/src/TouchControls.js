/* ─── Mobile touch controls (same inputs as keyboard) ───────────────────── */

class TouchControls {
  constructor(scene) {
    this.scene = scene;
    this.left = false;
    this.right = false;
    this.jumpPressed = false;
    this.enabled = false;

    const launch = typeof foundParseLaunchParams === 'function'
      ? foundParseLaunchParams()
      : { forceTouch: false };

    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const hasTouch = scene.sys.game.device.input.touch;
    const shouldShow = launch.forceTouch || (hasTouch && coarse);

    if (!shouldShow) {
      return;
    }

    this.enabled = true;
    const W = CFG.WIDTH;
    const H = CFG.HEIGHT;
    const depth = 30;

    const mkBtn = (x, y, label, key) => {
      const bg = scene.add.circle(x, y, 34, 0x000000, 0.35).setScrollFactor(0).setDepth(depth);
      scene.add.text(x, y, label, {
        fontSize: '22px',
        color: '#fff',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);

      bg.setInteractive({ useHandCursor: false });
      bg.on('pointerdown', () => { this[key] = true; bg.setFillStyle(0xffffff, 0.25); });
      bg.on('pointerup', () => { this[key] = false; bg.setFillStyle(0x000000, 0.35); });
      bg.on('pointerout', () => { this[key] = false; bg.setFillStyle(0x000000, 0.35); });
      return bg;
    };

    mkBtn(70, H - 55, '◀', 'left');
    mkBtn(150, H - 55, '▶', 'right');

    const jumpBg = scene.add.circle(W - 70, H - 55, 38, 0x4a7c40, 0.45).setScrollFactor(0).setDepth(depth);
    scene.add.text(W - 70, H - 55, '⤒', {
      fontSize: '26px',
      color: '#fff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);

    jumpBg.setInteractive({ useHandCursor: false });
    jumpBg.on('pointerdown', () => {
      this.jumpPressed = true;
      jumpBg.setFillStyle(0x6a9c60, 0.55);
    });
    jumpBg.on('pointerup', () => jumpBg.setFillStyle(0x4a7c40, 0.45));
    jumpBg.on('pointerout', () => jumpBg.setFillStyle(0x4a7c40, 0.45));
  }

  poll() {
    const jump = this.jumpPressed;
    this.jumpPressed = false;
    return {
      left: this.left,
      right: this.right,
      jumpPressed: jump,
    };
  }
}
