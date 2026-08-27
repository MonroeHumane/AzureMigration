/* ─── RoundOverScene - cat lands on feet, try again ─────────────────────── */
class RoundOverScene extends Phaser.Scene {
  constructor() { super('RoundOver'); }

  init(data) {
    this.levelNum = data.level ?? 1;
    this.levelSeed = typeof data.seed === 'number' ? data.seed : (Date.now() >>> 0);
    this.deaths = data.deaths || 0;
  }

  create() {
    const W = CFG.WIDTH;
    const H = CFG.HEIGHT;

    this.cameras.main.setBackgroundColor('#1a1a2e');
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.fadeIn(400, 0, 0, 0);

    if (typeof foundUiScreenCard === 'function') {
      foundUiScreenCard(this, W / 2, H * 0.50, W * 0.72, H * 0.58, {
        fill: 0x1d2030,
        alpha: 0.95,
        stroke: 0x7f6f56,
        depth: 20,
      });
    }

    if (typeof foundCreateSceneCat === 'function') {
      const cat = foundCreateSceneCat(this, W / 2, H * 0.36, ANIMS.SCARED.key, CFG.CAT_SCENE_SCALE);
      if (cat) {
        cat.setDepth(22);
      }
    }

    if (typeof foundUiTitle === 'function') {
      foundUiTitle(this, W / 2, H * 0.50, 'So close!', {
        fontSize: '38px',
        color: '#ffffff',
        stroke: '#2a2040',
        strokeThickness: 8,
      }).setDepth(22);
    } else {
      this.add.text(W / 2, H * 0.50, 'So close!', { fontSize: '30px', color: '#fff' }).setOrigin(0.5);
    }

    if (typeof foundUiText === 'function') {
      foundUiText(this, W / 2, H * 0.60,
        "Cats always land on their feet.\nThe shelter is still waiting.", {
        fontSize: '17px',
        color: '#d8d8ee',
        lineSpacing: 8,
      }).setOrigin(0.5).setDepth(22);

      foundUiText(this, W / 2, H * 0.70,
        `Layout #${this.levelSeed}  ·  Falls this run: ${this.deaths}`, {
        fontSize: '13px',
        color: '#8899aa',
      }).setOrigin(0.5).setDepth(22);
    }

    const tryBtn = typeof foundUiIconButton === 'function'
      ? foundUiIconButton(this, W / 2, H * 0.80, 'Try Again', {
        iconKey: 'found-ui-menu-replay',
        width: 250,
        height: 48,
        fill: 0x4a5068,
        stroke: 0x252b42,
        fontSize: '18px',
      })
      : null;
    if (tryBtn) {
      tryBtn.hit.on('pointerup', () => this._restart());
    }

    this.input.keyboard.once('keydown-SPACE', () => this._restart());
    this.input.keyboard.once('keydown-ENTER', () => this._restart());

    const menuBtn = typeof foundUiIconButton === 'function'
      ? foundUiIconButton(this, W / 2, H * 0.90, 'Main Menu', {
        iconKey: 'found-ui-menu-home',
        width: 250,
        height: 40,
        fill: 0x262c3e,
        stroke: 0x5d677d,
        fontSize: '14px',
      })
      : null;
    if (menuBtn) {
      menuBtn.hit.on('pointerup', () => this.scene.start('MainMenu'));
    }
  }

  _restart() {
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('Game', {
        level: this.levelNum,
        seed: this.levelSeed,
        deaths: this.deaths,
      });
    });
  }
}
