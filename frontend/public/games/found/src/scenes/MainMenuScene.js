/* ─── MainMenuScene - title screen with sleeping cat ─────────────────────── */
class MainMenuScene extends Phaser.Scene {
  constructor() { super('MainMenu'); }

  create() {
    const W = CFG.WIDTH;
    const H = CFG.HEIGHT;
    const progress = typeof foundLoadProgress === 'function' ? foundLoadProgress() : { maxUnlocked: 1 };
    const launch = typeof foundParseLaunchParams === 'function'
      ? foundParseLaunchParams()
      : { level: null, seed: null, daily: false };

    if (launch.level) {
      const seed = typeof foundResolveLevelSeed === 'function'
        ? foundResolveLevelSeed(launch.level, launch.seed, { daily: launch.daily })
        : (launch.seed || Date.now() >>> 0);
      this.scene.start('Game', { level: launch.level, seed });
      return;
    }

    let groundY = H - 80;
    if (typeof foundBuildMenuTerrain === 'function') {
      const terrain = foundBuildMenuTerrain(this);
      groundY = terrain.groundY;
    } else {
      this.cameras.main.setBackgroundColor('#87CEEB');
      this.add.rectangle(W / 2, H - 40, W, 80, 0x6B8E23);
    }

    if (typeof foundUiTitle === 'function') {
      foundUiTitle(this, W / 2, H * 0.10, 'FOUND', {
        fontSize: '58px',
        color: '#2a1800',
        stroke: '#ffffff',
        strokeThickness: 8,
      });

      foundUiText(this, W / 2, H * 0.22,
        'Help the stray cat find its way to\nthe Monroe Animal Shelter', {
        fontSize: '16px',
        color: '#1a1a1a',
        lineSpacing: 6,
        stroke: '#ffffff',
        strokeThickness: 2,
      }).setOrigin(0.5);
    } else {
      this.add.text(W / 2, H * 0.10, 'FOUND', { fontSize: '54px', color: '#2a1800' }).setOrigin(0.5);
    }

    const platY = groundY - 35;
    if (typeof foundDrawPlatformSurface === 'function') {
      foundDrawPlatformSurface(this, {
        x: W / 2 - 55,
        y: platY,
        width: 110,
        type: 'start',
      }, {
        height: CFG.PLATFORM_HEIGHT,
        depth: 4,
        levelNum: 1,
        levelSeed: 0,
      });
    } else {
      this.add.rectangle(W / 2, platY + 10, 110, 14, 0x8B6914).setDepth(4);
      this.add.rectangle(W / 2, platY + 5,  110,  6, 0x556B2F).setDepth(4);
    }

    if (typeof foundCreateSceneCat === 'function') {
      foundCreateSceneCat(this, W / 2, platY, ANIMS.SLEEP.key, CFG.CAT_SCENE_SCALE);
    } else {
      const cat = this.add.sprite(W / 2, platY, 'cat')
        .setScale((CFG.CAT_SCALE || 2) + 0.25)
        .setOrigin(0.5, 1)
        .setDepth(6);
      cat.play(ANIMS.SLEEP.key);
    }

    const startBtn = typeof foundUiIconButton === 'function'
      ? foundUiIconButton(this, W / 2, H * 0.50, 'Start Level 1', {
        iconKey: 'found-ui-menu-start',
        width: 292,
        height: 52,
        fill: 0x4a7c40,
        stroke: 0x2f5d2c,
      })
      : null;
    if (startBtn) {
      startBtn.hit.on('pointerup', () => this._startLevel(1));
    }

    const dailyBtn = typeof foundUiIconButton === 'function'
      ? foundUiIconButton(this, W / 2, H * 0.58, "Today's Challenge", {
        iconKey: 'found-ui-menu-daily',
        width: 292,
        height: 44,
        fill: 0xe0c07a,
        stroke: 0x8d6b28,
        textColor: '#34240d',
        fontSize: '15px',
      })
      : null;
    const launchDaily = () => {
      const maxLevel = typeof foundGetLevelCount === 'function' ? foundGetLevelCount() : 24;
      const lvl = Math.min(progress.maxUnlocked, maxLevel);
      const seed = typeof foundResolveLevelSeed === 'function'
        ? foundResolveLevelSeed(lvl, null, { daily: true })
        : Date.now() >>> 0;
      this._startLevel(lvl, seed);
    };
    if (dailyBtn) {
      dailyBtn.hit.on('pointerup', launchDaily);
    }

    this.progress = progress;
    this.selectedAct = typeof foundGetActForLevel === 'function'
      ? foundGetActForLevel(progress.maxUnlocked)
      : 1;
    this.actButtons = [];
    this.levelCardNodes = [];
    this._buildActSelector(H);
    this._buildLevelSelect(progress, H);

    const hint = typeof foundUiText === 'function'
      ? foundUiText(this, W / 2, H * 0.88, 'Tap or press Space to start Level 1', {
        fontSize: '13px',
        color: '#2f3a28',
        useNativeSize: true,
      }).setOrigin(0.5).setDepth(30)
      : this.add.text(W / 2, H * 0.88, 'Tap or press Space to start Level 1', {
        fontSize: '12px',
        fontFamily: 'Arial, sans-serif',
        color: '#333',
      }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: hint, alpha: 0, duration: 650, yoyo: true, repeat: -1 });

