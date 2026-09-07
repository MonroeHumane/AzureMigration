/* ─── RoundOverScene - results, discovery reporting, milestone rewards ────
   discoverBulk and claimReward call sites, per the plan's exact pattern
   from match.js. The reward banner ONLY shows once the server confirms
   claimed:true - this is the invariant that was previously a bug in both
   Match and Flappy Cat, fixed this session, and must not be reintroduced
   here. */

class RoundOverScene extends Phaser.Scene {
  constructor() { super('RoundOver'); }

  init(data) {
    this.distanceMeters = (data && data.distanceMeters) || 0;
    this.collectedPetIds = (data && data.collectedPetIds) || [];
    this.companionIndex = (data && typeof data.companionIndex === 'number') ? data.companionIndex : 0;
  }

  create() {
    // Same reasoning as MainMenuScene: position off the actual canvas size,
    // not the fixed 1280x720 design box.
    const W = this.scale.width;
    const H = this.scale.height;
    const vy = (y) => y * H / CFG.HEIGHT;
    this._vy = vy;
    this._W = W;

    this.cameras.main.setBackgroundColor('#1a2430');

    srUiText(this, W / 2, vy(100), 'Run Complete!', { fontSize: '48px', color: '#ffffff' });
    srUiText(this, W / 2, vy(170), this.distanceMeters + ' meters', { fontSize: '32px', color: '#ffd166' });
    srUiText(this, W / 2, vy(215), '🐾 ' + this.collectedPetIds.length + ' pet' + (this.collectedPetIds.length === 1 ? '' : 's') + ' rescued along the way', {
      fontSize: '20px', color: '#a9c4d6',
    });

    this.rewardBanner = null; // built lazily once/if the server confirms a claim

    ShelterRunDex.reportDiscoveries(this.collectedPetIds);
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

    const retryBtn = this.add.rectangle(W / 2, vy(560), 260, 64, 0x4a7c40).setInteractive({ useHandCursor: true });
    srUiText(this, W / 2, vy(560), 'Run Again', { fontSize: '26px', color: '#ffffff' });
    retryBtn.on('pointerdown', () => {
      this.scene.start('Game', { companionIndex: this.companionIndex });
    });

    this.input.keyboard.on('keydown-ENTER', () => retryBtn.emit('pointerdown'));
    this.input.keyboard.on('keydown-SPACE', () => retryBtn.emit('pointerdown'));
  }

  _onMilestoneClaimed(milestone) {
    // A run can cross more than one milestone; stack banners rather than
    // overwrite, since each is a real, separate reward.
    const y = this._vy(300) + (this._bannerCount || 0) * 46;
    this._bannerCount = (this._bannerCount || 0) + 1;

    const tierLabel = { standard: 'Standard', duo: 'Duo', deluxe: 'Deluxe' }[milestone.tier] || milestone.tier;
    const bannerWidth = Math.min(420, this._W * 0.9);
    const bg = this.add.rectangle(this._W / 2, y, bannerWidth, 40, 0x8b5cf6, 0.85);
    srUiText(this, this._W / 2, y, '🎁 ' + tierLabel + ' pack unlocked!', { fontSize: '18px', color: '#ffffff' });
    this.tweens.add({ targets: bg, alpha: { from: 0, to: 0.85 }, duration: 250 });
  }
}
