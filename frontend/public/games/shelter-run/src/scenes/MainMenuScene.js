/* ─── MainMenuScene - companion picker + start ─────────────────────────────
   Cycles the 4 companions (tinted shared sprite, cosmetic-only per the
   locked plan decision), persists the pick in localStorage, mirroring
   Flappy Cat's cyclePetCompanion() UX idea. */

const SR_COMPANION_KEY = 'monroe_shelter_run_companion';
const SR_START_BTN_W = 280;
const SR_START_BTN_H = 72;

class MainMenuScene extends Phaser.Scene {
  constructor() { super('MainMenu'); }

  create() {
    this.cameras.main.setBackgroundColor('#2a3a4a');
    this._started = false;
    this._index = this._loadCompanionIndex();

    this._title = srUiText(this, 0, 0, 'Shelter Run', {
      fontSize: '56px', fontFamily: '"Fredoka", sans-serif', color: '#ffffff',
    }).setDepth(5);

    this._subtitle = srUiText(this, 0, 0, 'Dash, dodge, and rescue real shelter pets along the way!', {
      fontSize: '20px',
      color: '#cfe0ea',
      align: 'center',
      wordWrap: { width: 400 },
    }).setDepth(5);

    this._sprite = this.add.sprite(0, 0, CFG.CAT_TEXTURE_KEY);
    this._sprite.setOrigin(0.5, 1);
    this._sprite.setScale(CFG.CAT_SCALE * 1.6);
    this._sprite.play(ANIMS.RUN.key);
    this._sprite.setTint(this._companion().tint);
    this._sprite.setDepth(6);

    this._nameText = srUiText(this, 0, 0, this._companion().name, { fontSize: '32px', color: '#ffffff' }).setDepth(5);
    this._breedText = srUiText(this, 0, 0, this._companion().breed, { fontSize: '18px', color: '#a9c4d6' }).setDepth(5);

    const arrowStyle = { fontSize: '46px', color: '#ffffff' };
    this._leftArrow = this.add.text(0, 0, '‹', arrowStyle)
      .setOrigin(0.5)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });
    this._rightArrow = this.add.text(0, 0, '›', arrowStyle)
      .setOrigin(0.5)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });

    this._leftArrow.on('pointerdown', () => {
      this._index = (this._index - 1 + CFG.COMPANIONS.length) % CFG.COMPANIONS.length;
      this._refreshCompanion();
    });
    this._rightArrow.on('pointerdown', () => {
      this._index = (this._index + 1) % CFG.COMPANIONS.length;
      this._refreshCompanion();
    });

    // Visual fill + an explicit Zone so the hit target is the label/zone,
    // not a rectangle that can be covered or left at 0-size iframe coords.
    this._startFill = this.add.rectangle(0, 0, SR_START_BTN_W, SR_START_BTN_H, 0x4a7c40).setDepth(20);
    this._startZone = this.add.zone(0, 0, SR_START_BTN_W, SR_START_BTN_H)
      .setDepth(21)
      .setInteractive({ useHandCursor: true });
    this._startLabel = srUiText(this, 0, 0, 'Start Run', { fontSize: '26px', color: '#ffffff' })
      .setDepth(22)
      .setInteractive({ useHandCursor: true });

    this._startFill.setInteractive({ useHandCursor: true }).on('pointerdown', () => this._startRun());
    this._startZone.on('pointerdown', () => this._startRun());
    this._startLabel.on('pointerdown', () => this._startRun());

    // Scene-level fallback: Phaser object hit-testing can miss after an
    // early 0-size iframe resize; still start if the pointer is in the zone.
    this.input.on('pointerdown', (pointer) => this._onScenePointer(pointer));

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-LEFT', () => this._leftArrow.emit('pointerdown'));
      this.input.keyboard.on('keydown-RIGHT', () => this._rightArrow.emit('pointerdown'));
      this.input.keyboard.on('keydown-ENTER', () => this._startRun());
      this.input.keyboard.on('keydown-SPACE', () => this._startRun());
    }

    this._layout();
    this.scale.on('resize', this._layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this._layout, this));
  }

  _companion() {
    return CFG.COMPANIONS[this._index] || CFG.COMPANIONS[0];
  }

  _refreshCompanion() {
    this._sprite.setTint(this._companion().tint);
    this._nameText.setText(this._companion().name);
    this._breedText.setText(this._companion().breed);
    this._saveCompanionIndex(this._index);
  }

  _startRun() {
    if (this._started) return;
    this._started = true;
    this.scene.start('Game', { companionIndex: this._index });
  }

  _onScenePointer(pointer) {
    if (this._started) return;
    const pts = [
      [pointer.worldX, pointer.worldY],
      [pointer.x, pointer.y],
    ];
    for (let i = 0; i < pts.length; i++) {
      const x = pts[i][0];
      const y = pts[i][1];
      if (this._contains(this._leftArrow, x, y) || this._contains(this._rightArrow, x, y)) {
        return;
      }
      if (this._contains(this._startZone, x, y) || this._contains(this._startLabel, x, y) || this._contains(this._startFill, x, y)) {
        this._startRun();
        return;
      }
    }
  }

  _contains(obj, x, y) {
    if (!obj) return false;
    if (typeof obj.getBounds === 'function') {
      const b = obj.getBounds();
      if (b && b.width > 0 && b.height > 0 && typeof b.contains === 'function' && b.contains(x, y)) {
        return true;
      }
    }
    const w = obj.width || 0;
    const h = obj.height || 0;
    if (w <= 0 || h <= 0) return false;
    const ox = obj.originX == null ? 0.5 : obj.originX;
    const oy = obj.originY == null ? 0.5 : obj.originY;
    const left = obj.x - w * ox;
    const top = obj.y - h * oy;
    return x >= left && x <= left + w && y >= top && y <= top + h;
  }

  _layout() {
    const W = this.scale.width;
    const H = this.scale.height;
    if (W <= 0 || H <= 0) return;

    const vy = (y) => y * H / CFG.HEIGHT;
    const wrapW = Math.max(160, Math.floor(W * 0.88));

    this._title.setPosition(W / 2, vy(110));

    this._subtitle.setPosition(W / 2, vy(168));
    this._subtitle.setStyle({ align: 'center', wordWrap: { width: wrapW } });
    if (typeof this._subtitle.setWordWrapWidth === 'function') {
      this._subtitle.setWordWrapWidth(wrapW, true);
    }

    const previewY = vy(380);
    this._sprite.setPosition(W / 2, previewY);
    this._nameText.setPosition(W / 2, previewY + 50);
    this._breedText.setPosition(W / 2, previewY + 88);

    const arrowOffset = Math.min(220, W * 0.36);
    this._leftArrow.setPosition(W / 2 - arrowOffset, previewY - 60);
    this._rightArrow.setPosition(W / 2 + arrowOffset, previewY - 60);

    const btnW = Math.max(180, Math.min(SR_START_BTN_W, W - 32));
    const btnY = vy(560);
    this._startFill.setPosition(W / 2, btnY);
    this._startFill.setSize(btnW, SR_START_BTN_H);
    this._startFill.setInteractive({ useHandCursor: true });
    this._startZone.setPosition(W / 2, btnY);
    if (typeof this._startZone.setSize === 'function') {
      this._startZone.setSize(btnW, SR_START_BTN_H, true);
    }
    this._startZone.setInteractive({ useHandCursor: true });
    this._startLabel.setPosition(W / 2, btnY);
    this._startLabel.setInteractive({ useHandCursor: true });

    const titleSize = W < 420 ? '40px' : '56px';
    const subSize = W < 420 ? '16px' : '20px';
    this._title.setFontSize(titleSize);
    this._subtitle.setFontSize(subSize);
  }

  _loadCompanionIndex() {
    try {
      const saved = localStorage.getItem(SR_COMPANION_KEY);
      if (saved) {
        const savedIdx = CFG.COMPANIONS.findIndex((c) => c.id === saved);
        if (savedIdx >= 0) return savedIdx;
      }
      // Seed once from Arcade Pass. Cat-only roster: unknown / non-cat → smokey.
      const mascot = String(localStorage.getItem('monroeArcadeMascot') || '').toLowerCase().trim();
      if (mascot) {
        const mascotIdx = CFG.COMPANIONS.findIndex((c) => c.id === mascot);
        const idx = mascotIdx >= 0 ? mascotIdx : 0;
        this._saveCompanionIndex(idx);
        return idx;
      }
      return 0;
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
