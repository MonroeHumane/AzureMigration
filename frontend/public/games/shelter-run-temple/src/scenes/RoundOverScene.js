/* ─── RoundOverScene - results, discovery reporting, milestone rewards ────
   discoverBulk and claimReward call sites, per the plan's exact pattern
   from match.js. The reward banner ONLY shows once the server confirms
   claimed:true - this is the invariant that was previously a bug in both
   Match and Flappy Cat, fixed this session, and must not be reintroduced
   here. */

const SR_RETRY_BTN_W = 280;
const SR_RETRY_BTN_H = 72;

class RoundOverScene extends Phaser.Scene {
  constructor() { super('RoundOver'); }

  init(data) {
    this.distanceMeters = (data && data.distanceMeters) || 0;
    this.collectedPetIds = (data && data.collectedPetIds) || [];
    this.collectedPets = (data && data.collectedPets) || [];
    this.companionIndex = (data && typeof data.companionIndex === 'number') ? data.companionIndex : 0;
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a2430');
    this._started = false;
    this._banners = [];

    this._title = srUiText(this, 0, 0, 'Run Complete!', { fontSize: '48px', color: '#ffffff' }).setDepth(5);
    this._distanceText = srUiText(this, 0, 0, this.distanceMeters + ' meters', { fontSize: '32px', color: '#ffd166' }).setDepth(5);
    this._petsText = srUiText(this, 0, 0, '🐾 ' + this.collectedPetIds.length + ' pet' + (this.collectedPetIds.length === 1 ? '' : 's') + ' rescued along the way', {
      fontSize: '20px', color: '#a9c4d6', align: 'center', wordWrap: { width: 400 },
    }).setDepth(5);

    this.rewardBanner = null; // built lazily once/if the server confirms a claim

    const petsForDex = this.collectedPets.slice();
    ShelterRunDex.reportDiscoveries(this.collectedPetIds).then(() => {
      // End-of-run gallery: flip the first rescued pet (milestones may follow).
      if (petsForDex.length && ShelterRunDex.celebrateDiscovery) {
        const star = petsForDex[0];
        if (star && star.photo) {
          ShelterRunDex.celebrateDiscovery(star, { durationMs: 3000, autoFlipMs: 500 });
        }
      }
    });
    ShelterRunDex.claimMilestones(this.distanceMeters, (milestone) => this._onMilestoneClaimed(milestone));

    // Submit distance score to Arcade Leaderboard and notify Cabinet shell
    if (this.distanceMeters > 0) {
      try {
        var p = typeof ShelterRunDex !== 'undefined' ? ShelterRunDex.getParams() : { dexUser: '' };
        var runnerName = (p && p.dexUser) || localStorage.getItem('monroeDexUser') || 'Runner';
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: 'arcade:score_recorded',
            game: 'shelter_run',
            gameId: 'shelter_run',
            score: this.distanceMeters,
            player: runnerName
          }, '*');
        }
        fetch('/arcade-api/v1/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameId: 'shelter_run',
            score: this.distanceMeters,
            playerName: runnerName
          })
        }).catch(function () {});
      } catch (err) {}
    }

    this._retryFill = this.add.rectangle(0, 0, SR_RETRY_BTN_W, SR_RETRY_BTN_H, 0x4a7c40).setDepth(20);
    this._retryZone = this.add.zone(0, 0, SR_RETRY_BTN_W, SR_RETRY_BTN_H)
      .setDepth(21)
      .setInteractive({ useHandCursor: true });
    this._retryLabel = srUiText(this, 0, 0, 'Run Again', { fontSize: '26px', color: '#ffffff' })
      .setDepth(22)
      .setInteractive({ useHandCursor: true });

    this._retryFill.setInteractive({ useHandCursor: true }).on('pointerdown', () => this._runAgain());
    this._retryZone.on('pointerdown', () => this._runAgain());
    this._retryLabel.on('pointerdown', () => this._runAgain());

    // Secondary: return to companion menu (clear exit/restart choice)
    this._menuFill = this.add.rectangle(0, 0, SR_RETRY_BTN_W, 56, 0x1e3a34).setDepth(20)
      .setStrokeStyle(2, 0x6bc4a6);
    this._menuZone = this.add.zone(0, 0, SR_RETRY_BTN_W, 56).setDepth(21).setInteractive({ useHandCursor: true });
    this._menuLabel = srUiText(this, 0, 0, 'Back to Menu', { fontSize: '22px', color: '#e8f4ef' })
      .setDepth(22).setInteractive({ useHandCursor: true });
    this._menuFill.setInteractive({ useHandCursor: true }).on('pointerdown', () => this._toMenu());
    this._menuZone.on('pointerdown', () => this._toMenu());
    this._menuLabel.on('pointerdown', () => this._toMenu());

    this._hintText = srUiText(this, 0, 0, 'Enter / Space · run again   ·   Esc · menu', {
      fontSize: '14px', color: '#9ec4b8',
    }).setDepth(5);

    this.input.on('pointerdown', (pointer) => this._onScenePointer(pointer));

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-ENTER', () => this._runAgain());
      this.input.keyboard.on('keydown-SPACE', () => this._runAgain());
      this.input.keyboard.on('keydown-R', () => this._runAgain());
      this.input.keyboard.on('keydown-ESC', () => this._toMenu());
    }

    const hints = document.getElementById('srKeyHints');
    if (hints) {
      const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      if (coarse) hints.style.display = 'none';
      else {
        hints.style.display = '';
        hints.innerHTML =
          '<span class="sr-key-hints__item"><kbd>Enter</kbd>/<kbd>R</kbd> run again</span>' +
          '<span class="sr-key-hints__item"><kbd>Esc</kbd> menu</span>';
      }
    }

    this._layout();
    this.scale.on('resize', this._layout, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this._layout, this);
      if (hints) hints.style.display = 'none';
    });
  }

  _runAgain() {
    if (this._started) return;
    this._started = true;
    this.scene.start('Game', { companionIndex: this.companionIndex });
  }

  _toMenu() {
    if (this._started) return;
    this._started = true;
    this.scene.start('MainMenu');
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
      if (this._contains(this._retryZone, x, y) || this._contains(this._retryLabel, x, y) || this._contains(this._retryFill, x, y)) {
        this._runAgain();
        return;
      }
      if (this._contains(this._menuZone, x, y) || this._contains(this._menuLabel, x, y) || this._contains(this._menuFill, x, y)) {
        this._toMenu();
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
    this._vy = vy;
    this._W = W;

    const wrapW = Math.max(160, Math.floor(W * 0.88));

    this._title.setPosition(W / 2, vy(100));
    this._distanceText.setPosition(W / 2, vy(170));
    this._petsText.setPosition(W / 2, vy(215));
    this._petsText.setStyle({ align: 'center', wordWrap: { width: wrapW } });
    if (typeof this._petsText.setWordWrapWidth === 'function') {
      this._petsText.setWordWrapWidth(wrapW, true);
    }

    const btnW = Math.max(200, Math.min(SR_RETRY_BTN_W, W - 32));
    const btnH = Math.max(SR_RETRY_BTN_H, 56);
    const menuH = Math.max(52, 48);
    const btnY = Math.min(vy(500), H - btnH - menuH - 48);
    this._retryFill.setPosition(W / 2, btnY);
    this._retryFill.setSize(btnW, btnH);
    this._retryFill.setInteractive({ useHandCursor: true });
    this._retryZone.setPosition(W / 2, btnY);
    if (typeof this._retryZone.setSize === 'function') {
      this._retryZone.setSize(btnW, btnH, true);
    }
    this._retryZone.setInteractive({ useHandCursor: true });
    this._retryLabel.setPosition(W / 2, btnY);
    this._retryLabel.setInteractive({ useHandCursor: true });

    const menuY = btnY + btnH / 2 + menuH / 2 + 14;
    if (this._menuFill) {
      this._menuFill.setPosition(W / 2, menuY);
      this._menuFill.setSize(btnW, menuH);
      this._menuFill.setInteractive({ useHandCursor: true });
      this._menuZone.setPosition(W / 2, menuY);
      if (typeof this._menuZone.setSize === 'function') {
        this._menuZone.setSize(btnW, menuH, true);
      }
      this._menuZone.setInteractive({ useHandCursor: true });
      this._menuLabel.setPosition(W / 2, menuY);
      this._menuLabel.setInteractive({ useHandCursor: true });
    }
    if (this._hintText) {
      const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      this._hintText.setVisible(!coarse);
      this._hintText.setPosition(W / 2, Math.min(menuY + menuH / 2 + 22, H - 16));
      this._hintText.setFontSize(W < 420 ? '12px' : '14px');
    }

    (this._banners || []).forEach((banner, i) => {
      const y = vy(300) + i * 46;
      const bannerWidth = Math.min(420, W * 0.9);
      if (banner.bg) {
        banner.bg.setPosition(W / 2, y);
        banner.bg.setSize(bannerWidth, 40);
      }
      if (banner.label) banner.label.setPosition(W / 2, y);
    });
  }

  _onMilestoneClaimed(milestone) {
    // A run can cross more than one milestone; stack banners rather than
    // overwrite, since each is a real, separate reward.
    const y = this._vy(300) + (this._bannerCount || 0) * 46;
    this._bannerCount = (this._bannerCount || 0) + 1;

    const tierLabel = { standard: 'Standard', duo: 'Duo', deluxe: 'Deluxe' }[milestone.tier] || milestone.tier;
    const bannerWidth = Math.min(420, this._W * 0.9);
    const bg = this.add.rectangle(this._W / 2, y, bannerWidth, 40, 0x8b5cf6, 0.85).setDepth(8);
    const label = srUiText(this, this._W / 2, y, '🎁 ' + tierLabel + ' pack unlocked!', { fontSize: '18px', color: '#ffffff' }).setDepth(9);
    this._banners.push({ bg, label });
    this.tweens.add({ targets: bg, alpha: { from: 0, to: 0.85 }, duration: 250 });
  }
}
