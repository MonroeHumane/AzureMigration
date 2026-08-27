/* --- LevelCompleteScene - safe at last ----------------------------------- */
class LevelCompleteScene extends Phaser.Scene {
  constructor() { super('LevelComplete'); }

  init(data) {
    this.levelNum = data.level ?? 1;
    this.levelSeed = typeof data.seed === 'number' ? data.seed : (Date.now() >>> 0);
    this.timeMs = data.timeMs || 0;
    this.deaths = data.deaths || 0;
    this.treats = data.treats || 0;
    this.treatsTotal = data.treatsTotal || 0;
  }

  create() {
    const W = CFG.WIDTH;
    const H = CFG.HEIGHT;
    const nextLevel = this.levelNum + 1;
    const hasNext = !!CFG.DIFFICULTY[nextLevel];

    if (typeof foundUnlockLevel === 'function') {
      foundUnlockLevel(this.levelNum);
    }

    let record = { isBest: false, previousBest: null };
    if (typeof foundRecordLevelComplete === 'function') {
      record = foundRecordLevelComplete(this.levelNum, this.timeMs, this.deaths, this.treats);
    }

    this.cameras.main.setBackgroundColor('#87CEEB');
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.fadeIn(600, 255, 245, 220);

    let platformY = CFG.GROUND_Y || H - 128;
    if (typeof foundBuildLevelCompleteBackdrop === 'function') {
      const backdrop = foundBuildLevelCompleteBackdrop(this);
      platformY = backdrop.platformY;
    }

    if (typeof foundCreateSceneCat === 'function') {
      const cat = foundCreateSceneCat(
        this, W / 2 - 36, platformY, ANIMS.PAW.key, (CFG.CAT_SCENE_SCALE || 4) * 0.72
      );
      if (cat) {
        cat.setDepth(12);
      }
    }

    const timeStr = typeof foundFormatDuration === 'function'
      ? foundFormatDuration(this.timeMs)
      : `${(this.timeMs / 1000).toFixed(1)}s`;
    const statLines = [
      `Level ${this.levelNum} complete!`,
      `Time: ${timeStr}  -  Falls: ${this.deaths}`,
    ];
    if (this.treatsTotal > 0) {
      statLines.push(`Treats collected: ${this.treats}/${this.treatsTotal}`);
    }
    if (record.isBest) {
      statLines.push('New best time!');
    }

    if (typeof foundUiScreenCard === 'function') {
      foundUiScreenCard(this, W / 2, H - 162, 560, 296, {
        fill: 0xfff9ec,
        stroke: 0x6d8a54,
        depth: 20,
      });
    }

    if (typeof foundUiTitle === 'function') {
      foundUiTitle(this, W / 2, H - 282, 'Safe at last!', {
        fontSize: '36px',
        color: '#3a1800',
        stroke: '#fffdf7',
        strokeThickness: 6,
      }).setDepth(22);
    }

    if (typeof foundUiText === 'function') {
      foundUiText(this, W / 2, H - 242, statLines.join('\n'), {
        fontSize: '17px',
        color: '#4a4030',
        lineSpacing: 8,
        useNativeSize: true,
      }).setOrigin(0.5, 0).setDepth(22);
    }

    const replayBtn = typeof foundUiIconButton === 'function'
      ? foundUiIconButton(this, W / 2 - 136, H - 108, 'Replay Layout', {
        iconKey: 'found-ui-menu-replay',
        width: 220,
        height: 46,
        fill: 0xe7decb,
        stroke: 0x9b8c72,
        textColor: '#3a1800',
        fontSize: '15px',
      })
      : null;
    if (replayBtn) {
      replayBtn.hit.on('pointerup', () => this._replay());
    }

    if (hasNext) {
      const nextBtn = typeof foundUiIconButton === 'function'
        ? foundUiIconButton(this, W / 2 + 136, H - 108, `Level ${nextLevel}`, {
          iconKey: 'found-ui-menu-next',
          width: 220,
          height: 50,
          fill: 0x4a7c40,
          stroke: 0x2f5d2c,
          fontSize: '17px',
        })
        : null;
      if (nextBtn) {
        nextBtn.hit.on('pointerup', () => this._goNext(nextLevel));
      }
      this.input.keyboard.once('keydown-SPACE', () => this._goNext(nextLevel));
      this.input.keyboard.once('keydown-ENTER', () => this._goNext(nextLevel));
    } else if (typeof foundUiText === 'function') {
      foundUiText(this, W / 2 + 136, H - 108, 'You helped them all find a home!', {
        fontSize: '17px',
        fontStyle: '700',
        color: '#8b6914',
        useNativeSize: true,
      }).setOrigin(0.5).setDepth(23);
    }

    if (typeof foundShareLayoutUrl === 'function') {
      const shareUrl = foundShareLayoutUrl(this.levelNum, this.levelSeed);
      const shareBtn = typeof foundUiIconButton === 'function'
        ? foundUiIconButton(this, W / 2 - 136, H - 52, 'Copy Layout Link', {
          iconKey: 'found-ui-menu-share',
          width: 220,
          height: 40,
          fill: 0xf1ede3,
          stroke: 0xb6ab97,
          textColor: '#4a4030',
          fontSize: '13px',
        })
        : null;
      if (shareBtn) {
        shareBtn.hit.on('pointerup', () => {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareUrl).then(() => {
              shareBtn.text.setText('Link Copied');
            }).catch(() => {
              window.prompt('Copy layout link:', shareUrl);
            });
          } else {
            window.prompt('Copy layout link:', shareUrl);
          }
        });
      }
    }

    const menuBtn = typeof foundUiIconButton === 'function'
      ? foundUiIconButton(this, W / 2 + 136, H - 52, 'Main Menu', {
        iconKey: 'found-ui-menu-home',
        width: 220,
        height: 40,
        fill: 0xf1ede3,
        stroke: 0xb6ab97,
        textColor: '#4a4030',
        fontSize: '13px',
      })
      : null;
    if (menuBtn) {
      menuBtn.hit.on('pointerup', () => this.scene.start('MainMenu'));
    }

    if (typeof foundUiText === 'function') {
      foundUiText(this, W / 2, H - 10,
        'Cat sprites by Elthen  -  Monroe Humane Society', {
          fontSize: '11px',
          color: '#3a5030',
          useNativeSize: true,
        }).setOrigin(0.5).setDepth(22);
    }
  }

  _replay() {
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('Game', { level: this.levelNum, seed: this.levelSeed });
    });
  }

  _goNext(nextLevel) {
    const seed = typeof foundResolveLevelSeed === 'function'
      ? foundResolveLevelSeed(nextLevel, null)
      : Date.now() >>> 0;
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('Game', { level: nextLevel, seed });
    });
  }
}