    const controlsLine = typeof foundUiText === 'function'
      ? foundUiText(this, W / 2, H * 0.94, '← → walk   ↑ / Space jump   Esc pause   treats optional', {
        fontSize: '11px',
        color: '#43503f',
        useNativeSize: true,
      }).setOrigin(0.5).setDepth(30)
      : this.add.text(W / 2, H * 0.94, '← → walk   ↑ / Space jump   Esc pause   treats optional', {
        fontSize: '10px',
        fontFamily: 'Arial, sans-serif',
        color: '#555',
      }).setOrigin(0.5).setDepth(30);

    const creditLine = typeof foundUiText === 'function'
      ? foundUiText(this, W / 2, H - 8, 'Cat sprites by Elthen  ·  A Monroe Humane Society game', {
        fontSize: '11px',
        color: '#4d5b49',
        useNativeSize: true,
      }).setOrigin(0.5).setDepth(30)
      : this.add.text(W / 2, H - 8, 'Cat sprites by Elthen  ·  A Monroe Humane Society game', {
        fontSize: '10px',
        fontFamily: 'Arial, sans-serif',
        color: '#666',
      }).setOrigin(0.5).setDepth(30);

    this.input.keyboard.once('keydown-SPACE', () => this._startLevel(1));
    this.input.keyboard.once('keydown-ENTER', () => this._startLevel(1));

