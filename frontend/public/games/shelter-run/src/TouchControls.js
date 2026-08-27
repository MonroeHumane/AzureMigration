/* ─── Mobile touch controls - dodge-left/dodge-right, jump, duck ──────────
   Adapted from found/src/TouchControls.js's exact button-circle pattern.
   Left/right are discrete dodge taps (not held movement - see Player.js's
   dodge()), jump is a discrete tap, duck is held for the crouch duration. */

class TouchControls {
  constructor(scene) {
    this.scene = scene;
    this.dodgeLeftPressed = false;
    this.dodgeRightPressed = false;
    this.jumpPressed = false;
    this.duckHeld = false;
    this.enabled = false;

    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const hasTouch = scene.sys.game.device.input.touch;
    const forceTouch = new URLSearchParams(window.location.search).get('touch') === '1';
    const shouldShow = forceTouch || (hasTouch && coarse);

    if (!shouldShow) {
      return;
    }

    this.enabled = true;
    const W = scene.scale.width;
    const H = scene.scale.height;
    const depth = 30;

    const mkTapBtn = (x, y, label, onTap, radius, fillColor) => {
      const bg = scene.add.circle(x, y, radius || 34, fillColor || 0x000000, 0.35).setScrollFactor(0).setDepth(depth);
      scene.add.text(x, y, label, { fontSize: '22px', color: '#fff' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
      bg.setInteractive({ useHandCursor: false });
      bg.on('pointerdown', () => {
        onTap();
        bg.setFillStyle(0xffffff, 0.25);
      });
      bg.on('pointerup', () => bg.setFillStyle(fillColor || 0x000000, 0.35));
      bg.on('pointerout', () => bg.setFillStyle(fillColor || 0x000000, 0.35));
      return bg;
    };

    mkTapBtn(70, H - 55, '◀', () => { this.dodgeLeftPressed = true; });
    mkTapBtn(150, H - 55, '▶', () => { this.dodgeRightPressed = true; });
    mkTapBtn(W - 70, H - 55, '⤒', () => { this.jumpPressed = true; }, 38, 0x4a7c40);

    const duckBg = scene.add.circle(W - 150, H - 55, 34, 0x7c4a4a, 0.35).setScrollFactor(0).setDepth(depth);
    scene.add.text(W - 150, H - 55, '⤓', { fontSize: '22px', color: '#fff' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
    duckBg.setInteractive({ useHandCursor: false });
    duckBg.on('pointerdown', () => { this.duckHeld = true; duckBg.setFillStyle(0xffffff, 0.25); });
    duckBg.on('pointerup', () => { this.duckHeld = false; duckBg.setFillStyle(0x7c4a4a, 0.35); });
    duckBg.on('pointerout', () => { this.duckHeld = false; duckBg.setFillStyle(0x7c4a4a, 0.35); });
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
