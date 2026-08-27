/* ─── MainMenuScene - companion picker + start ─────────────────────────────
   Cycles the 4 companions (tinted shared sprite, cosmetic-only per the
   locked plan decision), persists the pick in localStorage, mirroring
   Flappy Cat's cyclePetCompanion() UX idea. */

const SR_COMPANION_KEY = 'monroe_shelter_run_companion';

class MainMenuScene extends Phaser.Scene {
  constructor() { super('MainMenu'); }

  create() {
    // Center/offset everything off the ACTUAL canvas size (this.scale),
    // not the fixed 1280x720 design box - on a narrow portrait phone the
    // old CFG.WIDTH/2-based offsets (e.g. +-220 for the arrows) would
    // land off-screen entirely. Vertical spacing is scaled by the same
    // ratio the design was authored at (720) so it stays proportional on
    // taller/shorter viewports instead of clumping or overflowing.
    const W = this.scale.width;
    const H = this.scale.height;
    const vy = (y) => y * H / CFG.HEIGHT;

    this.cameras.main.setBackgroundColor('#2a3a4a');

    srUiText(this, W / 2, vy(110), 'Shelter Run', { fontSize: '56px', fontFamily: '"Fredoka", sans-serif', color: '#ffffff' });
    srUiText(this, W / 2, vy(168), 'Dash, dodge, and rescue real shelter pets along the way!', { fontSize: '20px', color: '#cfe0ea' });

    let index = this._loadCompanionIndex();
    const companion = () => CFG.COMPANIONS[index];

    const previewY = vy(380);
    const sprite = this.add.sprite(W / 2, previewY, CFG.CAT_TEXTURE_KEY);
    sprite.setOrigin(0.5, 1);
    sprite.setScale(CFG.CAT_SCALE * 1.6);
    sprite.play(ANIMS.RUN.key);
    sprite.setTint(companion().tint);

    const nameText = srUiText(this, W / 2, previewY + 50, companion().name, { fontSize: '32px', color: '#ffffff' });
    const breedText = srUiText(this, W / 2, previewY + 88, companion().breed, { fontSize: '18px', color: '#a9c4d6' });

    const refresh = () => {
      sprite.setTint(companion().tint);
      nameText.setText(companion().name);
      breedText.setText(companion().breed);
      this._saveCompanionIndex(index);
    };

    // Clamped so the arrows stay on-screen (with room for the sprite
    // between them) even on a narrow phone, instead of a fixed +-220 that
    // only works when the canvas is close to the 1280-wide design.
    const arrowOffset = Math.min(220, W * 0.36);
    const arrowStyle = { fontSize: '46px', color: '#ffffff' };
    const leftArrow = this.add.text(W / 2 - arrowOffset, previewY - 60, '‹', arrowStyle).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const rightArrow = this.add.text(W / 2 + arrowOffset, previewY - 60, '›', arrowStyle).setOrigin(0.5).setInteractive({ useHandCursor: true });

    leftArrow.on('pointerdown', () => {
      index = (index - 1 + CFG.COMPANIONS.length) % CFG.COMPANIONS.length;
      refresh();
    });
    rightArrow.on('pointerdown', () => {
      index = (index + 1) % CFG.COMPANIONS.length;
      refresh();
    });

    const startBtn = this.add.rectangle(W / 2, vy(560), 260, 64, 0x4a7c40).setInteractive({ useHandCursor: true });
    srUiText(this, W / 2, vy(560), 'Start Run', { fontSize: '26px', color: '#ffffff' });
    startBtn.on('pointerdown', () => {
      this.scene.start('Game', { companionIndex: index });
    });

    this.input.keyboard.on('keydown-LEFT', () => leftArrow.emit('pointerdown'));
    this.input.keyboard.on('keydown-RIGHT', () => rightArrow.emit('pointerdown'));
    this.input.keyboard.on('keydown-ENTER', () => startBtn.emit('pointerdown'));
    this.input.keyboard.on('keydown-SPACE', () => startBtn.emit('pointerdown'));
  }

  _loadCompanionIndex() {
    try {
      const id = localStorage.getItem(SR_COMPANION_KEY);
      const idx = CFG.COMPANIONS.findIndex((c) => c.id === id);
      return idx >= 0 ? idx : 0;
    } catch (e) {
      return 0;
    }
  }

  _saveCompanionIndex(index) {
    try {
      localStorage.setItem(SR_COMPANION_KEY, CFG.COMPANIONS[index].id);
    } catch (e) {}
  }
}
