/* ─── Companion picker + start ─────────────────────────────────────────── */

const SR_COMPANION_KEY = 'monroe_shelter_run_companion';
const SR_START_BTN_W = 280;
const SR_START_BTN_H = 72;

class MainMenuScene extends Phaser.Scene {
  constructor() { super('MainMenu'); }

  create() {
    this.cameras.main.setBackgroundColor('#1a2e28');
    this._started = false;
    this._index = this._loadCompanionIndex();
    this.layout = Perspective.layout(this.scale.width, this.scale.height);

    this._title = srUiText(this, 0, 0, 'Shelter Run', {
      fontSize: '52px', fontFamily: '"Fredoka", sans-serif', color: '#ffffff',
    }).setDepth(5);
    this._subtitle = srUiText(this, 0, 0,
      'Chase the trail · 3 lanes · swipe jump, slide & change lanes!', {
        fontSize: '18px', color: '#cfe0ea', align: 'center', wordWrap: { width: 360 },
      }).setDepth(5);

    if (this.textures.exists(CFG.CAT_TEXTURE_KEY)) {
      this._sprite = this.add.sprite(0, 0, CFG.CAT_TEXTURE_KEY);
      this._sprite.setOrigin(0.5, 1).setScale(CFG.CAT_SCALE * 1.5).setDepth(6);
      if (this.anims.exists(ANIMS.RUN.key)) this._sprite.play(ANIMS.RUN.key);
      this._sprite.setTint(this._companion().tint);
    } else {
      this._sil = this.add.graphics().setDepth(6);
    }

    this._nameText = srUiText(this, 0, 0, this._companion().name, { fontSize: '30px', color: '#ffffff' }).setDepth(5);
    this._breedText = srUiText(this, 0, 0, this._companion().breed, { fontSize: '16px', color: '#a9c4d6' }).setDepth(5);

    const arrowStyle = { fontSize: '46px', color: '#ffffff' };
    this._leftArrow = this.add.text(0, 0, '‹', arrowStyle).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });
    this._rightArrow = this.add.text(0, 0, '›', arrowStyle).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });
    this._leftHit = this.add.circle(0, 0, 28, 0x000000, 0.001).setDepth(9).setInteractive({ useHandCursor: true });
    this._rightHit = this.add.circle(0, 0, 28, 0x000000, 0.001).setDepth(9).setInteractive({ useHandCursor: true });

    const cycleLeft = () => {
      this._index = (this._index - 1 + CFG.COMPANIONS.length) % CFG.COMPANIONS.length;
      this._refreshCompanion();
    };
    const cycleRight = () => {
      this._index = (this._index + 1) % CFG.COMPANIONS.length;
      this._refreshCompanion();
    };
    this._leftArrow.on('pointerdown', cycleLeft);
    this._rightArrow.on('pointerdown', cycleRight);
    this._leftHit.on('pointerdown', cycleLeft);
    this._rightHit.on('pointerdown', cycleRight);

    this._startFill = this.add.rectangle(0, 0, SR_START_BTN_W, SR_START_BTN_H, 0x4a7c40).setDepth(20);
    this._startZone = this.add.zone(0, 0, SR_START_BTN_W, SR_START_BTN_H).setDepth(21).setInteractive({ useHandCursor: true });
    this._startLabel = srUiText(this, 0, 0, 'Start Run', { fontSize: '26px', color: '#ffffff' }).setDepth(22).setInteractive({ useHandCursor: true });
    this._startFill.setInteractive({ useHandCursor: true }).on('pointerdown', () => this._startRun());
    this._startZone.on('pointerdown', () => this._startRun());
    this._startLabel.on('pointerdown', () => this._startRun());

    this._isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    this._hintText = srUiText(this, 0, 0,
      this._isCoarse ? 'Tap arrows to pick · Start Run' : '← → companion · Enter / Space start',
      { fontSize: '15px', color: '#9ec4b8' }
    ).setDepth(5);
    this._rotateHint = srUiText(this, 0, 0, '↻ Portrait feels best', {
      fontSize: '14px', color: '#ffb347',
    }).setDepth(5);

    this.input.on('pointerdown', (pointer) => this._onScenePointer(pointer));
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-LEFT', cycleLeft);
      this.input.keyboard.on('keydown-RIGHT', cycleRight);
      this.input.keyboard.on('keydown-ENTER', () => this._startRun());
      this.input.keyboard.on('keydown-SPACE', () => this._startRun());
      this.input.keyboard.on('keydown-ESC', () => this._requestExit());
    }

    this._layout();
    this.scale.on('resize', this._layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this._layout, this));
  }

  _companion() { return CFG.COMPANIONS[this._index] || CFG.COMPANIONS[0]; }

  _refreshCompanion() {
    if (this._sprite) this._sprite.setTint(this._companion().tint);
    this._nameText.setText(this._companion().name);
    this._breedText.setText(this._companion().breed);
    this._saveCompanionIndex(this._index);
    this._drawSilFallback();
  }

  _drawSilFallback() {
    if (!this._sil) return;
    this._sil.setPosition(this.scale.width / 2, this.scale.height * 0.48);
    srDrawRunnerSilhouette(this._sil, this._companion().tint, 'running', this.time.now * 0.01, 1.2);
  }

  _startRun() {
    if (this._started) return;
    this._started = true;
    this.scene.start('Game', { companionIndex: this._index });
  }

  _requestExit() {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'arcade:exit', game: 'shelter_run' }, '*');
      }
    } catch (e) {}
  }

  _onScenePointer(pointer) {
    if (this._started) return;
    const pts = [[pointer.worldX, pointer.worldY], [pointer.x, pointer.y]];
    for (let i = 0; i < pts.length; i++) {
      const x = pts[i][0], y = pts[i][1];
      if (this._hit(this._leftArrow, x, y) || this._hit(this._rightArrow, x, y) ||
          this._hit(this._leftHit, x, y) || this._hit(this._rightHit, x, y)) return;
      if (this._hit(this._startZone, x, y) || this._hit(this._startLabel, x, y) || this._hit(this._startFill, x, y)) {
        this._startRun(); return;
      }
    }
  }

  _hit(obj, x, y) {
    if (!obj || typeof obj.getBounds !== 'function') return false;
    const b = obj.getBounds();
    return !!(b && b.width > 0 && b.contains(x, y));
  }

  _layout() {
    const W = this.scale.width, H = this.scale.height;
    if (W <= 0 || H <= 0) return;
    this.layout = Perspective.layout(W, H);
    const wrapW = Math.max(160, Math.floor(W * 0.88));
    this._title.setPosition(W / 2, H * 0.12);
    this._subtitle.setPosition(W / 2, H * 0.20);
    this._subtitle.setStyle({ align: 'center', wordWrap: { width: wrapW } });
    const previewY = H * 0.48;
    if (this._sprite) this._sprite.setPosition(W / 2, previewY);
    this._drawSilFallback();
    this._nameText.setPosition(W / 2, previewY + 56);
    this._breedText.setPosition(W / 2, previewY + 88);
    const arrowOffset = Math.min(200, W * 0.34);
    this._leftArrow.setPosition(W / 2 - arrowOffset, previewY - 50);
    this._rightArrow.setPosition(W / 2 + arrowOffset, previewY - 50);
    this._leftHit.setPosition(W / 2 - arrowOffset, previewY - 50);
    this._rightHit.setPosition(W / 2 + arrowOffset, previewY - 50);
    const btnW = Math.max(200, Math.min(SR_START_BTN_W, W - 32));
    const btnY = Math.min(H * 0.78, H - 80);
    this._startFill.setPosition(W / 2, btnY).setSize(btnW, SR_START_BTN_H);
    this._startZone.setPosition(W / 2, btnY);
    if (this._startZone.setSize) this._startZone.setSize(btnW, SR_START_BTN_H, true);
    this._startLabel.setPosition(W / 2, btnY);
    this._hintText.setPosition(W / 2, Math.min(btnY + 48, H - 20));
    this._rotateHint.setVisible(W > H * 1.15).setPosition(W / 2, H * 0.06);
    this._title.setFontSize(W < 400 ? '40px' : '52px');
  }

  _loadCompanionIndex() {
    try {
      const saved = localStorage.getItem(SR_COMPANION_KEY);
      if (saved) {
        const i = CFG.COMPANIONS.findIndex((c) => c.id === saved);
        if (i >= 0) return i;
      }
      const mascot = String(localStorage.getItem('monroeArcadeMascot') || '').toLowerCase().trim();
      if (mascot) {
        const mi = CFG.COMPANIONS.findIndex((c) => c.id === mascot);
        const idx = mi >= 0 ? mi : 0;
        this._saveCompanionIndex(idx);
        return idx;
      }
    } catch (e) {}
    return 0;
  }

  _saveCompanionIndex(index) {
    try { localStorage.setItem(SR_COMPANION_KEY, CFG.COMPANIONS[index].id); } catch (e) {}
  }
}