    this.input.on('pointerdown', () => {
      if (typeof FoundAudio !== 'undefined') {
        FoundAudio.unlock();
      }
    });
  }

  _buildActSelector(H) {
    const W = CFG.WIDTH;
    const actCount = typeof foundGetActCount === 'function' ? foundGetActCount() : 6;
    const cols = 3;
    const btnW = 156;
    const btnH = 24;
    const gapX = 14;
    const gapY = 10;
    const totalW = cols * btnW + (cols - 1) * gapX;
    const startX = (W - totalW) / 2;
    const startY = H * 0.64;

    for (let actNum = 1; actNum <= actCount; actNum++) {
      const col = (actNum - 1) % cols;
      const row = Math.floor((actNum - 1) / cols);
      const x = startX + col * (btnW + gapX);
      const y = startY + row * (btnH + gapY);
      const name = (CFG.ACT_NAMES && CFG.ACT_NAMES[actNum]) || `Act ${actNum}`;

      const bg = this.add.rectangle(x + btnW / 2, y + btnH / 2, btnW, btnH, 0xf4efe4, 0.94)
        .setStrokeStyle(2, 0x9b8c72, 0.55)
        .setDepth(28)
        .setInteractive({ useHandCursor: true });
      const label = typeof foundUiText === 'function'
        ? foundUiText(this, x + btnW / 2, y + 5, `Act ${actNum} · ${name}`, {
          fontSize: '11px',
          fontStyle: '700',
          color: '#5a4632',
          useNativeSize: true,
        }).setOrigin(0.5, 0).setDepth(29)
        : this.add.text(x + btnW / 2, y + 5, `Act ${actNum} · ${name}`, {
          fontSize: '11px',
          fontFamily: 'Arial, sans-serif',
          color: '#5a4632',
          fontStyle: 'bold',
        }).setOrigin(0.5, 0).setDepth(29);

      bg.on('pointerup', () => {
        const unlockedAct = typeof foundGetActForLevel === 'function'
          ? foundGetActForLevel(this.progress.maxUnlocked)
          : 1;
        if (actNum > unlockedAct) {
          return;
        }
        this.selectedAct = actNum;
        this._refreshActButtons();
        this._buildLevelSelect(this.progress, H);
      });
      label.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        const unlockedAct = typeof foundGetActForLevel === 'function'
          ? foundGetActForLevel(this.progress.maxUnlocked)
          : 1;
        if (actNum > unlockedAct) {
          return;
        }
        this.selectedAct = actNum;
        this._refreshActButtons();
        this._buildLevelSelect(this.progress, H);
      });

      this.actButtons.push({ actNum, bg, label });
    }

    this._refreshActButtons();
  }

  _refreshActButtons() {
    const unlockedAct = typeof foundGetActForLevel === 'function'
      ? foundGetActForLevel(this.progress.maxUnlocked)
      : 1;

    if (this.selectedAct > unlockedAct) {
      this.selectedAct = unlockedAct;
    }

    this.actButtons.forEach(({ actNum, bg, label }) => {
      const isActive = actNum === this.selectedAct;
      const isReachable = actNum <= unlockedAct;
      bg.setFillStyle(isActive ? 0x4a7c40 : 0xf4efe4, isActive ? 0.98 : (isReachable ? 0.94 : 0.65));
      bg.setStrokeStyle(2, isActive ? 0x2f5b2d : 0x9b8c72, isActive ? 1 : 0.55);
      label.setColor(isActive ? '#ffffff' : (isReachable ? '#5a4632' : '#887d73'));
      bg.disableInteractive();
      label.disableInteractive();
      if (isReachable) {
        bg.setInteractive({ useHandCursor: true });
        label.setInteractive({ useHandCursor: true });
      }
    });
  }

  _buildLevelSelect(progress, H) {
    const W = CFG.WIDTH;
    const unlockedAct = typeof foundGetActForLevel === 'function'
      ? foundGetActForLevel(progress.maxUnlocked)
      : 1;
    if (this.selectedAct > unlockedAct) {
      this.selectedAct = unlockedAct;
    }

    const levelsPerAct = typeof foundGetLevelsPerAct === 'function' ? foundGetLevelsPerAct() : 4;
    const startLevel = ((this.selectedAct - 1) * levelsPerAct) + 1;
    const maxLevel = typeof foundGetLevelCount === 'function' ? foundGetLevelCount() : 24;
    const levels = [];
    for (let lvl = startLevel; lvl < startLevel + levelsPerAct && lvl <= maxLevel; lvl++) {
      levels.push(lvl);
    }

    if (this.levelCardNodes && this.levelCardNodes.length) {
      this.levelCardNodes.forEach((node) => node.destroy());
    }
    this.levelCardNodes = [];

    const title = (CFG.ACT_NAMES && CFG.ACT_NAMES[this.selectedAct]) || `Act ${this.selectedAct}`;
    const actText = typeof foundUiText === 'function'
      ? foundUiText(this, W / 2, H * 0.74, `Act ${this.selectedAct} · ${title}${this.selectedAct > unlockedAct ? ' · locked' : ''}`, {
        fontSize: '13px',
        fontStyle: '700',
        color: '#4a4030',
        useNativeSize: true,
      }).setOrigin(0.5).setDepth(29)
      : this.add.text(W / 2, H * 0.74, `Act ${this.selectedAct} · ${title}`, {
        fontSize: '13px',
        fontFamily: 'Arial, sans-serif',
        color: '#4a4030',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(29);
    this.levelCardNodes.push(actText);

    const cardW = 146;
    const cardH = 66;
    const gap = 12;
    const totalW = levels.length * cardW + Math.max(0, levels.length - 1) * gap;
    const startX = (W - totalW) / 2;
    const y = H * 0.78;

    levels.forEach((lvl, idx) => {
      const unlocked = lvl <= progress.maxUnlocked;
      const x = startX + idx * (cardW + gap);

      const name = (CFG.LEVEL_NAMES && CFG.LEVEL_NAMES[lvl]) || `Level ${lvl}`;
      const factor = ((CFG.DIFFICULTY && CFG.DIFFICULTY[lvl]) || 0.5) * 100;
      const platforms = (CFG.INTERIOR_PLATFORMS && CFG.INTERIOR_PLATFORMS[lvl]) || 6;
      const best = typeof foundFormatBestTime === 'function' ? foundFormatBestTime(lvl) : ' - ';

      const bg = this.add.rectangle(x + cardW / 2, y + cardH / 2, cardW, cardH,
        unlocked ? 0xffffff : 0xcccccc, unlocked ? 0.92 : 0.55)
        .setStrokeStyle(2, unlocked ? 0x4a7c40 : 0x888888)
        .setDepth(28)
        .setInteractive({ useHandCursor: unlocked });
      this.levelCardNodes.push(bg);

      const label = typeof foundUiText === 'function'
        ? foundUiText(this, x + cardW / 2, y + 10, `Lv ${lvl}`, {
          fontSize: '13px',
          fontStyle: '700',
          color: unlocked ? '#2a1800' : '#666',
          useNativeSize: true,
        }).setOrigin(0.5).setDepth(29)
        : this.add.text(x + cardW / 2, y + 10, `Lv ${lvl}`, {
          fontSize: '13px',
          fontFamily: 'Arial, sans-serif',
          color: unlocked ? '#2a1800' : '#666',
          fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(29);
      this.levelCardNodes.push(label);

      const nameText = typeof foundUiText === 'function'
        ? foundUiText(this, x + cardW / 2, y + 24, name, {
          fontSize: '9px',
          color: unlocked ? '#5a4632' : '#777',
          useNativeSize: true,
        }).setOrigin(0.5).setDepth(29)
        : this.add.text(x + cardW / 2, y + 24, name, {
          fontSize: '9px',
          fontFamily: 'Arial, sans-serif',
          color: unlocked ? '#5a4632' : '#777',
        }).setOrigin(0.5).setDepth(29);
      this.levelCardNodes.push(nameText);

      const detail = typeof foundUiText === 'function'
        ? foundUiText(this, x + cardW / 2, y + 38, unlocked
          ? `${Math.round(factor)}% jump · ${platforms} plats`
          : 'Locked', {
          fontSize: '8px',
          color: '#555',
          useNativeSize: true,
        }).setOrigin(0.5).setDepth(29)
        : this.add.text(x + cardW / 2, y + 38, unlocked
          ? `${Math.round(factor)}% jump · ${platforms} plats`
          : 'Locked', {
          fontSize: '8px',
          fontFamily: 'Arial, sans-serif',
          color: '#555',
        }).setOrigin(0.5).setDepth(29);
      this.levelCardNodes.push(detail);

      const bestLine = typeof foundUiText === 'function'
        ? foundUiText(this, x + cardW / 2, y + 50, unlocked ? `Best ${best}` : 'Beat the previous level', {
          fontSize: '8px',
          color: '#777',
          useNativeSize: true,
        }).setOrigin(0.5).setDepth(29)
        : this.add.text(x + cardW / 2, y + 50, unlocked ? `Best ${best}` : 'Beat the previous level', {
          fontSize: '8px',
          fontFamily: 'Arial, sans-serif',
          color: '#777',
        }).setOrigin(0.5).setDepth(29);
      this.levelCardNodes.push(bestLine);

      if (!unlocked && this.textures.exists('found-ui-locked')) {
        const lock = this.add.image(x + 18, y + 47, 'found-ui-locked')
          .setDisplaySize(12, 12)
          .setDepth(29);
        this.levelCardNodes.push(lock);
      }

      if (unlocked) {
        const go = () => this._startLevel(lvl);
        bg.on('pointerup', go);
        label.setInteractive({ useHandCursor: true }).on('pointerup', go);
        nameText.setInteractive({ useHandCursor: true }).on('pointerup', go);
      }
    });
  }

  _startLevel(level, seed) {
    const resolved = typeof foundResolveLevelSeed === 'function'
      ? foundResolveLevelSeed(level, seed)
      : (seed || Date.now() >>> 0);
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('Game', { level, seed: resolved });
    });
  }
}
